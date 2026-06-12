import { useState, useEffect, useCallback } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { supabase } from '../../lib/supabase';
import {
  Sparkles, Download, Send, Check,
  DollarSign, FileText, Loader2, Trash2, RefreshCw,
} from 'lucide-react';
import { ProposalDocument } from './ProposalPDF';
import type { ProposalPDFProps } from './ProposalPDF';

// Shared platform functions live on the surgery site; sibling apps set VITE_SHARED_FN_BASE
const FN_BASE: string = (import.meta as any).env?.VITE_SHARED_FN_BASE ?? '';

// ── Types ──────────────────────────────────────────────────────────────────────
interface CostLineItem   { label: string; amount: number; category: string; editable: boolean }
interface FinancingOption { type: string; label: string; totalAmount: number; downPayment?: number; monthlyPayment?: number; termMonths?: number; discountApplied?: boolean }
interface ProposalData   { lineItems: CostLineItem[]; totalEstimate: number; financingOptions: FinancingOption[]; patientSummary: string }

interface Facility {
  facility_id: number;
  facility_name: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  phone?: string;
  logo_url?: string;
}

interface Provider {
  provider_id: number;
  first_name: string;
  last_name: string;
  credential: string;
}

interface Props {
  orgId: string;
  encounterId?: number;
  procedureNamePreset?: string;
}

