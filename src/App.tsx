import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import RevelaLogin from './RevelaLogin'
import NewPatientRevela from './components/NewPatientRevela'
import RevelaDashboard from './pages/RevelaDashboard'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const BRIDGE = `${SUPABASE_URL}/functions/v1/cross-app-bridge`

async function bridge(action: string, body: Record<string, any> = {}) {
  const res = await fetch(BRIDGE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ action, ...body }),
  })
  return res.json()
}

type AuthMode = 'loading' | 'direct_login' | 'bridge' | 'authenticated'

function LegacyRevelaApp() {
  const [searchParams] = useSearchParams()
  const urlToken = searchParams.get('token')
  const [mode, setMode] = useState<AuthMode>('loading')
  const [session, setSession] = useState<any>(null)
  const [encounter, setEncounter] = useState<any>(null)
  const [intake, setIntake] = useState<any>(null)
  const [meds, setMeds] = useState<any[]>([])
  const [tab, setTab] = useState<'chart' | 'prognote' | 'opnote' | 'postop'>('chart')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')
  const [orgId, setOrgId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [showNewPatient, setShowNewPatient] = useState(false)

  const [prognote, setPrognote] = useState({ pain_level: 0, progress_notes: '', plan: '' })
  const [opnote, setOpnote] = useState({ procedure_name: '', anesthesia: '', duration_mins: 0, complications: '', notes: '' })
  const [postop, setPostop] = useState({ follow_up_date: '', wound_status: '', instructions: '' })

  useEffect(() => {
    if (urlToken) {
      setMode('bridge')
      bridge('get_encounter', { token: urlToken }).then(data => {
        if (data.error) { setError(data.error); return }
        setSession(data.session)
        setEncounter(data.encounter)
        setIntake(data.intake)
        setMeds(data.medications ?? [])
        if (data.session?.org_id) setOrgId(data.session.org_id)
        if (data.session?.provider_id) setUserId(data.session.provider_id)
        if (data.session?.provider_email) setUserEmail(data.session.provider_email)
        if (data.encounter?.progress_notes) setPrognote(p => ({ ...p, progress_notes: data.encounter.progress_notes }))
        setMode('authenticated')
      })
    } else {
      setMode('direct_login')
    }
  }, [urlToken])

  const handleDirectAuth = async (uid: string, oid: string, _role: string) => {
    setUserId(uid)
    setOrgId(oid)
    try {
      const { supabase } = await import('./lib/supabaseClient')
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setUserEmail(user.email)
    } catch {}
    setMode('authenticated')
  }

  const saveNote = async (noteType: string, noteData: any) => {
    setSaving(true); setSaved(false)
    try {
      if (urlToken) {
        const res = await bridge('save_note', { token: urlToken, note_type: noteType, note_data: noteData })
        if (res.error) throw new Error(res.error)
      } else {
        const { supabase } = await import('./lib/supabaseClient')
        const table = noteType === 'surgical_prognote' ? 'surgical_prognote'
          : noteType === 'operative_notes' ? 'operative_notes'
          : 'postop_plan'
        const { error } = await supabase.schema('cr').from(table)
          .upsert({ ...noteData, org_id: orgId }, { onConflict: 'encounter_id' })
        if (error) throw new Error(error.message)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (mode === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#060e1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#c9a96e', fontSize: 14, fontFamily: 'sans-serif', opacity: 0.6 }}>Loading Revela…</div>
      </div>
    )
  }

  if (mode === 'direct_login') {
    return <RevelaLogin onAuthenticated={handleDirectAuth} />
  }

  const pt = encounter || {}
  const tabs = [
    { id: 'chart', label: 'Chart' },
    { id: 'prognote', label: 'Pro Note' },
    { id: 'opnote', label: 'Op Note' },
    { id: 'postop', label: 'Post-Op' },
  ]

  const S = {
    app:    { minHeight: '100vh', background: '#060e1c', fontFamily: 'sans-serif', color: '#fff' } as React.CSSProperties,
    bar:    { background: '#0a1628', borderBottom: '1px solid rgba(201,169,110,0.15)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
    tabs:   { display: 'flex', gap: 4, padding: '0 24px', background: '#060e1c', borderBottom: '1px solid rgba(255,255,255,0.06)' } as React.CSSProperties,
    tab:    (a: boolean) => ({ padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: a ? 600 : 400, color: a ? '#c9a96e' : 'rgba(255,255,255,0.4)', borderBottom: a ? '2px solid #c9a96e' : '2px solid transparent' } as React.CSSProperties),
    body:   { padding: '24px', maxWidth: 900, margin: '0 auto' } as React.CSSProperties,
    card:   { background: '#0a1628', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '20px 24px', marginBottom: 16 } as React.CSSProperties,
    lbl:    { fontSize: 10, color: 'rgba(201,169,110,0.6)', letterSpacing: '1.2px', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' },
    val:    { fontSize: 14, color: '#fff', lineHeight: 1.6 } as React.CSSProperties,
    inp:    { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 12 },
    ta:     { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 12, minHeight: 100, resize: 'vertical' as const },
    save:   { padding: '10px 28px', background: '#c9a96e', border: 'none', borderRadius: 8, color: '#060e1c', fontSize: 13, fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
    newPtBtn: { padding: '7px 16px', background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 8, color: '#c9a96e', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.5px' } as React.CSSProperties,
  }

  return (
    <div style={S.app}>
      <div style={S.bar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <polygon points="16,2 30,16 16,30 2,16" fill="none" stroke="#c9a96e" strokeWidth="1.5"/>
            <polygon points="16,7 25,16 16,25 7,16" fill="#c9a96e" opacity="0.3"/>
            <polygon points="16,11 21,16 16,21 11,16" fill="#c9a96e"/>
          </svg>
          <span style={{ color: '#c9a96e', fontSize: 16, fontWeight: 600 }}>Revela</span>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Plastic Surgery EMR</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {!urlToken && (
            <button onClick={() => setShowNewPatient(true)} style={S.newPtBtn}>+ New Patient</button>
          )}
          {saved && <span style={{ fontSize: 12, color: '#34c759' }}>✓ Saved</span>}
          {error && <span style={{ fontSize: 12, color: '#f87171' }}>{error}</span>}
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {pt.patient_name ?? (urlToken ? 'No patient' : userEmail || 'Provider')} {pt.mrn ? `· MRN ${pt.mrn}` : ''}
          </span>
          {urlToken
            ? <span style={{ fontSize: 11, background: 'rgba(0,212,255,0.1)', color: '#00d4ff', padding: '3px 8px', borderRadius: 4 }}>Bridge</span>
            : <span style={{ fontSize: 11, background: 'rgba(201,169,110,0.1)', color: '#c9a96e', padding: '3px 8px', borderRadius: 4 }}>Direct</span>
          }
        </div>
      </div>

      <div style={S.tabs}>
        {tabs.map(t => <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id as any)}>{t.label}</button>)}
      </div>

      <div style={S.body}>
        {tab === 'chart' && (
          <>
            {!encounter && !urlToken && (
              <div style={{ ...S.card, textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>No patient selected</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>Click + New Patient to register a patient, or access an encounter via PatientTracForge.</div>
                <button onClick={() => setShowNewPatient(true)} style={S.save}>+ New Patient</button>
              </div>
            )}
            {(encounter || urlToken) && (
              <div style={S.card}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
                  {[
                    { l: 'Patient', v: pt.patient_name ?? '—' },
                    { l: 'MRN', v: pt.mrn ?? '—' },
                    { l: 'DOB', v: pt.dob ?? '—' },
                    { l: 'Provider', v: pt.provider_name ?? '—' },
                    { l: 'Facility', v: pt.facility_name ?? '—' },
                    { l: 'Encounter', v: pt.encounter_id ?? '—' },
                  ].map(f => (
                    <div key={f.l}>
                      <span style={S.lbl}>{f.l}</span>
                      <span style={S.val}>{f.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {intake && (
              <div style={S.card}>
                <span style={S.lbl}>AI Intake Summary</span>
                <p style={{ ...S.val, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>{intake.clinical_summary ?? intake.chief_complaint ?? '—'}</p>
                {intake.suggested_icd_codes?.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                    {intake.suggested_icd_codes.map((c: string) => (
                      <span key={c} style={{ fontSize: 11, background: 'rgba(0,212,255,0.1)', color: '#00d4ff', padding: '2px 8px', borderRadius: 4 }}>{c}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {meds.length > 0 && (
              <div style={S.card}>
                <span style={S.lbl}>Current Medications</span>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginTop: 8 }}>
                  {meds.map((m: any, i: number) => (
                    <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{m.medication_name} {m.dosage} — {m.frequency}</div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'prognote' && (
          <div style={S.card}>
            <span style={S.lbl}>Progress Note</span>
            <label style={{ ...S.lbl, marginTop: 16 }}>Pain Level (0–10)</label>
            <input type="number" min={0} max={10} value={prognote.pain_level}
              onChange={e => setPrognote(p => ({ ...p, pain_level: Number(e.target.value) }))} style={S.inp}/>
            <label style={S.lbl}>Progress Notes</label>
            <textarea value={prognote.progress_notes}
              onChange={e => setPrognote(p => ({ ...p, progress_notes: e.target.value }))} style={S.ta}/>
            <label style={S.lbl}>Plan</label>
            <textarea value={prognote.plan}
              onChange={e => setPrognote(p => ({ ...p, plan: e.target.value }))} style={{ ...S.ta, minHeight: 80 }}/>
            <button onClick={() => saveNote('surgical_prognote', prognote)} disabled={saving} style={S.save}>
              {saving ? 'Saving…' : 'Save Progress Note'}
            </button>
          </div>
        )}

        {tab === 'opnote' && (
          <div style={S.card}>
            <span style={S.lbl}>Operative Note</span>
            {[
              { l: 'Procedure Name', k: 'procedure_name', ta: false },
              { l: 'Anesthesia Type', k: 'anesthesia', ta: false },
              { l: 'Duration (mins)', k: 'duration_mins', ta: false },
              { l: 'Complications', k: 'complications', ta: true },
              { l: 'Operative Notes', k: 'notes', ta: true },
            ].map(f => (
              <div key={f.k}>
                <label style={{ ...S.lbl, marginTop: 14 }}>{f.l}</label>
                {f.ta
                  ? <textarea value={(opnote as any)[f.k]} onChange={e => setOpnote(p => ({ ...p, [f.k]: e.target.value }))} style={S.ta}/>
                  : <input value={(opnote as any)[f.k]} onChange={e => setOpnote(p => ({ ...p, [f.k]: f.k === 'duration_mins' ? Number(e.target.value) : e.target.value }))} style={S.inp}/>
                }
              </div>
            ))}
            <button onClick={() => saveNote('operative_notes', opnote)} disabled={saving} style={S.save}>
              {saving ? 'Saving…' : 'Save Operative Note'}
            </button>
          </div>
        )}

        {tab === 'postop' && (
          <div style={S.card}>
            <span style={S.lbl}>Post-Op Plan</span>
            <label style={{ ...S.lbl, marginTop: 16 }}>Follow-Up Date</label>
            <input type="date" value={postop.follow_up_date}
              onChange={e => setPostop(p => ({ ...p, follow_up_date: e.target.value }))} style={S.inp}/>
            <label style={S.lbl}>Wound Status</label>
            <input value={postop.wound_status}
              onChange={e => setPostop(p => ({ ...p, wound_status: e.target.value }))} style={S.inp}/>
            <label style={S.lbl}>Patient Instructions</label>
            <textarea value={postop.instructions}
              onChange={e => setPostop(p => ({ ...p, instructions: e.target.value }))} style={S.ta}/>
            <button onClick={() => saveNote('postop_plan', postop)} disabled={saving} style={S.save}>
              {saving ? 'Saving…' : 'Save Post-Op Plan'}
            </button>
          </div>
        )}
      </div>

      {showNewPatient && orgId && (
        <NewPatientRevela
          orgId={orgId}
          providerId={userId}
          onPatientCreated={() => {
            setShowNewPatient(false)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
          }}
          onClose={() => setShowNewPatient(false)}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<RevelaDashboard />} />
        <Route path="/legacy" element={<LegacyRevelaApp />} />
        <Route path="/" element={<Navigate to="/legacy" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
