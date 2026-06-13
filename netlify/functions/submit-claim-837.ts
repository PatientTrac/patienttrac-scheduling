// ============================================================================
// submit-claim-837 — generate an X12 837P (005010X222A1) professional claim
// from a superbill and submit it to Optum / Change Healthcare.
//
// Credential seam: when OPTUM_CLIENT_ID + OPTUM_CLIENT_SECRET are set, the
// claim is transmitted (OAuth2 client-credentials -> POST X12) and the
// submission is stored with the gateway response. Until then the claim is
// generated, validated, and stored with status 'generated' so the pipeline
// is fully testable end-to-end.
//
// Security: no service-role key. The caller's Supabase JWT is forwarded, so
// every read/write happens under the user's own RLS policies.
//
// International: transmission is a pluggable gateway registry. 'optum-x12'
// (US, 837P) is implemented; 'co-rips' (Colombia — RIPS/DIAN) and 'uk-nhs'
// (United Kingdom) are registered seams awaiting their regional formats.
// Gateway resolves per org: saas.config key billing_gateway:<org_id> →
// env BILLING_GATEWAY → 'optum-x12'.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const OPTUM_CLIENT_ID = process.env.OPTUM_CLIENT_ID || '';
const OPTUM_CLIENT_SECRET = process.env.OPTUM_CLIENT_SECRET || '';
const OPTUM_TOKEN_URL = process.env.OPTUM_TOKEN_URL || 'https://apigw.changehealthcare.com/apip/auth/v2/token';
const OPTUM_SUBMIT_URL = process.env.OPTUM_SUBMIT_URL || '';
const OPTUM_SUBMITTER_ID = process.env.OPTUM_SUBMITTER_ID || 'PATIENTTRAC';
const OPTUM_RECEIVER_ID = process.env.OPTUM_RECEIVER_ID || 'CHANGEHC';

// ── X12 helpers ─────────────────────────────────────────────────────────────
const seg = (...parts: (string | number | null | undefined)[]) =>
  parts.map(p => (p === null || p === undefined ? '' : String(p))).join('*').replace(/\*+$/, '');
const x12Date = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
const x12DateShort = (d: Date) => x12Date(d).slice(2);
const x12Time = (d: Date) => d.toISOString().slice(11, 16).replace(':', '');
const clean = (s: unknown) => String(s ?? '').replace(/[*~:^]/g, ' ').trim();

interface BuildInput {
  superbill: any; patient: any; insurance: any; facility: any; provider: any;
}

