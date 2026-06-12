import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, CheckCircle, AlertTriangle, X, Save, ToggleLeft, ToggleRight, Scale } from 'lucide-react';

interface ConsentTemplate {
  template_id: number;
  org_id: string;
  template_name: string;
  procedure_category: string;
  procedure_specific: string[];
  body_part: string;
  consent_title: string;
  introduction: string;
  procedure_description: string;
  risks_general: string[];
  risks_specific: string[];
  risks_anesthesia: string[];
  benefits: string[];
  alternatives: string[];
  financial_responsibility: string;
  photography_consent: string;
  no_guarantee_clause: string;
  revision_policy: string;
  version: number;
  is_active: boolean;
  effective_date: string;
  legally_reviewed: boolean;
  legal_review_date: string;
  legal_reviewer_notes: string;
}

interface Props {
  orgId: string;
}

const CATS = ['Breast', 'Body Contouring', 'Face & Neck', 'Liposuction', 'Reconstructive', 'Non-Surgical', 'General'];

const TEXTAREA: React.CSSProperties = {
  background: '#0d1e36', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 8,
  color: '#fff', padding: '10px 14px', fontSize: 14, width: '100%',
  outline: 'none', resize: 'vertical', minHeight: 100, fontFamily: 'inherit',
};
const INPUT: React.CSSProperties = {
  background: '#0d1e36', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 8,
  color: '#fff', padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none',
};
const LABEL: React.CSSProperties = {
  display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600,
  marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase',
};