const PROCEDURE_OPTIONS = [
  // Breast
  { label: 'Breast Augmentation', type: 'breast', duration: 1.5 },
  { label: 'Breast Reduction', type: 'breast', duration: 2.5 },
  { label: 'Breast Lift (Mastopexy)', type: 'breast', duration: 2.0 },
  { label: 'Breast Reconstruction', type: 'breast', duration: 3.5 },
  { label: 'Implant Revision', type: 'breast', duration: 2.0 },
  // Body
  { label: 'Abdominoplasty (Tummy Tuck)', type: 'body', duration: 3.0 },
  { label: 'Mini Abdominoplasty', type: 'body', duration: 2.0 },
  { label: 'Body Contouring / Body Lift', type: 'body', duration: 4.0 },
  { label: 'Brazilian Butt Lift (BBL)', type: 'body', duration: 3.5 },
  // Liposuction
  { label: 'Tumescent Liposuction', type: 'liposuction', duration: 2.5 },
  { label: 'VASER Liposuction', type: 'liposuction', duration: 2.5 },
  { label: 'High-Definition Lipo', type: 'liposuction', duration: 3.5 },
  // Face
  { label: 'Facelift (Rhytidectomy)', type: 'face', duration: 3.5 },
  { label: 'Mini Facelift', type: 'face', duration: 2.0 },
  { label: 'Rhinoplasty', type: 'face', duration: 2.5 },
  { label: 'Blepharoplasty', type: 'face', duration: 1.5 },
  { label: 'Brow Lift', type: 'face', duration: 1.5 },
  // Non-surgical
  { label: 'Botox / Dysport Treatment', type: 'non_surgical', duration: 0.5 },
  { label: 'Filler Treatment', type: 'non_surgical', duration: 0.5 },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n ?? 0);
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function ProposalBuilder({ orgId, encounterId, procedureNamePreset }: Props) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [providers, setProviders]   = useState<Provider[]>([]);
  const [facilityId, setFacilityId] = useState<number | null>(null);

  const [procedureName, setProcedureName] = useState(procedureNamePreset ?? '');
  const [procedureType, setProcedureType] = useState('body');
  const [durationHours, setDurationHours] = useState(2.0);
  const [surgeonId, setSurgeonId]         = useState<number | null>(null);
  const [patientName, setPatientName]     = useState('');
  const [patientEmail, setPatientEmail]   = useState('');
  const [includeContralateral, setIncludeContralateral] = useState(false);
  const [includeNAR, setIncludeNAR]       = useState(false);

  const [proposal, setProposal]           = useState<ProposalData | null>(null);
  const [generating, setGenerating]       = useState(false);
  const [genError, setGenError]           = useState('');
  const [selectedFinancing, setSelectedFinancing] = useState(0);

  const [sending, setSending]             = useState(false);
  const [sentSuccess, setSentSuccess]     = useState(false);
  const [sendError, setSendError]         = useState('');

  // load facility + providers
  useEffect(() => {
    supabase.schema('cr').from('facilities')
      .select('facility_id,facility_name,address_street,address_city,address_state,address_zip,phone,logo_url')
      .eq('org_id', orgId)
      .then(({ data }) => {
        const facs = data ?? [];
        setFacilities(facs);
        if (facs.length > 0) setFacilityId(facs[0].facility_id);
      });
    supabase.schema('cr').from('providers')
      .select('provider_id,first_name,last_name,credential')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('last_name')
      .then(({ data }) => {
        const provs = data ?? [];
        setProviders(provs);
        if (provs.length > 0) setSurgeonId(provs[0].provider_id);
      });
  }, [orgId]);

  const facility = facilities.find(f => f.facility_id === facilityId);
  const surgeon  = providers.find(p => p.provider_id === surgeonId);
  const surgeonName = surgeon ? `${surgeon.first_name} ${surgeon.last_name}${surgeon.credential ? `, ${surgeon.credential}` : ''}` : '';

  const facilityAddress = facility
    ? [facility.address_street, facility.address_city, facility.address_state, facility.address_zip].filter(Boolean).join(', ')
    : '';

  const handleProcedureSelect = (label: string) => {
    const opt = PROCEDURE_OPTIONS.find(p => p.label === label);
    if (opt) { setProcedureName(opt.label); setProcedureType(opt.type); setDurationHours(opt.duration); }
  };

  const generate = useCallback(async () => {
    if (!procedureName || !surgeonId) return;
    setGenerating(true);
    setGenError('');
    setProposal(null);

    try {
      const res = await fetch(`${FN_BASE}/.netlify/functions/ai-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedureType,
          procedureName,
          estimatedDurationHours: durationHours,
          surgeonName,
          encounterId: encounterId?.toString(),
          orgId,
          includeContralateral,
          includeNAR,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProposal(data);
      setSelectedFinancing(0);
    } catch (e: any) {
      setGenError(e.message ?? 'Failed to generate proposal');
    } finally {
      setGenerating(false);
    }
  }, [procedureName, procedureType, durationHours, surgeonId, surgeonName, orgId, encounterId, includeContralateral, includeNAR]);

  const updateLineItem = (idx: number, field: 'label' | 'amount', val: string | number) => {
    if (!proposal) return;
    const items = [...proposal.lineItems];
    items[idx] = { ...items[idx], [field]: val };
    setProposal({ ...proposal, lineItems: items, totalEstimate: items.reduce((s, i) => s + Number(i.amount), 0) });
  };

  const removeLineItem = (idx: number) => {
    if (!proposal) return;
    const items = proposal.lineItems.filter((_, i) => i !== idx);
    setProposal({ ...proposal, lineItems: items, totalEstimate: items.reduce((s, i) => s + i.amount, 0) });
  };

  const sendToPatient = async () => {
    if (!patientEmail || !proposal) return;
    setSending(true);
    setSentSuccess(false);
    setSendError('');
    try {
      const res = await fetch(`${FN_BASE}/.netlify/functions/send-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientEmail,
          patientName: patientName || 'Patient',
          facilityName: facility?.facility_name ?? 'Our Practice',
          surgeonName,
          procedureName,
          totalEstimate: proposal.totalEstimate,
          patientSummary: proposal.patientSummary,
          financingOptions: proposal.financingOptions,
          selectedFinancing,
          orgId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Send failed');
      setSentSuccess(true);
    } catch (e: any) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  };

  const proposalDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const pdfProps: ProposalPDFProps = {
    facilityName:     facility?.facility_name ?? '',
    facilityAddress,
    facilityPhone:    facility?.phone ?? '',
    facilityLogoUrl:  facility?.logo_url ?? undefined,
    patientName:      patientName || 'Patient',
    surgeonName,
    procedureName,
    proposalDate,
    lineItems:        proposal?.lineItems ?? [],
    financingOptions: proposal?.financingOptions ?? [],
    selectedFinancing,
    patientSummary:   proposal?.patientSummary ?? '',
  };

  const total = proposal?.lineItems.reduce((s, i) => s + i.amount, 0) ?? 0;

  // ── Styles ───────────────────────────────────────────────────────────────────
  const card = { background: '#0f1e35', border: '1px solid rgba(201,169,110,0.15)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 };
  const label = { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block' as const, marginBottom: 6 };
  const input = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const };
  const btn = (color: string, bg: string, border?: string) => ({
    display: 'flex' as const, alignItems: 'center' as const, gap: 7, padding: '9px 18px', borderRadius: 8,
    background: bg, border: `1px solid ${border ?? bg}`, color, fontSize: 13, fontWeight: 600 as const,
    cursor: 'pointer' as const, textDecoration: 'none' as const,
  });

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

      {/* ── LEFT: Form ─────────────────────────────────────────────────── */}
      <div style={{ width: 320, flexShrink: 0 }}>

        {/* Facility + Patient */}
        <div style={card}>
          <div style={{ color: '#c9a96e', fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={15} /> Proposal Details
          </div>

          {facilities.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <span style={label}>Facility</span>
              <select value={facilityId ?? ''} onChange={e => setFacilityId(Number(e.target.value))} style={input}>
                {facilities.map(f => <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>)}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <span style={label}>Patient Name (display only)</span>
            <input value={patientName} onChange={e => setPatientName(e.target.value)}
              placeholder="e.g. Jane Smith" style={input} />
          </div>

          <div style={{ marginBottom: 0 }}>
            <span style={label}>Patient Email</span>
            <input value={patientEmail} onChange={e => setPatientEmail(e.target.value)}
              type="email" placeholder="patient@email.com" style={input} />
          </div>
        </div>

        {/* Procedure */}
        <div style={card}>
          <div style={{ color: '#c9a96e', fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={15} /> Procedure
          </div>

          <div style={{ marginBottom: 14 }}>
            <span style={label}>Select Procedure</span>
            <select value={procedureName} onChange={e => handleProcedureSelect(e.target.value)} style={input}>
              <option value="">— choose —</option>
              {['Breast', 'Body', 'Liposuction', 'Face'].map(group => (
                <optgroup key={group} label={group}>
                  {PROCEDURE_OPTIONS.filter(p => {
                    if (group === 'Breast') return p.type === 'breast';
                    if (group === 'Body') return p.type === 'body';
                    if (group === 'Liposuction') return p.type === 'liposuction';
                    return p.type === 'face' || p.type === 'non_surgical';
                  }).map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <span style={label}>Duration (hrs)</span>
              <input type="number" min={0.5} max={10} step={0.5} value={durationHours}
                onChange={e => setDurationHours(Number(e.target.value))} style={input} />
            </div>
            <div>
              <span style={label}>Surgeon</span>
              <select value={surgeonId ?? ''} onChange={e => setSurgeonId(Number(e.target.value))} style={input}>
                {providers.map(p => <option key={p.provider_id} value={p.provider_id}>{p.last_name}, {p.first_name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'includeContralateral', label: 'Include contralateral symmetry', val: includeContralateral, set: setIncludeContralateral },
              { key: 'includeNAR', label: 'Include nipple-areola reconstruction', val: includeNAR, set: setIncludeNAR },
            ].map(({ key, label: lbl, val, set }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
                  style={{ accentColor: '#c9a96e', width: 14, height: 14 }} />
                {lbl}
              </label>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={generating || !procedureName || !surgeonId}
          style={{
            ...btn('#060e1c', generating || !procedureName ? 'rgba(201,169,110,0.3)' : '#c9a96e'),
            width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: 14,
            opacity: !procedureName || !surgeonId ? 0.5 : 1,
          }}
        >
          {generating ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating…</> : <><Sparkles size={16} /> Generate Proposal</>}
        </button>
        {genError && <p style={{ color: '#e74c3c', fontSize: 12, marginTop: 8 }}>{genError}</p>}
      </div>

      {/* ── RIGHT: Preview ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!proposal ? (
          <div style={{ ...card, textAlign: 'center', padding: '60px 32px', border: '2px dashed rgba(201,169,110,0.2)' }}>
            <Sparkles size={36} color="rgba(201,169,110,0.3)" style={{ marginBottom: 12 }} />
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Fill in the procedure details and click Generate Proposal</div>
            <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12, marginTop: 6 }}>AI will build a complete cost breakdown + financing options</div>
          </div>
        ) : (
          <>
            {/* Proposal preview card */}
            <div style={{ background: '#0f1e35', border: '1px solid rgba(201,169,110,0.25)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>

              {/* Proposal header */}
              <div style={{ background: 'linear-gradient(135deg, #0a1628 0%, #1a2d4e 100%)', padding: '24px 28px', borderBottom: '1px solid rgba(201,169,110,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    {facility?.logo_url && (
                      <img src={facility.logo_url} alt="logo" style={{ height: 40, objectFit: 'contain', marginBottom: 8, display: 'block' }} />
                    )}
                    <div style={{ color: '#c9a96e', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{facility?.facility_name}</div>
                    {facilityAddress && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>{facilityAddress}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-rajdhani, sans-serif)' }}>Surgical Proposal</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{proposalDate}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Patient', value: patientName || '—' },
                    { label: 'Procedure', value: procedureName },
                    { label: 'Surgeon', value: surgeonName },
                  ].map(({ label: lbl, value }) => (
                    <div key={lbl} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{lbl}</div>
                      <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Patient summary */}
              {proposal.patientSummary && (
                <div style={{ padding: '16px 28px', background: 'rgba(201,169,110,0.05)', borderBottom: '1px solid rgba(201,169,110,0.1)' }}>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6, fontStyle: 'italic' }}>
                    "{proposal.patientSummary}"
                  </div>
                </div>
              )}

              {/* Line items */}
              <div style={{ padding: '20px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ color: '#c9a96e', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cost Breakdown</div>
                  <button onClick={generate} style={{ ...btn('rgba(255,255,255,0.4)', 'transparent', 'rgba(255,255,255,0.1)'), padding: '4px 10px', fontSize: 11 }}>
                    <RefreshCw size={11} /> Regenerate
                  </button>
                </div>

                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 30px', gap: 8, padding: '6px 10px', background: 'rgba(201,169,110,0.08)', borderRadius: 6, marginBottom: 4 }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Item</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Amount</div>
                  <div />
                </div>

                {proposal.lineItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 30px', gap: 8, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
                    <input
                      value={item.label}
                      onChange={e => updateLineItem(idx, 'label', e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.85)', fontSize: 13, outline: 'none', width: '100%' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>$</span>
                      <input
                        type="number"
                        value={item.amount}
                        onChange={e => updateLineItem(idx, 'amount', Number(e.target.value))}
                        style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 13, fontWeight: 600, outline: 'none', width: 70, textAlign: 'right' }}
                      />
                    </div>
                    <button onClick={() => removeLineItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.2)', display: 'flex' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                {/* Total */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 30px', gap: 8, padding: '10px 10px', background: 'rgba(201,169,110,0.12)', borderRadius: 8, marginTop: 6 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Total Estimate</div>
                  <div style={{ color: '#c9a96e', fontWeight: 700, fontSize: 16, textAlign: 'right' }}>{fmt(total)}</div>
                  <div />
                </div>
              </div>

              {/* Financing options */}
              {proposal.financingOptions?.length > 0 && (
                <div style={{ padding: '0 28px 24px' }}>
                  <div style={{ color: '#c9a96e', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Financing Options</div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${proposal.financingOptions.length}, 1fr)`, gap: 10 }}>
                    {proposal.financingOptions.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedFinancing(idx)}
                        style={{
                          background: selectedFinancing === idx ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.03)',
                          border: `1.5px solid ${selectedFinancing === idx ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.15s',
                        }}
                      >
                        {selectedFinancing === idx && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#c9a96e', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                            <Check size={10} /> SELECTED
                          </div>
                        )}
                        <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{opt.label}</div>
                        <div style={{ color: '#c9a96e', fontSize: 16, fontWeight: 700 }}>{fmt(opt.totalAmount)}</div>
                        {opt.monthlyPayment && (
                          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 3 }}>
                            {fmt(opt.monthlyPayment)}/mo × {opt.termMonths}mo
                          </div>
                        )}
                        {opt.discountApplied && (
                          <div style={{ color: '#2ecc71', fontSize: 10, marginTop: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={11} /> 5% courtesy discount</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {/* PDF download */}
              <PDFDownloadLink
                document={<ProposalDocument {...pdfProps} />}
                fileName={`proposal-${(patientName || 'patient').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`}
                style={btn('#060e1c', '#c9a96e')}
              >
                {({ loading }) => loading
                  ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Preparing PDF…</>
                  : <><Download size={15} /> Download Branded PDF</>}
              </PDFDownloadLink>

              {/* Send to patient */}
              <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 200 }}>
                <input
                  value={patientEmail}
                  onChange={e => setPatientEmail(e.target.value)}
                  placeholder="patient@email.com"
                  type="email"
                  style={{ ...input, flex: 1 }}
                />
                <button
                  onClick={sendToPatient}
                  disabled={sending || !patientEmail || sentSuccess}
                  style={{
                    ...btn(sentSuccess ? '#060e1c' : '#fff', sentSuccess ? '#2ecc71' : 'rgba(255,255,255,0.1)', sentSuccess ? '#2ecc71' : 'rgba(255,255,255,0.2)'),
                    opacity: !patientEmail ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  {sending ? <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                    : sentSuccess ? <><Check size={15} /> Sent!</>
                    : <><Send size={15} /> Send to Patient</>}
                </button>
              </div>
            </div>
            {sendError && <p style={{ color: '#e74c3c', fontSize: 12, marginTop: 8 }}>{sendError}</p>}
            {sentSuccess && <p style={{ color: '#2ecc71', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Check size={13} /> Proposal email sent successfully</p>}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
