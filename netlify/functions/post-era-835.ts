// ============================================================================
// post-era-835 — import an X12 835 (ERA / remittance advice) file and post
// payments. Until API-pull credentials are configured, the workflow is:
// download the 835 from the Optum/clearinghouse portal → Billing → ERA tab →
// Import 835. Parser handles BPR (payment header), TRN (check/trace),
// CLP (per-claim payment) and CAS (adjustments) segments.
//
// Claim matching: our 837 generator sets CLM01 = "SB<superbill_id>", which
// payers echo back as CLP01 — so each CLP maps directly to a superbill.
// Caller's JWT is forwarded; all writes run under the user's RLS.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

interface ClaimPayment {
  clp01: string;
  superbill_id: number | null;
  status_code: string;
  charged: number;
  paid: number;
  patient_resp: number;
  payer_claim_number: string;
  adjustments: { group: string; reason: string; amount: number }[];
}

function parse835(x12: string) {
  const segs = x12.replace(/\r?\n/g, '').split('~').map(s => s.trim()).filter(Boolean);
  const get = (id: string) => segs.filter(s => s.startsWith(id + '*')).map(s => s.split('*'));

  const bpr = get('BPR')[0];
  const trn = get('TRN')[0];
  const payerN1 = segs.find(s => s.startsWith('N1*PR*'))?.split('*');
  const dtmCheck = segs.find(s => s.startsWith('DTM*405*'))?.split('*');

  const totalPayment = bpr ? Number(bpr[2] ?? 0) : 0;
  const paymentMethod = bpr?.[4] ?? 'ACH';
  const checkNumber = trn?.[2] ?? '';
  const payerName = payerN1?.[2] ?? 'Unknown payer';
  const checkDate = dtmCheck?.[2]
    ? `${dtmCheck[2].slice(0, 4)}-${dtmCheck[2].slice(4, 6)}-${dtmCheck[2].slice(6, 8)}`
    : null;

  // Walk segments grouping CAS adjustments under their CLP
  const claims: ClaimPayment[] = [];
  let current: ClaimPayment | null = null;
  for (const raw of segs) {
    const f = raw.split('*');
    if (f[0] === 'CLP') {
      if (current) claims.push(current);
      const clp01 = f[1] ?? '';
      const m = clp01.match(/^SB(\d+)$/i);
      current = {
        clp01,
        superbill_id: m ? Number(m[1]) : (Number.isFinite(Number(clp01)) ? Number(clp01) : null),
        status_code: f[2] ?? '',
        charged: Number(f[3] ?? 0),
        paid: Number(f[4] ?? 0),
        patient_resp: Number(f[5] ?? 0),
        payer_claim_number: f[7] ?? '',
        adjustments: [],
      };
    } else if (f[0] === 'CAS' && current) {
      // CAS*group*reason*amount (repeating triplets)
      for (let i = 2; i + 1 < f.length; i += 3) {
        if (f[i] && f[i + 1]) {
          current.adjustments.push({ group: f[1], reason: f[i], amount: Number(f[i + 1] ?? 0) });
        }
      }
    }
  }
  if (current) claims.push(current);

  return { totalPayment, paymentMethod, checkNumber, checkDate, payerName, claims };
}

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Authorization required' }) };
  }

  let body: any;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
  const x12: string = body.x12 ?? '';
  if (!x12.includes('CLP*')) {
    return { statusCode: 422, body: JSON.stringify({ error: 'Not an 835 remittance file (no CLP segments found)' }) };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const cr = supabase.schema('cr');

  const era = parse835(x12);
  const results: any[] = [];

  for (const claim of era.claims) {
    if (!claim.superbill_id) {
      results.push({ clp01: claim.clp01, posted: false, reason: 'Could not match to a superbill' });
      continue;
    }
    const { data: sb } = await cr.from('superbill')
      .select('superbill_id, org_id, patient_id, total_charges, total_amount, insurance_paid')
      .eq('superbill_id', claim.superbill_id).maybeSingle();
    if (!sb) {
      results.push({ clp01: claim.clp01, posted: false, reason: 'Superbill not found or not accessible' });
      continue;
    }

    const { data: sub } = await cr.from('edi_submissions')
      .select('submission_id').eq('superbill_id', sb.superbill_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    const { error: eraErr } = await cr.from('era_payments').insert({
      submission_id: sub?.submission_id ?? null,
      superbill_id: sb.superbill_id,
      patient_id: sb.patient_id,
      org_id: sb.org_id,
      payer_name: era.payerName,
      check_number: era.checkNumber,
      check_date: era.checkDate,
      payment_method: era.paymentMethod,
      total_payment: claim.paid,
      adjustment_codes: claim.adjustments.length ? JSON.stringify(claim.adjustments) : null,
      era_payload: x12.length > 50000 ? x12.slice(0, 50000) : x12,
      status: 'posted',
      posted_at: new Date().toISOString(),
    });
    if (eraErr) {
      results.push({ clp01: claim.clp01, posted: false, reason: eraErr.message });
      continue;
    }

    const charged = Number(sb.total_charges ?? sb.total_amount ?? 0);
    const paidToDate = Number(sb.insurance_paid ?? 0) + claim.paid;
    await cr.from('superbill').update({
      insurance_paid: paidToDate,
      balance_due_amt: Math.max(0, charged - paidToDate),
      billing_status: paidToDate >= charged ? 'paid' : 'partially_paid',
    }).eq('superbill_id', sb.superbill_id);

    if (sub?.submission_id) {
      await cr.from('edi_submissions').update({
        status: 'paid',
        response_payload: JSON.stringify({ era_check: era.checkNumber, paid: claim.paid, status_code: claim.status_code }),
      }).eq('submission_id', sub.submission_id);
    }

    results.push({ clp01: claim.clp01, superbill_id: sb.superbill_id, posted: true, paid: claim.paid, patient_resp: claim.patient_resp });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payer: era.payerName,
      check_number: era.checkNumber,
      check_date: era.checkDate,
      total_payment: era.totalPayment,
      claims_in_file: era.claims.length,
      posted: results.filter(r => r.posted).length,
      results,
    }),
  };
};
