import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Send, ExternalLink, Clock, CheckCircle2, Eye, FileSignature,
  Loader2, RefreshCw, ChevronRight, User, Mail,
} from 'lucide-react';

// Shared platform functions live on the surgery site; sibling apps set VITE_SHARED_FN_BASE
const FN_BASE: string = (import.meta as any).env?.VITE_SHARED_FN_BASE ?? '';

interface Template {
  template_id: number;
  template_name: string;
  procedure_category: string;
  consent_statement: string;
  risks_general: string[];
  risks_specific: string[];
  risks_anesthesia: string[];
  benefits: string[];
  alternatives: string[];
  no_guarantee_clause?: string;
  photography_clause?: string;
  is_active: boolean;
}

interface Provider {
  provider_id: number;
  first_name: string;
  last_name: string;
  credential: string;
}

interface SentConsent {
  consent_id: string;
  patient_first_name: string;
  patient_last_name: string;
  patient_email: string;
  procedure_name: string;
  surgeon_name: string;
  status: string;
  sent_at: string;
  signed_at: string | null;
  viewed_at: string | null;
  created_at: string;
}

interface Props { orgId: string }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:  { label: 'Pending',  color: '#92400e', bg: '#fffbeb', icon: <Clock size={12} /> },
  sent:     { label: 'Sent',     color: '#1d4ed8', bg: '#eff6ff', icon: <Send size={12} /> },
  viewed:   { label: 'Viewed',   color: '#6d28d9', bg: '#f5f3ff', icon: <Eye size={12} /> },
  signed:   { label: 'Signed',   color: '#166534', bg: '#f0fdf4', icon: <CheckCircle2 size={12} /> },
  voided:   { label: 'Voided',   color: '#6b7280', bg: '#f9fafb', icon: <ChevronRight size={12} /> },
};

const CATEGORY_LABELS: Record<string, string> = {
  breast: 'Breast', body: 'Body Contouring', face: 'Face & Neck',
  liposuction: 'Liposuction', reconstruction: 'Reconstructive',
  non_surgical: 'Non-Surgical', general: 'General',
};