function build837P({ superbill, patient, insurance, facility, provider }: BuildInput) {
  const now = new Date();
  const ctrl = String(now.getTime()).slice(-9);
  const issues: string[] = [];

  const billingNpi = superbill.billing_provider_npi || facility?.npi || provider?.npi || '';
  const renderingNpi = superbill.rendering_provider_npi || provider?.npi || billingNpi;
  const taxId = facility?.tax_id || provider?.tax_id || '';
  if (!billingNpi) issues.push('Missing billing provider NPI (set facility or provider NPI)');
  if (!taxId) issues.push('Missing billing tax ID (facility.tax_id)');
  if (!insurance?.policy_number && !insurance?.subscriber_id) issues.push('Missing subscriber/member ID on primary insurance');

  const cpts: string[] = Array.isArray(superbill.cpt_codes) ? superbill.cpt_codes : [];
  const icds: string[] = Array.isArray(superbill.diagnosis_codes) && superbill.diagnosis_codes.length > 0
    ? superbill.diagnosis_codes
    : (Array.isArray(superbill.icd_codes) ? superbill.icd_codes : []);
  if (cpts.length === 0) issues.push('No CPT codes on superbill');
  if (icds.length === 0) issues.push('No diagnosis codes on superbill');

  const total = Number(superbill.total_charges ?? superbill.total_amount ?? 0).toFixed(2);
  const perLine = cpts.length > 0 ? (Number(total) / cpts.length).toFixed(2) : total;
  const svcDate = superbill.service_date ? new Date(superbill.service_date) : now;
  const pos = superbill.place_of_service || '11';
  const memberId = clean(insurance?.subscriber_id || insurance?.policy_number);
  const payerName = clean(insurance?.insurance_company || 'UNKNOWN PAYER');
  const subscriberIsPatient = !insurance?.relationship_to_patient ||
    /self/i.test(insurance.relationship_to_patient);

  const segs: string[] = [];
  segs.push(
    `ISA*00*          *00*          *ZZ*${OPTUM_SUBMITTER_ID.padEnd(15)}*ZZ*${OPTUM_RECEIVER_ID.padEnd(15)}*${x12DateShort(now)}*${x12Time(now)}*^*00501*${ctrl}*0*P*:`
  );
  segs.push(seg('GS', 'HC', OPTUM_SUBMITTER_ID, OPTUM_RECEIVER_ID, x12Date(now), x12Time(now), ctrl, 'X', '005010X222A1'));
  segs.push(seg('ST', '837', '0001', '005010X222A1'));
  segs.push(seg('BHT', '0019', '00', `PTF${superbill.superbill_id}`, x12Date(now), x12Time(now), 'CH'));
  // 1000A submitter / 1000B receiver
  segs.push(seg('NM1', '41', '2', clean(facility?.facility_name || 'PATIENTTRAC'), '', '', '', '', '46', OPTUM_SUBMITTER_ID));
  segs.push(seg('PER', 'IC', clean(facility?.facility_name || 'BILLING'), 'TE', clean(facility?.phone || '0000000000').replace(/\D/g, '') || '0000000000'));
  segs.push(seg('NM1', '40', '2', 'CHANGE HEALTHCARE', '', '', '', '', '46', OPTUM_RECEIVER_ID));
  // 2000A billing provider
  segs.push(seg('HL', '1', '', '20', '1'));
  segs.push(seg('NM1', '85', '2', clean(facility?.facility_name || 'PATIENTTRAC FACILITY'), '', '', '', '', 'XX', billingNpi || '0000000000'));
  segs.push(seg('N3', clean(facility?.address1 || 'ADDRESS ON FILE')));
  segs.push(seg('N4', clean(facility?.city || 'CITY'), clean(facility?.state || 'ST'), clean(facility?.zipcode || '00000').replace(/\D/g, '')));
  segs.push(seg('REF', 'EI', taxId || '000000000'));
  // 2000B subscriber
  segs.push(seg('HL', '2', '1', '22', '0'));
  segs.push(seg('SBR', 'P', subscriberIsPatient ? '18' : '', clean(insurance?.group_number), '', '', '', '', '', 'CI'));
  const subName = subscriberIsPatient
    ? { last: clean(patient?.last_name), first: clean(patient?.first_name) }
    : (() => {
        const parts = clean(insurance?.subscriber_name).split(' ');
        return { last: parts.slice(-1)[0] || clean(patient?.last_name), first: parts[0] || clean(patient?.first_name) };
      })();
  segs.push(seg('NM1', 'IL', '1', subName.last, subName.first, '', '', '', 'MI', memberId || 'UNKNOWN'));
  if (patient?.address1) {
    segs.push(seg('N3', clean(patient.address1)));
    segs.push(seg('N4', clean(patient.city), clean(patient.state), clean(patient.zipcode || '').replace(/\D/g, '')));
  }
  const dob = (subscriberIsPatient ? patient?.birth : insurance?.subscriber_dob) || patient?.birth;
  segs.push(seg('DMG', 'D8', dob ? x12Date(new Date(dob)) : '19000101', /^f/i.test(patient?.gender ?? '') ? 'F' : /^m/i.test(patient?.gender ?? '') ? 'M' : 'U'));
  segs.push(seg('NM1', 'PR', '2', payerName, '', '', '', '', 'PI', clean(insurance?.payer_id || insurance?.insurance_id || '00000')));
  // 2300 claim
  segs.push(seg('CLM', `SB${superbill.superbill_id}`, total, '', '', `${pos}:B:1`, 'Y', 'A', 'Y', 'Y'));
  if (icds.length > 0) {
    const hi = ['HI', `ABK:${clean(icds[0]).replace('.', '')}`,
      ...icds.slice(1, 12).map((c: string) => `ABF:${clean(c).replace('.', '')}`)];
    segs.push(hi.join('*'));
  }
  // rendering provider (2310B) when distinct
  if (renderingNpi && renderingNpi !== billingNpi) {
    segs.push(seg('NM1', '82', '1', clean(provider?.last_name), clean(provider?.first_name), '', '', '', 'XX', renderingNpi));
  }
  // 2400 service lines
  cpts.forEach((cpt: string, i: number) => {
    segs.push(seg('LX', i + 1));
    segs.push(seg('SV1', `HC:${clean(cpt)}`, i === cpts.length - 1
      ? (Number(total) - Number(perLine) * (cpts.length - 1)).toFixed(2)
      : perLine, 'UN', '1', '', '', '1'));
    segs.push(seg('DTP', '472', 'D8', x12Date(svcDate)));
  });
  segs.push(seg('SE', segs.length - 1, '0001')); // segment count from ST through SE
  segs.push(seg('GE', '1', ctrl));
  segs.push(seg('IEA', '1', ctrl));

  return { x12: segs.join('~') + '~', issues };
}