function ArrayEditor({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={LABEL}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {value.map((item, i) => (
          <span key={i} style={{ background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: '#c9a96e', display: 'flex', alignItems: 'center', gap: 4 }}>
            {item}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#c9a96e', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ ...INPUT, flex: 1 }}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onChange([...value, draft.trim()]); setDraft(''); e.preventDefault(); } }}
          placeholder={`Add ${label.toLowerCase()} item and press Enter`}
        />
        <button
          onClick={() => { if (draft.trim()) { onChange([...value, draft.trim()]); setDraft(''); } }}
          style={{ background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.4)', color: '#c9a96e', borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontSize: 13 }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

const BLANK: Omit<ConsentTemplate, 'template_id'> = {
  org_id: '', template_name: '', procedure_category: 'Breast', procedure_specific: [],
  body_part: '', consent_title: '', introduction: '', procedure_description: '',
  risks_general: ['Bleeding', 'Infection', 'Scarring', 'Anesthesia reactions', 'Blood clots (DVT/PE)', 'Wound healing complications'],
  risks_specific: [], risks_anesthesia: ['Nausea and vomiting', 'Allergic reactions', 'Respiratory complications'],
  benefits: [], alternatives: ['Non-surgical alternatives', 'Delaying surgery', 'No treatment'],
  financial_responsibility: 'Patient is responsible for all fees not covered by insurance, including surgeon fees, facility fees, anesthesia fees, and any revision procedures.',
  photography_consent: 'I consent to before/after photographs for medical records and educational purposes, with the understanding that no identifying information will be disclosed without separate written consent.',
  no_guarantee_clause: 'No guarantee of results has been made or implied. Surgical outcomes vary based on individual patient factors.',
  revision_policy: '', version: 1, is_active: true,
  effective_date: new Date().toISOString().split('T')[0],
  legally_reviewed: false, legal_review_date: '', legal_reviewer_notes: '',
};

export default function ConsentTemplates({ orgId }: Props) {
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ConsentTemplate> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    supabase.schema('cr').from('informed_consent_templates')
      .select('*')
      .eq('org_id', orgId)
      .order('procedure_category')
      .then(({ data }) => { setTemplates(data ?? []); setLoading(false); });
  };

  useEffect(() => { load(); }, [orgId]);

  const startNew = () => {
    setEditing({ ...BLANK, org_id: orgId });
    setIsNew(true);
    setSaveStatus('idle');
  };

  const startEdit = (t: ConsentTemplate) => {
    setEditing({ ...t });
    setIsNew(false);
    setSaveStatus('idle');
  };

  const toggleActive = async (t: ConsentTemplate) => {
    await supabase.schema('cr').from('informed_consent_templates')
      .update({ is_active: !t.is_active }).eq('template_id', t.template_id);
    setTemplates(prev => prev.map(x => x.template_id === t.template_id ? { ...x, is_active: !x.is_active } : x));
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      if (isNew) {
        const { data, error } = await supabase.schema('cr').from('informed_consent_templates')
          .insert({ ...editing, org_id: orgId }).select().single();
        if (error) throw error;
        setTemplates(prev => [data, ...prev]);
      } else {
        const { error } = await supabase.schema('cr').from('informed_consent_templates')
          .update({ ...editing, updated_at: new Date().toISOString() })
          .eq('template_id', editing.template_id!);
        if (error) throw error;
        setTemplates(prev => prev.map(x => x.template_id === editing.template_id ? { ...x, ...editing } as ConsentTemplate : x));
      }
      setSaveStatus('saved');
      setTimeout(() => { setSaveStatus('idle'); setEditing(null); }, 1200);
    } catch { setSaveStatus('error'); } finally { setSaving(false); }
  };

  const filtered = filter === 'all' ? templates : templates.filter(t => t.procedure_category === filter);

  if (editing) {
    return (
      <div>
        {/* Editor header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h3 style={{ color: '#c9a96e', fontFamily: 'var(--font-rajdhani)', fontSize: 20, fontWeight: 700, margin: 0 }}>
              {isNew ? 'New Consent Template' : `Edit: ${editing.template_name}`}
            </h3>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>All fields populate automatically on patient consent forms</div>
          </div>
          <button onClick={() => setEditing(null)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <X size={14} /> Cancel
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={LABEL}>Template Name</label>
            <input style={INPUT} value={editing.template_name ?? ''} onChange={e => setEditing(p => ({ ...p!, template_name: e.target.value }))} placeholder="e.g. Breast Augmentation Consent" />
          </div>
          <div>
            <label style={LABEL}>Procedure Category</label>
            <select style={{ ...INPUT }} value={editing.procedure_category ?? 'Breast'} onChange={e => setEditing(p => ({ ...p!, procedure_category: e.target.value }))}>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL}>Consent Form Title</label>
            <input style={INPUT} value={editing.consent_title ?? ''} onChange={e => setEditing(p => ({ ...p!, consent_title: e.target.value }))} placeholder="e.g. Informed Consent for Breast Augmentation" />
          </div>
          <div>
            <label style={LABEL}>Body Part / Anatomy</label>
            <input style={INPUT} value={editing.body_part ?? ''} onChange={e => setEditing(p => ({ ...p!, body_part: e.target.value }))} placeholder="e.g. Breasts, Chest wall" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={LABEL}>Introduction Paragraph</label>
            <textarea style={TEXTAREA} value={editing.introduction ?? ''} onChange={e => setEditing(p => ({ ...p!, introduction: e.target.value }))} placeholder="This consent form is intended to inform you about the proposed surgical procedure…" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={LABEL}>Procedure Description</label>
            <textarea style={{ ...TEXTAREA, minHeight: 140 }} value={editing.procedure_description ?? ''} onChange={e => setEditing(p => ({ ...p!, procedure_description: e.target.value }))} placeholder="Detailed description of the procedure, technique, and approach…" />
          </div>
        </div>

        <ArrayEditor label="General Risks" value={editing.risks_general ?? []} onChange={v => setEditing(p => ({ ...p!, risks_general: v }))} />
        <ArrayEditor label="Procedure-Specific Risks" value={editing.risks_specific ?? []} onChange={v => setEditing(p => ({ ...p!, risks_specific: v }))} />
        <ArrayEditor label="Anesthesia Risks" value={editing.risks_anesthesia ?? []} onChange={v => setEditing(p => ({ ...p!, risks_anesthesia: v }))} />
        <ArrayEditor label="Expected Benefits" value={editing.benefits ?? []} onChange={v => setEditing(p => ({ ...p!, benefits: v }))} />
        <ArrayEditor label="Alternatives" value={editing.alternatives ?? []} onChange={v => setEditing(p => ({ ...p!, alternatives: v }))} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={LABEL}>Financial Responsibility Clause</label>
            <textarea style={TEXTAREA} value={editing.financial_responsibility ?? ''} onChange={e => setEditing(p => ({ ...p!, financial_responsibility: e.target.value }))} />
          </div>
          <div>
            <label style={LABEL}>Photography Consent Clause</label>
            <textarea style={TEXTAREA} value={editing.photography_consent ?? ''} onChange={e => setEditing(p => ({ ...p!, photography_consent: e.target.value }))} />
          </div>
          <div>
            <label style={LABEL}>No-Guarantee Clause</label>
            <textarea style={TEXTAREA} value={editing.no_guarantee_clause ?? ''} onChange={e => setEditing(p => ({ ...p!, no_guarantee_clause: e.target.value }))} />
          </div>
          <div>
            <label style={LABEL}>Revision Policy</label>
            <textarea style={TEXTAREA} value={editing.revision_policy ?? ''} onChange={e => setEditing(p => ({ ...p!, revision_policy: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24, padding: '16px', background: 'rgba(201,169,110,0.06)', borderRadius: 10, border: '1px solid rgba(201,169,110,0.15)' }}>
          <div>
            <label style={LABEL}>Effective Date</label>
            <input style={INPUT} type="date" value={editing.effective_date ?? ''} onChange={e => setEditing(p => ({ ...p!, effective_date: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ ...LABEL, marginBottom: 10 }}>Active</label>
            <button onClick={() => setEditing(p => ({ ...p!, is_active: !p!.is_active }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {editing.is_active
                ? <ToggleRight size={28} color="#2ecc71" />
                : <ToggleLeft size={28} color="rgba(255,255,255,0.3)" />}
              <span style={{ fontSize: 13, color: editing.is_active ? '#2ecc71' : 'rgba(255,255,255,0.3)' }}>{editing.is_active ? 'Active' : 'Inactive'}</span>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ ...LABEL, marginBottom: 10 }}>Legally Reviewed</label>
            <button onClick={() => setEditing(p => ({ ...p!, legally_reviewed: !p!.legally_reviewed }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {editing.legally_reviewed
                ? <Scale size={18} color="#c9a96e" />
                : <Scale size={18} color="rgba(255,255,255,0.2)" />}
              <span style={{ fontSize: 13, color: editing.legally_reviewed ? '#c9a96e' : 'rgba(255,255,255,0.3)' }}>{editing.legally_reviewed ? 'Reviewed' : 'Pending review'}</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={handleSave} disabled={saving} style={{ background: saving ? 'rgba(201,169,110,0.5)' : '#c9a96e', color: '#060e1c', border: 'none', borderRadius: 8, padding: '11px 28px', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Save size={16} />{saving ? 'Saving…' : isNew ? 'Create Template' : 'Save Changes'}
          </button>
          {saveStatus === 'saved' && <span style={{ color: '#2ecc71', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}><CheckCircle size={16} /> Saved</span>}
          {saveStatus === 'error' && <span style={{ color: '#e74c3c', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}><AlertTriangle size={16} /> Save failed</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', ...CATS].map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', borderColor: filter === c ? '#c9a96e' : 'rgba(255,255,255,0.15)', background: filter === c ? 'rgba(201,169,110,0.15)' : 'transparent', color: filter === c ? '#c9a96e' : 'rgba(255,255,255,0.5)' }}>
              {c === 'all' ? 'All Templates' : c}
            </button>
          ))}
        </div>
        <button onClick={startNew} style={{ background: '#c9a96e', color: '#060e1c', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> New Template
        </button>
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>Loading templates…</div>
        : filtered.length === 0
          ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.3)', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 12 }}>
              <Scale size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 15, marginBottom: 6 }}>No consent templates yet</div>
              <div style={{ fontSize: 13 }}>Create your first template to populate patient consent forms automatically</div>
            </div>
          )
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(t => (
                <div key={t.template_id} style={{ background: '#0a1628', border: '1px solid rgba(201,169,110,0.15)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{t.template_name}</span>
                      <span style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.25)', color: '#c9a96e', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>{t.procedure_category}</span>
                      {t.legally_reviewed && <span style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', color: '#2ecc71', fontSize: 11, padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}><Scale size={9} /> Reviewed</span>}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                      v{t.version} · {t.risks_general?.length ?? 0} general risks · {t.risks_specific?.length ?? 0} specific risks · Effective {t.effective_date}
                    </div>
                  </div>
                  <button onClick={() => toggleActive(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {t.is_active ? <ToggleRight size={26} color="#2ecc71" /> : <ToggleLeft size={26} color="rgba(255,255,255,0.25)" />}
                  </button>
                  <button onClick={() => startEdit(t)} style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.3)', color: '#c9a96e', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Edit2 size={13} /> Edit
                  </button>
                </div>
              ))}
            </div>
          )
      }
    </div>
  );
}