const input: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const label: React.CSSProperties = {
  color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6,
};
export default function ConsentSender({ orgId }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [sentConsents, setSentConsents] = useState<SentConsent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Form state
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [surgeonId, setSurgeonId]   = useState<number | ''>('');
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [email, setEmail]           = useState('');
  const [dob, setDob]               = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [facilityName, setFacilityName]   = useState('');

  // Send state
  const [sending, setSending]         = useState(false);
  const [sendResult, setSendResult]   = useState<{ url: string; token: string } | null>(null);
  const [sendError, setSendError]     = useState('');

  // Refresh
  const [refreshing, setRefreshing]   = useState(false);

  useEffect(() => {
    // Load templates
    supabase.schema('cr').from('informed_consent_templates')
      .select('template_id,template_name,procedure_category,consent_statement,risks_general,risks_specific,risks_anesthesia,benefits,alternatives,no_guarantee_clause,photography_clause,is_active')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('template_name')
      .then(({ data }) => setTemplates(data ?? []));

    // Load providers
    supabase.schema('cr').from('providers')
      .select('provider_id,first_name,last_name,credential')
      .eq('org_id', orgId).eq('is_active', true).order('last_name')
      .then(({ data }) => {
        const provs = data ?? [];
        setProviders(provs);
        if (provs.length > 0) setSurgeonId(provs[0].provider_id);
      });

    // Load facility name
    supabase.schema('cr').from('facilities')
      .select('facility_name').eq('org_id', orgId).limit(1).single()
      .then(({ data }) => { if (data) setFacilityName(data.facility_name); });

    loadHistory();
  }, [orgId]);

  const loadHistory = async () => {
    setRefreshing(true);
    const { data } = await supabase.schema('cr').from('patient_consents')
      .select('consent_id,patient_first_name,patient_last_name,patient_email,procedure_name,surgeon_name,status,sent_at,signed_at,viewed_at,created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50);
    setSentConsents(data ?? []);
    setLoadingHistory(false);
    setRefreshing(false);
  };

  const selectedTemplate = templates.find(t => t.template_id === templateId);
  const selectedSurgeon  = providers.find(p => p.provider_id === surgeonId);
  const surgeonName = selectedSurgeon
    ? `${selectedSurgeon.first_name} ${selectedSurgeon.last_name}${selectedSurgeon.credential ? `, ${selectedSurgeon.credential}` : ''}`
    : '';

  // When template changes, pre-fill procedure name from category
  const handleTemplateChange = (id: number | '') => {
    setTemplateId(id);
    if (id) {
      const t = templates.find(t => t.template_id === id);
      if (t) setProcedureName(prev => prev || t.template_name.replace(' Consent', '').replace(' Informed Consent', ''));
    }
  };

  const sendViaEmail = async () => {
    if (!templateId || !firstName || !lastName || !email || !procedureName) return;
    setSending(true);
    setSendError('');
    setSendResult(null);

    const t = selectedTemplate!;
    try {
      const res = await fetch(`${FN_BASE}/.netlify/functions/send-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          templateId,
          templateName: t.template_name,
          patientFirstName: firstName,
          patientLastName: lastName,
          patientEmail: email,
          patientDob: dob || undefined,
          procedureName,
          surgeonName,
          facilityName: facilityName || 'Our Practice',
          consentStatement: t.consent_statement,
          risksGeneral: t.risks_general,
          risksSpecific: t.risks_specific,
          risksAnesthesia: t.risks_anesthesia,
          benefits: t.benefits,
          alternatives: t.alternatives,
          noGuaranteeClause: t.no_guarantee_clause,
          photographyClause: t.photography_clause,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send');
      setSendResult({ url: data.consentUrl, token: data.token });
      // Reset form + reload history
      setFirstName(''); setLastName(''); setEmail(''); setDob('');
      setTimeout(loadHistory, 1000);
    } catch (e: any) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  };

  const openInPerson = async () => {
    if (!templateId || !firstName || !lastName || !procedureName) return;
    setSending(true);
    setSendError('');
    const t = selectedTemplate!;
    try {
      const res = await fetch(`${FN_BASE}/.netlify/functions/send-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId, templateId, templateName: t.template_name,
          patientFirstName: firstName, patientLastName: lastName,
          patientEmail: email || 'no-email@placeholder.local',
          patientDob: dob || undefined,
          procedureName, surgeonName, facilityName: facilityName || 'Our Practice',
          consentStatement: t.consent_statement,
          risksGeneral: t.risks_general, risksSpecific: t.risks_specific,
          risksAnesthesia: t.risks_anesthesia, benefits: t.benefits,
          alternatives: t.alternatives, noGuaranteeClause: t.no_guarantee_clause,
          photographyClause: t.photography_clause,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to open');
      window.open(data.consentUrl, '_blank');
      setSendResult({ url: data.consentUrl, token: data.token });
      setFirstName(''); setLastName(''); setEmail(''); setDob('');
      setTimeout(loadHistory, 1000);
    } catch (e: any) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  };

  const canSend = !!templateId && !!firstName && !!lastName && !!procedureName;

  return (
    <div>
      {/* ── Send consent form ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, marginBottom: 32 }}>

        {/* Patient info */}
        <div>
          <div style={{ color: '#c9a96e', fontSize: 13, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={15} /> Patient Info
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <span style={label}>First Name *</span>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" style={input} />
            </div>
            <div>
              <span style={label}>Last Name *</span>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" style={input} />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <span style={label}>Email (for remote signing)</span>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="patient@email.com" style={input} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <span style={label}>Date of Birth</span>
            <input value={dob} onChange={e => setDob(e.target.value)} type="date" style={input} />
          </div>
        </div>

        {/* Procedure + template */}
        <div>
          <div style={{ color: '#c9a96e', fontSize: 13, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSignature size={15} /> Procedure & Consent
          </div>

          <div style={{ marginBottom: 10 }}>
            <span style={label}>Procedure Name *</span>
            <input value={procedureName} onChange={e => setProcedureName(e.target.value)} placeholder="e.g. Breast Augmentation" style={input} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <span style={label}>Consent Template *</span>
              <select value={templateId} onChange={e => handleTemplateChange(Number(e.target.value) || '')} style={input}>
                <option value="">— select template —</option>
                {Object.entries(CATEGORY_LABELS).map(([key, catLabel]) => {
                  const cats = templates.filter(t => t.procedure_category === key);
                  if (!cats.length) return null;
                  return (
                    <optgroup key={key} label={catLabel}>
                      {cats.map(t => <option key={t.template_id} value={t.template_id}>{t.template_name}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div>
              <span style={label}>Surgeon</span>
              <select value={surgeonId} onChange={e => setSurgeonId(Number(e.target.value) || '')} style={input}>
                {providers.map(p => <option key={p.provider_id} value={p.provider_id}>{p.last_name}, {p.first_name}</option>)}
              </select>
            </div>
          </div>

          {/* Selected template preview */}
          {selectedTemplate && (
            <div style={{ background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              <span style={{ color: '#c9a96e', fontWeight: 600 }}>{selectedTemplate.template_name}</span>
              <span style={{ marginLeft: 8 }}>· {selectedTemplate.risks_general?.length ?? 0} general risks · {selectedTemplate.risks_specific?.length ?? 0} specific risks</span>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              onClick={sendViaEmail}
              disabled={!canSend || !email || sending}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: canSend && email ? '#c9a96e' : 'rgba(201,169,110,0.2)',
                color: canSend && email ? '#060e1c' : 'rgba(255,255,255,0.3)',
                border: 'none', opacity: !canSend || !email ? 0.6 : 1,
              }}
            >
              {sending ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Mail size={14} />}
              Send Email Link
            </button>

            <button
              onClick={openInPerson}
              disabled={!canSend || sending}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: canSend ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                color: canSend ? '#fff' : 'rgba(255,255,255,0.3)',
                border: `1px solid ${canSend ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                opacity: !canSend ? 0.6 : 1,
              }}
            >
              <ExternalLink size={14} /> Open for iPad Signing
            </button>
          </div>
          {sendError && <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{sendError}</p>}
        </div>
      </div>

      {/* Success banner */}
      {sendResult && (
        <div style={{ background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: 10, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <CheckCircle2 size={18} color="#2ecc71" />
          <div style={{ flex: 1 }}>
            <div style={{ color: '#2ecc71', fontSize: 13, fontWeight: 600 }}>Consent form sent successfully</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>Patient can sign at: <span style={{ color: '#c9a96e' }}>{sendResult.url}</span></div>
          </div>
          <a href={sendResult.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#c9a96e', fontSize: 12, fontWeight: 600 }}>
            Preview <ExternalLink size={12} />
          </a>
        </div>
      )}

      {/* ── History ─────────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(201,169,110,0.1)', paddingTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ color: '#c9a96e', fontSize: 13, fontWeight: 700 }}>Consent History</div>
          <button onClick={loadHistory} disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer' }}>
            <RefreshCw size={11} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}} /> Refresh
          </button>
        </div>

        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading…</div>
        ) : sentConsents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', border: '2px dashed rgba(255,255,255,0.08)', borderRadius: 10, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            No consents sent yet. Use the form above to send your first consent.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sentConsents.map(c => {
              const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending;
              return (
                <div key={c.consent_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: '#0f1e35', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                  {/* Status badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: sc.bg, color: sc.color, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {sc.icon} {sc.label}
                  </div>

                  {/* Patient + procedure */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{c.patient_first_name} {c.patient_last_name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                      {c.procedure_name} {c.surgeon_name ? `· ${c.surgeon_name}` : ''}
                    </div>
                  </div>

                  {/* Email */}
                  {c.patient_email && c.patient_email !== 'no-email@placeholder.local' && (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, flexShrink: 0 }}>{c.patient_email}</div>
                  )}

                  {/* Timestamp */}
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, flexShrink: 0 }}>
                    {c.signed_at
                      ? `Signed ${new Date(c.signed_at).toLocaleDateString()}`
                      : c.viewed_at
                        ? `Viewed ${new Date(c.viewed_at).toLocaleDateString()}`
                        : c.sent_at
                          ? `Sent ${new Date(c.sent_at).toLocaleDateString()}`
                          : `Created ${new Date(c.created_at).toLocaleDateString()}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