// ── Optum / Change Healthcare transmission ──────────────────────────────────
async function transmit(x12: string): Promise<{ ok: boolean; status: string; response: any }> {
  const tokenRes = await fetch(OPTUM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: OPTUM_CLIENT_ID,
      client_secret: OPTUM_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) {
    return { ok: false, status: 'auth_error', response: await tokenRes.text() };
  }
  const { access_token } = await tokenRes.json();
  const submitRes = await fetch(OPTUM_SUBMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/edi-x12', Authorization: `Bearer ${access_token}` },
    body: x12,
  });
  const body = await submitRes.text();
  let parsed: any = body;
  try { parsed = JSON.parse(body); } catch { /* raw text response */ }
  return { ok: submitRes.ok, status: submitRes.ok ? 'submitted' : 'error', response: parsed };
}

// ── Billing gateway registry (multi-region seam) ───────────────────────────
interface GatewayResult { ok: boolean; status: string; response: any }
interface BillingGateway {
  key: string;
  ediFormat: string;
  clearinghouseLabel: string;
  credentialed: () => boolean;
  transmit: (payload: string) => Promise<GatewayResult>;
}

const GATEWAYS: Record<string, BillingGateway> = {
  'optum-x12': {
    key: 'optum-x12',
    ediFormat: '837P-005010X222A1',
    clearinghouseLabel: 'Optum / Change Healthcare',
    credentialed: () => Boolean(OPTUM_CLIENT_ID && OPTUM_CLIENT_SECRET && OPTUM_SUBMIT_URL),
    transmit,
  },
  'co-rips': {
    key: 'co-rips',
    ediFormat: 'RIPS-CO',
    clearinghouseLabel: 'Colombia RIPS / DIAN (pending implementation)',
    credentialed: () => false,
    transmit: async () => ({ ok: false, status: 'gateway_not_implemented', response: 'Colombia RIPS gateway not yet implemented' }),
  },
  'uk-nhs': {
    key: 'uk-nhs',
    ediFormat: 'NHS-UK',
    clearinghouseLabel: 'NHS (United Kingdom — pending implementation)',
    credentialed: () => false,
    transmit: async () => ({ ok: false, status: 'gateway_not_implemented', response: 'NHS gateway not yet implemented' }),
  },
};

