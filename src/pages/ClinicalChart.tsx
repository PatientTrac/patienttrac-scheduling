import { useState } from 'react'
import {
  FileText, Calendar, Pill, Activity, ClipboardList, Scissors,
  Target, Search, AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { cn, formatDate } from '@/lib/utils'
import {
  useDiagnoses,
  useClinicalEncounters,
  useMedications,
  useLabResults,
  useImagingOrders,
  useSurgical,
  useOncology,
  useEndoscopy,
  useAllergies,
} from '@/hooks/clinical-chart-hooks'

interface Props { patientId: number }

const TABS = [
  { id: 'problems',   label: 'Problems',   icon: FileText },
  { id: 'encounters', label: 'Encounters', icon: Calendar },
  { id: 'meds',       label: 'Medications', icon: Pill },
  { id: 'labs',       label: 'Labs',       icon: Activity },
  { id: 'imaging',    label: 'Imaging',    icon: ClipboardList },
  { id: 'surgical',   label: 'Surgical',   icon: Scissors },
  { id: 'oncology',   label: 'Oncology',   icon: Target },
  { id: 'endoscopy',  label: 'Endoscopy',  icon: Search },
  { id: 'allergies',  label: 'Allergies',  icon: AlertTriangle },
]

const tooltipStyle = {
  background: '#0b1220',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  fontSize: 11,
  color: '#e2e8f0',
}
const axisStyle = { fontSize: 10, fill: '#64748b' }

// ── Shared primitives ───────────────────────────────────────

function Loading() {
  return (
    <div className="flex items-center gap-2 py-6 text-slate-500">
      <div className="w-4 h-4 border border-gold-500/40 border-t-gold-500 rounded-full animate-spin" />
      <span className="font-mono text-xs">Loading…</span>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-10 border border-dashed border-gold-500/10 rounded-sm">
      <span className="font-mono text-xs text-slate-600">{label}</span>
    </div>
  )
}

function Err({ error }: { error: unknown }) {
  return (
    <div className="font-mono text-xs text-red-400 py-4">
      Failed to load: {String(error)}
    </div>
  )
}

// ── Section: Problems ───────────────────────────────────────

function ProblemsSection({ patientId }: { patientId: number }) {
  const { data, isLoading, error } = useDiagnoses(patientId)
  if (isLoading) return <Loading />
  if (error) return <Err error={error} />
  if (!data?.length) return <Empty label="No diagnoses recorded" />

  return (
    <table className="hud-table">
      <thead>
        <tr>
          {['ICD Code', 'Description', 'Status', 'Primary', 'Onset', 'Abatement'].map(h => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(data as any[]).map((d, i) => (
          <tr key={i}>
            <td className="font-mono text-xs text-gold-400">{d.icd_code ?? '—'}</td>
            <td className="font-medium">{d.description ?? '—'}</td>
            <td>
              <span className={cn(
                'badge',
                d.clinical_status === 'active'   ? 'badge-active'   :
                d.clinical_status === 'resolved' ? 'badge-inactive' : 'badge-pending'
              )}>
                {d.clinical_status ?? '—'}
              </span>
            </td>
            <td>{d.is_primary ? <span className="badge badge-active">Primary</span> : '—'}</td>
            <td className="font-mono text-xs text-slate-400">{d.onset_date ? formatDate(d.onset_date) : '—'}</td>
            <td className="font-mono text-xs text-slate-400">{d.abatement_date ? formatDate(d.abatement_date) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Section: Encounters ─────────────────────────────────────

function EncountersSection({ patientId }: { patientId: number }) {
  const { data, isLoading, error } = useClinicalEncounters(patientId)
  if (isLoading) return <Loading />
  if (error) return <Err error={error} />
  if (!data?.length) return <Empty label="No encounters recorded" />

  return (
    <table className="hud-table">
      <thead>
        <tr>
          {['Date', 'Type', 'Chief Complaint', 'Status'].map(h => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(data as any[]).map((e, i) => (
          <tr key={i}>
            <td className="font-mono text-xs text-slate-400">
              {e.encounter_date ? formatDate(e.encounter_date) : '—'}
            </td>
            <td className="font-mono text-xs text-gold-400 uppercase tracking-wide">
              {(e.encounter_type ?? '—').replace(/_/g, ' ')}
            </td>
            <td className="text-slate-300">{e.chief_complaint ?? '—'}</td>
            <td>
              <span className={cn(
                'badge',
                e.status === 'closed'    ? 'badge-inactive' :
                e.status === 'open'      ? 'badge-active'   : 'badge-pending'
              )}>
                {e.status ?? '—'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Section: Medications ────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MedTable({ rows, label }: { rows: any[]; label: string }) {
  if (!rows.length) return <Empty label={`No ${label.toLowerCase()}`} />
  return (
    <table className="hud-table">
      <thead>
        <tr>
          {['Medication', 'Route', 'Frequency', 'Start', 'End', 'Notes'].map(h => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {rows.map((m: any, i: number) => (
          <tr key={i}>
            <td className="font-medium text-slate-200">{m.medication_name ?? m.name ?? '—'}</td>
            <td className="font-mono text-xs text-slate-400">{m.route ?? '—'}</td>
            <td className="font-mono text-xs text-slate-400">{m.frequency ?? '—'}</td>
            <td className="font-mono text-xs text-slate-400">{m.start_date ? formatDate(m.start_date) : '—'}</td>
            <td className="font-mono text-xs text-slate-400">{m.end_date ? formatDate(m.end_date) : '—'}</td>
            <td className="text-xs text-slate-500">{m.notes ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MedsSection({ patientId }: { patientId: number }) {
  const { data, isLoading, error } = useMedications(patientId)
  if (isLoading) return <Loading />
  if (error) return <Err error={error} />
  if (!data?.length) return <Empty label="No medications recorded" />

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = (data as any[]).filter(m => m.is_current)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prior   = (data as any[]).filter(m => !m.is_current)

  return (
    <div className="space-y-6">
      <div>
        <div className="section-heading mb-2">Current Medications</div>
        <MedTable rows={current} label="current medications" />
      </div>
      <div>
        <div className="section-heading mb-2">Prior Medications</div>
        <MedTable rows={prior} label="prior medications" />
      </div>
    </div>
  )
}

// ── Section: Labs ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LabDot = (props: any) => {
  const { cx, cy, payload } = props
  if (typeof cx !== 'number' || typeof cy !== 'number') return null
  return payload?.abnormal
    ? <circle cx={cx} cy={cy} r={4} fill="#f87171" />
    : <circle cx={cx} cy={cy} r={2.5} fill="#00d4ff" />
}

function LabsSection({ patientId }: { patientId: number }) {
  const { data, isLoading, error } = useLabResults(patientId)
  if (isLoading) return <Loading />
  if (error) return <Err error={error} />
  if (!data?.length) return <Empty label="No lab results recorded" />

  // Group by lab_name for trend sparklines
  const groups = (data as any[]).reduce((acc: Record<string, { date: string; value: number; abnormal: boolean; unit: string | null; ref: string | null }[]>, row: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const key: string = row.lab_name ?? 'Unknown'
    if (!acc[key]) acc[key] = []
    const val = parseFloat(row.result_value)
    if (!isNaN(val)) {
      acc[key].push({
        date: (row.lab_date ?? row.result_date ?? '').slice(0, 10),
        value: val,
        abnormal: !!row.is_abnormal,
        unit: row.result_unit ?? null,
        ref: row.reference_range ?? null,
      })
    }
    return acc
  }, {})

  const fmtTick = (d: string) => {
    const dt = new Date(d)
    return `${dt.getMonth() + 1}/${dt.getDate()}`
  }

  const trendGroups = Object.entries(groups).filter(([, pts]) => pts.length >= 2)

  return (
    <div className="space-y-6">
      {/* Full results table */}
      <div>
        <div className="section-heading mb-2">All Results</div>
        <table className="hud-table">
          <thead>
            <tr>
              {['Date', 'Test', 'Code', 'Value', 'Unit', 'Reference', 'Flag'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(data as any[]).map((r, i) => (
              <tr key={i}>
                <td className="font-mono text-xs text-slate-400">
                  {r.lab_date ? formatDate(r.lab_date) : '—'}
                </td>
                <td className="font-medium text-slate-200">{r.lab_name ?? '—'}</td>
                <td className="font-mono text-xs text-slate-500">{r.test_code ?? '—'}</td>
                <td className={cn(
                  'font-mono text-sm font-semibold',
                  r.is_abnormal ? 'text-red-400' : 'text-cyan-400'
                )}>
                  {r.result_value ?? '—'}
                </td>
                <td className="font-mono text-xs text-slate-500">{r.result_unit ?? '—'}</td>
                <td className="font-mono text-xs text-slate-500">{r.reference_range ?? '—'}</td>
                <td>
                  {r.is_abnormal
                    ? <span className="badge badge-urgent">ABN</span>
                    : <span className="badge badge-active">NL</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-analyte trend sparklines */}
      <div>
        <div className="section-heading mb-3">Trends by Analyte</div>
        {trendGroups.length === 0
          ? <Empty label="Insufficient data points for trend charts" />
          : (
            <div className="grid grid-cols-2 gap-4">
              {trendGroups.map(([name, pts]) => {
                const sorted = [...pts].sort((a, b) => a.date.localeCompare(b.date))
                return (
                  <div key={name} className="bg-navy-800/50 border border-gold-500/10 rounded-sm p-3">
                    <div className="font-mono text-xs text-slate-300 uppercase tracking-wide mb-0.5">{name}</div>
                    <div className="font-mono text-[10px] text-slate-600 mb-2">
                      {pts[0]?.unit ?? ''}{pts[0]?.ref ? ` · ref: ${pts[0].ref}` : ''}
                    </div>
                    <ResponsiveContainer width="100%" height={80}>
                      <LineChart data={sorted} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tickFormatter={fmtTick} tick={axisStyle} />
                        <YAxis tick={axisStyle} width={32} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
                          formatter={(val: number, _name: string, entry: any) => [ // eslint-disable-line @typescript-eslint/no-explicit-any
                            `${val}${pts[0]?.unit ? ' ' + pts[0].unit : ''}${entry.payload.abnormal ? ' ⚑' : ''}`,
                            name,
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#00d4ff"
                          strokeWidth={1.5}
                          dot={<LabDot />}
                          activeDot={{ r: 4, fill: '#c9a96e' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>
    </div>
  )
}

// ── Section: Imaging ────────────────────────────────────────

function ImagingSection({ patientId }: { patientId: number }) {
  const { data, isLoading, error } = useImagingOrders(patientId)
  if (isLoading) return <Loading />
  if (error) return <Err error={error} />
  if (!data?.length) return <Empty label="No imaging orders recorded" />

  return (
    <table className="hud-table">
      <thead>
        <tr>
          {['Date', 'Modality', 'Body Region', 'Description / Impression', 'Radiologist'].map(h => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(data as any[]).map((img, i) => (
          <tr key={i}>
            <td className="font-mono text-xs text-slate-400">
              {img.order_date ? formatDate(img.order_date) : '—'}
            </td>
            <td className="font-mono text-xs text-gold-400 uppercase">{img.modality ?? '—'}</td>
            <td className="text-slate-300">{img.body_region ?? '—'}</td>
            <td className="text-slate-300 text-xs max-w-xs">
              {img.study_description ?? img.impression ?? '—'}
            </td>
            <td className="text-xs text-slate-500">
              {img.radiologist ?? img.radiologist_name ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Section: Surgical ───────────────────────────────────────

function SurgicalSection({ patientId }: { patientId: number }) {
  const { data, isLoading, error } = useSurgical(patientId)
  const [expandedNote, setExpandedNote] = useState<number | null>(null)

  if (isLoading) return <Loading />
  if (error) return <Err error={error} />

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { history = [], notes = [] } = (data ?? {}) as { history: any[]; notes: any[] }

  return (
    <div className="space-y-6">
      <div>
        <div className="section-heading mb-2">Surgical History</div>
        {history.length === 0
          ? <Empty label="No surgical history recorded" />
          : (
            <table className="hud-table">
              <thead>
                <tr>
                  {['Date', 'Procedure', 'Surgeon', 'Facility', 'Notes'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {history.map((h: any, i: number) => (
                  <tr key={i}>
                    <td className="font-mono text-xs text-slate-400">
                      {h.surgery_date ? formatDate(h.surgery_date) : '—'}
                    </td>
                    <td className="font-medium text-slate-200">
                      {h.procedure_name ?? h.procedure ?? '—'}
                    </td>
                    <td className="text-xs text-slate-400">{h.surgeon ?? '—'}</td>
                    <td className="text-xs text-slate-400">{h.facility ?? h.facility_name ?? '—'}</td>
                    <td className="text-xs text-slate-500">{h.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      <div>
        <div className="section-heading mb-2">Operative Notes</div>
        {notes.length === 0
          ? <Empty label="No operative notes recorded" />
          : (
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {notes.map((n: any, i: number) => (
                <div key={i} className="border border-gold-500/10 rounded-sm">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gold-500/5 transition-colors"
                    onClick={() => setExpandedNote(expandedNote === i ? null : i)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-500">
                        {n.encounter_id ? `Enc #${n.encounter_id}` : `Note ${i + 1}`}
                      </span>
                      <span className="text-sm text-slate-300">
                        {n.procedure ?? n.title ?? `Operative Note ${i + 1}`}
                      </span>
                      {n.surgeon && (
                        <span className="text-xs text-slate-500">· {n.surgeon}</span>
                      )}
                    </div>
                    {expandedNote === i
                      ? <ChevronDown size={14} className="text-slate-500" />
                      : <ChevronRight size={14} className="text-slate-500" />
                    }
                  </button>

                  {expandedNote === i && (
                    <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gold-500/10">
                      {[
                        { label: 'Procedure',    val: n.procedure },
                        { label: 'Surgeon',      val: n.surgeon },
                        { label: 'Findings',     val: n.findings },
                        { label: 'Complications', val: n.complications },
                        { label: 'EBL',          val: n.estimated_blood_loss != null ? `${n.estimated_blood_loss} mL` : null },
                        { label: 'Notes',        val: n.notes },
                      ].filter(f => f.val != null).map(({ label, val }) => (
                        <div key={label}>
                          <div className="data-label mb-0.5">{label}</div>
                          <div className="text-slate-300 text-xs leading-relaxed">{val}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}

// ── Section: Oncology ───────────────────────────────────────

function OncologySection({ patientId }: { patientId: number }) {
  const { data, isLoading, error } = useOncology(patientId)
  if (isLoading) return <Loading />
  if (error) return <Err error={error} />
  if (!data) return <Empty label="No oncology evaluation recorded" />

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { evaluation: ev, events } = data as { evaluation: any; events: any[] }

  const genomicRaw = ev.genomic_testing_results
  const genomicObj: Record<string, unknown> | null =
    typeof genomicRaw === 'string'
      ? (() => { try { return JSON.parse(genomicRaw) } catch { return null } })()
      : (genomicRaw && typeof genomicRaw === 'object' ? genomicRaw as Record<string, unknown> : null)

  return (
    <div className="space-y-6">
      {/* Staging panel */}
      <div>
        <div className="section-heading mb-3">Staging</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Primary Site', val: ev.primary_site ?? ev.diagnosis_code ?? '—' },
            { label: 'Histology',    val: ev.histology ?? '—' },
            { label: 'T Stage',      val: ev.t_stage ?? '—' },
            { label: 'N Stage',      val: ev.n_stage ?? '—' },
            { label: 'M Stage',      val: ev.m_stage ?? '—' },
            { label: 'Overall Stage', val: ev.overall_stage ?? ev.stage ?? '—' },
            { label: 'MSS / MMR',    val: ev.mss_status ?? ev.mismatch_repair ?? '—' },
            { label: 'Grade',        val: ev.grade ?? '—' },
            { label: 'Laterality',   val: ev.laterality ?? '—' },
          ].map(({ label, val }) => (
            <div key={label} className="bg-navy-800/50 border border-gold-500/10 rounded-sm p-3">
              <div className="data-label mb-1">{label}</div>
              <div className="font-mono text-sm text-gold-300">{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Genomic testing results */}
      {genomicObj && (
        <div>
          <div className="section-heading mb-2">Genomic Testing</div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(genomicObj).map(([key, val]) => {
              const display = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')
              const isMut = typeof val === 'string' && val.toLowerCase().includes('mut')
              const isWt  = typeof val === 'string' && (val.toLowerCase() === 'wt' || val.toLowerCase() === 'wild type')
              return (
                <div key={key} className="bg-navy-800/50 border border-gold-500/10 rounded-sm p-2.5">
                  <div className="data-label mb-1">{key.replace(/_/g, ' ')}</div>
                  <div className={cn(
                    'font-mono text-xs font-semibold',
                    isMut ? 'text-red-400' : isWt ? 'text-emerald-400' : 'text-slate-300'
                  )}>
                    {display}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Treatment course timeline */}
      <div>
        <div className="section-heading mb-3">Treatment Course</div>
        {events.length === 0
          ? <Empty label="No treatment events recorded" />
          : (
            <div className="space-y-0">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {events.map((evt: any, i: number) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex flex-col items-center mt-1.5 flex-shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-gold-500" />
                    {i < events.length - 1 && (
                      <div className="w-px flex-1 min-h-8 bg-gold-500/20 my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-3 mb-0.5">
                      <span className="font-mono text-xs text-slate-500">
                        {evt.event_date ? formatDate(evt.event_date) : '—'}
                      </span>
                      <span className="font-mono text-xs text-gold-400 uppercase tracking-wide">
                        {(evt.event_type ?? '—').replace(/_/g, ' ')}
                      </span>
                    </div>
                    {evt.description && (
                      <div className="text-sm text-slate-300">{evt.description}</div>
                    )}
                    {evt.notes && (
                      <div className="text-xs text-slate-500 mt-0.5">{evt.notes}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}

// ── Section: Endoscopy ──────────────────────────────────────

const ENDO_SUBSECTIONS = [
  { key: 'endoscopy_pre_procedure',  label: 'Pre-Procedure' },
  { key: 'endoscopy_findings',       label: 'Findings' },
  { key: 'endoscopy_pathology',      label: 'Pathology' },
  { key: 'endoscopy_interventions',  label: 'Interventions' },
  { key: 'endoscopy_post_procedure', label: 'Post-Procedure' },
]

const ENDO_META_KEYS = new Set(['id', 'encounter_id', 'created_at', 'updated_at', 'patient_id'])

function EndoscopySection({ patientId }: { patientId: number }) {
  const { data, isLoading, error } = useEndoscopy(patientId)
  const [expanded, setExpanded] = useState<number | null>(null)

  if (isLoading) return <Loading />
  if (error) return <Err error={error} />
  if (!data?.length) return <Empty label="No endoscopy reports recorded" />

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(data as any[]).map((report, i) => (
        <div key={i} className="border border-gold-500/10 rounded-sm">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gold-500/5 transition-colors"
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-slate-500">
                {report.encounter_id ? `Enc #${report.encounter_id}` : `Report ${i + 1}`}
              </span>
              <span className="font-mono text-xs text-gold-400 uppercase tracking-wide">
                {(report.procedure_type ?? report.report_type ?? 'Endoscopy').replace(/_/g, ' ')}
              </span>
              {report.provider_name && (
                <span className="text-xs text-slate-500">· {report.provider_name}</span>
              )}
            </div>
            {expanded === i
              ? <ChevronDown size={14} className="text-slate-500" />
              : <ChevronRight size={14} className="text-slate-500" />
            }
          </button>

          {expanded === i && (
            <div className="border-t border-gold-500/10 px-4 pb-4 pt-3 space-y-4">
              {/* Top-level report fields */}
              {report.indication && (
                <div>
                  <div className="data-label mb-0.5">Indication</div>
                  <div className="text-sm text-slate-300">{report.indication}</div>
                </div>
              )}
              {report.conclusion && (
                <div>
                  <div className="data-label mb-0.5">Conclusion</div>
                  <div className="text-sm text-slate-300">{report.conclusion}</div>
                </div>
              )}

              {/* Sub-sections from nested PostgREST join */}
              {ENDO_SUBSECTIONS.map(({ key, label }) => {
                const raw = report[key]
                if (!raw) return null
                const rows = Array.isArray(raw) ? raw : [raw]
                if (rows.length === 0) return null
                return (
                  <div key={key}>
                    <div className="section-heading mb-2">{label}</div>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {rows.map((row: any, j: number) => (
                      <div key={j} className="space-y-1.5">
                        {Object.entries(row)
                          .filter(([k, v]) => !ENDO_META_KEYS.has(k) && v != null && v !== '')
                          .map(([k, v]) => (
                            <div key={k} className="flex gap-3 text-xs">
                              <span className="data-label w-36 flex-shrink-0 mt-0.5">
                                {k.replace(/_/g, ' ')}
                              </span>
                              <span className="text-slate-300">
                                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                              </span>
                            </div>
                          ))
                        }
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Section: Allergies ──────────────────────────────────────

function AllergiesSection({ patientId }: { patientId: number }) {
  const { data, isLoading, error } = useAllergies(patientId)
  if (isLoading) return <Loading />
  if (error) return <Err error={error} />
  if (!data?.length) return <Empty label="No allergy records" />

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const first = data[0] as any
  const isNKDA =
    data.length === 1 &&
    (first.no_known_allergies === true ||
      (first.allergen ?? first.allergy_name ?? '').toLowerCase().includes('nkda'))

  if (isNKDA) {
    return (
      <div className="flex items-center gap-3 py-4 px-5 bg-emerald-500/10 border border-emerald-500/20 rounded-sm">
        <AlertTriangle size={16} className="text-emerald-400 flex-shrink-0" />
        <div>
          <div className="font-mono text-sm font-semibold text-emerald-300">NKDA</div>
          <div className="font-mono text-xs text-emerald-600">No Known Drug Allergies</div>
        </div>
      </div>
    )
  }

  return (
    <table className="hud-table">
      <thead>
        <tr>
          {['Allergen', 'Reaction', 'Severity', 'Onset', 'Notes'].map(h => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(data as any[]).map((a, i) => (
          <tr key={i}>
            <td className="font-medium text-slate-200">{a.allergen ?? a.allergy_name ?? '—'}</td>
            <td className="text-slate-300">{a.reaction ?? '—'}</td>
            <td>
              <span className={cn(
                'badge',
                a.severity === 'severe'   ? 'badge-urgent'   :
                a.severity === 'moderate' ? 'badge-pending' : 'badge-inactive'
              )}>
                {a.severity ?? '—'}
              </span>
            </td>
            <td className="font-mono text-xs text-slate-400">
              {a.onset_date ? formatDate(a.onset_date) : '—'}
            </td>
            <td className="text-xs text-slate-500">{a.notes ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Main export ─────────────────────────────────────────────

export function ClinicalChart({ patientId }: Props) {
  const [activeSection, setActiveSection] = useState('problems')

  return (
    <div className="-m-5">
      {/* Inner tab strip */}
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-gold-500/10 px-5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 transition-all duration-150 -mb-px whitespace-nowrap',
              activeSection === id
                ? 'text-gold-300 border-gold-500 font-medium'
                : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'
            )}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="p-5">
        {activeSection === 'problems'   && <ProblemsSection   patientId={patientId} />}
        {activeSection === 'encounters' && <EncountersSection patientId={patientId} />}
        {activeSection === 'meds'       && <MedsSection       patientId={patientId} />}
        {activeSection === 'labs'       && <LabsSection       patientId={patientId} />}
        {activeSection === 'imaging'    && <ImagingSection    patientId={patientId} />}
        {activeSection === 'surgical'   && <SurgicalSection   patientId={patientId} />}
        {activeSection === 'oncology'   && <OncologySection   patientId={patientId} />}
        {activeSection === 'endoscopy'  && <EndoscopySection  patientId={patientId} />}
        {activeSection === 'allergies'  && <AllergiesSection  patientId={patientId} />}
      </div>
    </div>
  )
}
