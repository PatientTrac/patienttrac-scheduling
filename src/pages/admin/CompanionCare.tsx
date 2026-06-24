import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Activity, AlertTriangle, HeartPulse, Pill, Utensils, Dumbbell,
  ClipboardList, UserPlus, RefreshCw, X, Copy, CheckCircle2, ChevronRight,
  FileText, Pencil, Save, Plus, MessageSquare, Send,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// ── Types ───────────────────────────────────────────────────
interface RosterRow {
  patient_id: number
  org_id: string
  doses_logged_7d: number
  last_checkin: string | null
  open_alerts: number
  urgent_alerts: number
  last_vital_at: string | null
  unread_from_patient: number
}
interface Overview {
  patient_id: number
  adherence_7d: number
  medications: { id: number; name: string; dose: string | null; frequency: string | null; active: boolean }[]
  journal: { date: string; mood: number | null; pain: number | null; note: string | null; flagged: boolean }[]
  vitals: { type: string; value: number; unit: string | null; at: string }[]
  diet: { meal: string | null; description: string | null; at: string }[]
  activity: { name: string; detail: string | null; at: string }[]
  alerts: { id: number; kind: string; detail: string | null; severity: string; resolved: boolean; at: string }[]
  education_count: number
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString() : '—')
const fmtDateTime = (s: string) => new Date(s).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function CompanionCare() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<number | null>(null)

  // Roster + patient names
  const roster = useQuery({
    queryKey: ['companion-roster'],
    queryFn: async () => {
      const { data: rows, error } = await supabase.schema('cr').from('companion_roster').select('*')
      if (error) throw error
      const list = (rows ?? []) as RosterRow[]
      const ids = list.map(r => r.patient_id)
      const names: Record<number, string> = {}
      if (ids.length) {
        const { data: pts } = await supabase.schema('cr').from('patient').select('patient_id, first_name, last_name').in('patient_id', ids)
        for (const p of (pts ?? []) as { patient_id: number; first_name: string; last_name: string }[]) {
          names[p.patient_id] = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || `Patient #${p.patient_id}`
        }
      }
      return list.map(r => ({ ...r, name: names[r.patient_id] || `Patient #${r.patient_id}` }))
    },
  })

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <div className="section-heading mb-1">Patient Companion</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Care Monitoring</h1>
        </div>
        <button onClick={() => roster.refetch()} className="flex items-center gap-2 text-xs text-slate-400 hover:text-gold-400">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <EnrollBox />

      {/* Roster */}
      <div className="hud-panel p-5">
        <div className="section-heading mb-4">Enrolled Patients</div>
        {roster.isLoading && <div className="text-sm text-slate-500">Loading roster…</div>}
        {roster.error && <div className="text-sm text-red-400">Failed to load roster.</div>}
        {roster.data && roster.data.length === 0 && (
          <div className="text-sm text-slate-500">No patients enrolled in Companion yet. Issue an invite above to enroll one.</div>
        )}
        {roster.data && roster.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-500/10">
                  {['Patient', 'Doses (7d)', 'Last check-in', 'Last vital', 'Alerts', ''].map(h => (
                    <th key={h} className="py-2 px-3 text-left font-mono text-slate-500 uppercase tracking-widest text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.data.map(r => (
                  <tr key={r.patient_id} className="border-b border-white/5 hover:bg-gold-500/5 cursor-pointer" onClick={() => setSelected(r.patient_id)}>
                    <td className="py-2.5 px-3 text-slate-200">
                      <span className="inline-flex items-center gap-2">{r.name}
                        {r.unread_from_patient > 0 && <span className="badge badge-pending inline-flex items-center gap-1"><MessageSquare size={11} />{r.unread_from_patient}</span>}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{r.doses_logged_7d}</td>
                    <td className="py-2.5 px-3 text-slate-400">{fmtDate(r.last_checkin)}</td>
                    <td className="py-2.5 px-3 text-slate-400">{fmtDate(r.last_vital_at)}</td>
                    <td className="py-2.5 px-3">
                      {r.urgent_alerts > 0 ? <span className="badge badge-urgent">{r.urgent_alerts} urgent</span>
                        : r.open_alerts > 0 ? <span className="badge badge-pending">{r.open_alerts} open</span>
                        : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right"><ChevronRight size={15} className="text-slate-600" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected !== null && <PatientDrawer patientId={selected} onClose={() => setSelected(null)} onChanged={() => { qc.invalidateQueries({ queryKey: ['companion-roster'] }) }} />}
    </div>
  )
}

// ── Enroll / invite box ─────────────────────────────────────
function EnrollBox() {
  const [pid, setPid] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const m = useMutation({
    mutationFn: async (patientId: number) => {
      const { data, error } = await supabase.schema('cr').rpc('create_patient_invite', { p_patient_id: patientId })
      if (error) throw error
      return data as string
    },
    onSuccess: (token) => { setCode(token); setCopied(false) },
  })
  return (
    <div className="hud-panel p-5">
      <div className="section-heading mb-3">Enroll a Patient</div>
      <div className="flex items-center gap-3 flex-wrap">
        <UserPlus size={16} className="text-gold-400" />
        <input value={pid} onChange={e => setPid(e.target.value)} placeholder="Patient ID"
          className="bg-navy-900 border border-white/10 rounded px-3 py-2 text-sm text-slate-200 w-36 focus:border-gold-500 outline-none" />
        <button onClick={() => { const n = Number(pid); if (n) m.mutate(n) }} disabled={m.isPending}
          className="bg-gold-500 text-navy-950 rounded px-4 py-2 text-sm font-medium hover:bg-gold-400 disabled:opacity-50">
          {m.isPending ? 'Generating…' : 'Generate invite code'}
        </button>
        {m.error && <span className="text-xs text-red-400">{(m.error as Error).message}</span>}
      </div>
      {code && (
        <div className="mt-3 flex items-center gap-3 bg-navy-900 border border-gold-500/20 rounded px-4 py-3">
          <span className="font-mono text-sm text-gold-300 break-all">{code}</span>
          <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true) }} className="text-slate-400 hover:text-gold-400 flex items-center gap-1 text-xs">
            {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      <p className="text-xs text-slate-500 mt-3">Share this single-use code with the patient — they enter it in the Companion app to link their account. Codes expire in 14 days.</p>
    </div>
  )
}

// ── Patient detail drawer ───────────────────────────────────
function PatientDrawer({ patientId, onClose, onChanged }: { patientId: number; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient()
  const ov = useQuery({
    queryKey: ['companion-overview', patientId],
    queryFn: async () => {
      const { data, error } = await supabase.schema('cr').rpc('companion_patient_overview', { p_patient_id: patientId })
      if (error) throw error
      return data as Overview
    },
  })
  const resolve = useMutation({
    mutationFn: async (alertId: number) => {
      const { error } = await supabase.schema('cr').from('companion_alert').update({ resolved: true }).eq('id', alertId)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companion-overview', patientId] }); onChanged() },
  })
  const o = ov.data

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-full max-w-xl h-full overflow-y-auto bg-navy-900 border-l border-gold-500/20 p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="section-heading mb-1">Companion overview</div>
            <h2 className="font-display font-bold text-xl text-slate-100">Patient #{patientId}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200"><X size={18} /></button>
        </div>

        {ov.isLoading && <div className="text-sm text-slate-500">Loading…</div>}
        {ov.error && <div className="text-sm text-red-400">{(ov.error as Error).message}</div>}

        {o && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat icon={Pill} color="text-emerald-400" label="Doses logged (7d)" value={o.adherence_7d} />
              <Stat icon={Activity} color="text-blue-400" label="AI questions asked" value={o.education_count} />
            </div>

            {/* Care plan — author-controlled; the only text the Companion AI may explain */}
            <CarePlanEditor patientId={patientId} onChanged={onChanged} />

            {/* Patient ↔ care-team messages */}
            <MessagesPanel patientId={patientId} onChanged={onChanged} />

            {/* Alerts */}
            {o.alerts.filter(a => !a.resolved).length > 0 && (
              <Section icon={AlertTriangle} title="Open alerts" tone="amber">
                <div className="space-y-2">
                  {o.alerts.filter(a => !a.resolved).map(a => (
                    <div key={a.id} className={cn('flex items-start justify-between gap-3 rounded px-3 py-2 border', a.severity === 'urgent' ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/20 bg-amber-500/5')}>
                      <div>
                        <div className={cn('text-xs font-medium', a.severity === 'urgent' ? 'text-red-300' : 'text-amber-300')}>{a.kind.replace('_', ' ')}</div>
                        <div className="text-xs text-slate-400">{a.detail} · {fmtDateTime(a.at)}</div>
                      </div>
                      <button onClick={() => resolve.mutate(a.id)} className="text-xs text-slate-400 hover:text-emerald-400 whitespace-nowrap">Resolve</button>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Journal */}
            <Section icon={ClipboardList} title="Recent check-ins">
              {o.journal.length === 0 ? <Empty /> : (
                <div className="space-y-1.5">
                  {o.journal.map((j, i) => (
                    <div key={i} className={cn('flex items-center justify-between text-xs rounded px-3 py-2', j.flagged ? 'bg-red-500/5 border border-red-500/20' : 'bg-white/5')}>
                      <span className="text-slate-300">Pain {j.pain ?? '—'}/10{j.note ? ` · ${j.note}` : ''}</span>
                      <span className="text-slate-500">{fmtDate(j.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Medications */}
            <Section icon={Pill} title="Medications">
              {o.medications.length === 0 ? <Empty /> : (
                <div className="space-y-1.5">
                  {o.medications.map(m => (
                    <div key={m.id} className="flex items-center justify-between text-xs bg-white/5 rounded px-3 py-2">
                      <span className="text-slate-300">{m.name}{m.dose ? ` · ${m.dose}` : ''}</span>
                      <span className="text-slate-500">{m.frequency}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Vitals */}
            <Section icon={HeartPulse} title="Recent vitals">
              {o.vitals.length === 0 ? <Empty /> : (
                <div className="space-y-1.5">
                  {o.vitals.slice(0, 8).map((v, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-white/5 rounded px-3 py-2">
                      <span className="text-slate-300 capitalize">{v.type.replace('_', ' ')}</span>
                      <span className="text-slate-400">{v.value} {v.unit} · {fmtDateTime(v.at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Diet + Activity */}
            <div className="grid grid-cols-2 gap-4">
              <Section icon={Utensils} title="Diet (recent)">
                {o.diet.length === 0 ? <Empty /> : o.diet.slice(0, 6).map((d, i) => (
                  <div key={i} className="text-xs text-slate-400 py-1">{d.meal}: {d.description}</div>
                ))}
              </Section>
              <Section icon={Dumbbell} title="Activity (recent)">
                {o.activity.length === 0 ? <Empty /> : o.activity.slice(0, 6).map((a, i) => (
                  <div key={i} className="text-xs text-slate-400 py-1">{a.name}{a.detail ? ` · ${a.detail}` : ''}</div>
                ))}
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Patient ↔ care-team messaging (staff side) ──────────────
interface MsgRow { id: number; sender_role: 'patient' | 'staff'; body: string; created_at: string }
function MessagesPanel({ patientId, onChanged }: { patientId: number; onChanged: () => void }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')

  const thread = useQuery({
    queryKey: ['companion-messages', patientId],
    queryFn: async () => {
      const { data, error } = await supabase.schema('cr').from('companion_message')
        .select('id,sender_role,body,created_at').eq('patient_id', patientId).order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as MsgRow[]
    },
  })

  // Acknowledge unread patient messages when the drawer opens, then refresh roster badge.
  useEffect(() => {
    supabase.schema('cr').from('companion_message')
      .update({ read_by_staff: true }).eq('patient_id', patientId).eq('sender_role', 'patient').eq('read_by_staff', false)
      .then(() => onChanged())
  }, [patientId])

  const send = useMutation({
    mutationFn: async () => {
      const body = text.trim(); if (!body) throw new Error('Message is empty.')
      const { error } = await supabase.schema('cr').rpc('companion_staff_send_message', { p_patient_id: patientId, p_body: body })
      if (error) throw error
    },
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['companion-messages', patientId] }) },
  })

  return (
    <Section icon={MessageSquare} title="Messages">
      <div className="bg-white/5 rounded px-3 py-3 space-y-2">
        {thread.isLoading && <div className="text-xs text-slate-500">Loading…</div>}
        {thread.data && thread.data.length === 0 && <div className="text-xs text-slate-600">No messages yet.</div>}
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {thread.data?.map(m => {
            const staff = m.sender_role === 'staff'
            return (
              <div key={m.id} className={cn('flex flex-col', staff ? 'items-end' : 'items-start')}>
                <div className={cn('max-w-[85%] rounded px-3 py-2 text-xs leading-relaxed border',
                  staff ? 'bg-gold-500/10 border-gold-500/25 text-slate-200' : 'bg-navy-900 border-white/10 text-slate-300')}>
                  {m.body}
                </div>
                <span className="text-[11px] text-slate-600 mt-1">{staff ? 'Care team' : 'Patient'} · {fmtDateTime(m.created_at)}</span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send.mutate() }}
            placeholder="Reply to the patient…"
            className="flex-1 bg-navy-900 border border-white/10 rounded px-3 py-2 text-sm text-slate-200 focus:border-gold-500 outline-none" />
          <button onClick={() => send.mutate()} disabled={send.isPending}
            className="bg-gold-500 text-navy-950 rounded px-3 py-2 text-xs font-medium hover:bg-gold-400 disabled:opacity-50 flex items-center gap-1">
            <Send size={12} /> {send.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
        {send.error && <div className="text-xs text-red-400">{(send.error as Error).message}</div>}
      </div>
    </Section>
  )
}

// ── Care-plan editor (staff authoring → Companion Treatment page) ───────────
interface CarePlanRow {
  id: number
  patient_id: number
  title: string
  condition: string | null
  plain_language: string | null
  status: string
  updated_at: string
}
function CarePlanEditor({ patientId, onChanged }: { patientId: number; onChanged: () => void }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: '', condition: '', plain_language: '', status: 'active' })
  const [planId, setPlanId] = useState<number | null>(null)

  const plan = useQuery({
    queryKey: ['companion-careplan', patientId],
    queryFn: async () => {
      const { data, error } = await supabase.schema('cr').from('care_plan')
        .select('id,patient_id,title,condition,plain_language,status,updated_at')
        .eq('patient_id', patientId).eq('status', 'active')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      return (data ?? null) as CarePlanRow | null
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Title is required.')
      const { error } = await supabase.schema('cr').rpc('upsert_care_plan', {
        p_patient_id: patientId,
        p_title: form.title.trim(),
        p_condition: form.condition.trim() || null,
        p_plain_language: form.plain_language.trim() || null,
        p_status: form.status,
        p_care_plan_id: planId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['companion-careplan', patientId] })
      onChanged()
    },
  })

  const startEdit = (existing: CarePlanRow | null) => {
    setPlanId(existing?.id ?? null)
    setForm({
      title: existing?.title ?? '',
      condition: existing?.condition ?? '',
      plain_language: existing?.plain_language ?? '',
      status: existing?.status ?? 'active',
    })
    setEditing(true)
  }

  const p = plan.data
  const field = 'w-full bg-navy-900 border border-white/10 rounded px-3 py-2 text-sm text-slate-200 focus:border-gold-500 outline-none'

  return (
    <Section icon={FileText} title="Care plan">
      {plan.isLoading && <div className="text-xs text-slate-500">Loading…</div>}

      {!editing && (
        <div className="bg-white/5 rounded px-3 py-3 space-y-1.5">
          {p ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-slate-200">{p.title}</span>
                <button onClick={() => startEdit(p)} className="text-xs text-slate-400 hover:text-gold-400 flex items-center gap-1 whitespace-nowrap">
                  <Pencil size={12} /> Edit
                </button>
              </div>
              {p.condition && <div className="text-xs text-slate-400">{p.condition}</div>}
              <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
                {p.plain_language || <span className="text-slate-600">No plain-language summary yet — the Companion assistant needs this to explain the plan.</span>}
              </p>
              <div className="text-[11px] text-slate-600 pt-1">Updated {fmtDate(p.updated_at)}</div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">No active care plan.</span>
              <button onClick={() => startEdit(null)} className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1">
                <Plus size={12} /> Create
              </button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="bg-navy-900 border border-gold-500/20 rounded px-3 py-3 space-y-2">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Title (e.g. Post-op TKA — week 1–6)" className={field} />
          <input value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}
            placeholder="Condition (optional)" className={field} />
          <textarea value={form.plain_language} onChange={e => setForm({ ...form, plain_language: e.target.value })}
            placeholder="Plain-language summary the patient (and the Companion assistant) will see…"
            rows={5} className={field + ' resize-y'} />
          <div className="flex items-center justify-between gap-3 pt-1">
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="bg-navy-900 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-gold-500">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
            <div className="flex items-center gap-3">
              <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
              <button onClick={() => save.mutate()} disabled={save.isPending}
                className="bg-gold-500 text-navy-950 rounded px-3 py-1.5 text-xs font-medium hover:bg-gold-400 disabled:opacity-50 flex items-center gap-1">
                <Save size={12} /> {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          {save.error && <div className="text-xs text-red-400">{(save.error as Error).message}</div>}
          <p className="text-[11px] text-slate-600">Saving an active plan archives any prior active plan. The patient sees this on their Treatment page immediately.</p>
        </div>
      )}
    </Section>
  )
}

function Stat({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: number | string }) {
  return (
    <div className="hud-panel hud-bracket p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="data-label">{label}</div>
        <Icon size={14} className={cn('mt-0.5', color)} />
      </div>
      <div className="font-display font-bold text-2xl text-slate-100">{value}</div>
    </div>
  )
}
function Section({ icon: Icon, title, tone, children }: { icon: any; title: string; tone?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={tone === 'amber' ? 'text-amber-400' : 'text-gold-400'} />
        <span className="text-xs font-mono uppercase tracking-widest text-slate-400">{title}</span>
      </div>
      {children}
    </div>
  )
}
const Empty = () => <div className="text-xs text-slate-600">Nothing logged yet.</div>