async function resolveGateway(supabase: any, orgId: string): Promise<BillingGateway> {
  try {
    const { data } = await supabase.from('app_config')
      .select('value').eq('key', `billing_gateway:${orgId}`).maybeSingle();
    const key = data?.value || process.env.BILLING_GATEWAY || 'optum-x12';
    return GATEWAYS[key] ?? GATEWAYS['optum-x12'];
  } catch {
    return GATEWAYS[process.env.BILLING_GATEWAY || 'optum-x12'] ?? GATEWAYS['optum-x12'];
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────
export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Authorization required' }) };
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Database not configured' }) };
  }

  let body: any;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
  const superbillId = Number(body.superbill_id);
  if (!superbillId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'superbill_id required' }) };
  }

  // Caller's JWT → all queries run under their RLS
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const cr = supabase.schema('cr');

  const { data: superbill, error: sbErr } = await cr.from('superbill')
    .select('*').eq('superbill_id', superbillId).single();
  if (sbErr || !superbill) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Superbill not found or not accessible' }) };
  }

  const [{ data: patient }, { data: insurance }, { data: facility }, { data: provider }] = await Promise.all([
    cr.from('patient').select('patient_id, first_name, last_name, birth, gender, address1, city, state, zipcode')
      .eq('patient_id', superbill.patient_id).maybeSingle(),
    superbill.primary_insurance_id
      ? cr.from('patient_insurance').select('*').eq('insurance_id', superbill.primary_insurance_id).maybeSingle()
      : cr.from('patient_insurance').select('*').eq('patient_id', superbill.patient_id)
          .eq('is_primary', true).eq('is_active', true).maybeSingle(),
    cr.from('facilities').select('facility_id, facility_name, address1, city, state, zipcode, phone, npi, tax_id')
      .eq('org_id', superbill.org_id).limit(1).maybeSingle(),
    superbill.provider_id
      ? cr.from('providers').select('provider_id, first_name, last_name, npi, tax_id').eq('provider_id', superbill.provider_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);

  if (!patient) return { statusCode: 422, body: JSON.stringify({ error: 'Patient record not accessible' }) };
  if (!insurance) return { statusCode: 422, body: JSON.stringify({ error: 'No active primary insurance on file' }) };

  const { x12, issues } = build837P({ superbill, patient, insurance, facility, provider });

  const gateway = await resolveGateway(supabase, superbill.org_id);
  const credentialed = gateway.credentialed();
  let status = 'generated';
  let response: any = null;
  if (credentialed && issues.length === 0) {
    const tx = await gateway.transmit(x12);
    status = tx.status;
    response = tx.response;
  }

  const internalRef = `PTF-${superbillId}-${Date.now()}`;
  const { data: sub, error: subErr } = await cr.from('edi_submissions').insert({
    superbill_id: superbillId,
    patient_id: superbill.patient_id,
    org_id: superbill.org_id,
    insurance_id: insurance.insurance_id,
    payer_name: insurance.insurance_company ?? 'Unknown',
    submission_type: 'primary',
    edi_format: gateway.ediFormat,
    clearinghouse: gateway.clearinghouseLabel,
    status,
    submitted_at: status === 'submitted' ? new Date().toISOString() : null,
    edi_payload: x12,
    response_payload: response ? JSON.stringify(response) : null,
    total_charges: superbill.total_charges ?? superbill.total_amount,
    internal_ref: internalRef,
  }).select('submission_id').single();
  if (subErr) {
    return { statusCode: 500, body: JSON.stringify({ error: `Could not record submission: ${subErr.message}` }) };
  }

  await cr.from('superbill').update({
    billing_status: status === 'submitted' ? 'submitted' : 'ready',
    submitted: status === 'submitted',
    submit_date: status === 'submitted' ? new Date().toISOString() : null,
  }).eq('superbill_id', superbillId);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submission_id: sub.submission_id,
      internal_ref: internalRef,
      status,
      gateway: gateway.key,
      credentialed,
      validation_issues: issues,
      x12_preview: x12.slice(0, 400),
    }),
  };
};
