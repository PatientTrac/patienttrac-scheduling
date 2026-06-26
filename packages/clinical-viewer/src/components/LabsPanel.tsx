/**
 * LabsPanel — standalone labs table + per-analyte Recharts trend sparklines.
 * Requires <ClinicalViewerProvider client={supabase}> in the tree.
 *
 * Usage:
 *   <ClinicalViewerProvider client={supabase}>
 *     <LabsPanel patientId={16} />
 *   </ClinicalViewerProvider>
 */
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { useLabResults } from '../hooks'
import { Loading, Empty, Err } from './primitives'
import { cn, formatDate } from './utils'

interface Props { patientId: number }

const tooltipStyle = {
  background: '#0b1220',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  fontSize: 11,
  color: '#e2e8f0',
}
const axisStyle = { fontSize: 10, fill: '#64748b' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LabDot = (props: any) => {
  const { cx, cy, payload } = props
  if (typeof cx !== 'number' || typeof cy !== 'number') return null
  return payload?.abnormal
    ? <circle cx={cx} cy={cy} r={4} fill="#f87171" />
    : <circle cx={cx} cy={cy} r={2.5} fill="#00d4ff" />
}

export function LabsPanel({ patientId }: Props) {
  const { data, isLoading, error } = useLabResults(patientId)

  if (isLoading) return <Loading />
  if (error)     return <Err error={error} />
  if (!data?.length) return <Empty label="No lab results recorded" />

  // Group by lab_name for trend sparklines
  // result_value and reference_range are TEXT — parse before plotting
  const groups = (data as any[]).reduce( // eslint-disable-line @typescript-eslint/no-explicit-any
    (acc: Record<string, { date: string; value: number; abnormal: boolean; unit: string | null; ref: string | null }[]>, row: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const key: string = row.lab_name ?? 'Unknown'
      if (!acc[key]) acc[key] = []
      const val = parseFloat(row.result_value)
      if (!isNaN(val)) {
        acc[key].push({
          date:     (row.lab_date ?? row.result_date ?? '').slice(0, 10),
          value:    val,
          abnormal: !!row.is_abnormal,
          unit:     row.result_unit ?? null,
          ref:      row.reference_range ?? null,
        })
      }
      return acc
    },
    {}
  )

  const fmtTick = (d: string) => {
    const dt = new Date(d)
    return `${dt.getMonth() + 1}/${dt.getDate()}`
  }

  const trendGroups = Object.entries(groups).filter(([, pts]) => pts.length >= 2)

  return (
    <div className="space-y-6">
      {/* All results table */}
      <div>
        <div className="cv-section-heading mb-2">All Results</div>
        <table className="cv-table">
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
                    ? <span className="cv-badge cv-badge-urgent">ABN</span>
                    : <span className="cv-badge cv-badge-active">NL</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-analyte trend sparklines */}
      <div>
        <div className="cv-section-heading mb-3">Trends by Analyte</div>
        {trendGroups.length === 0
          ? <Empty label="Insufficient data points for trend charts" />
          : (
            <div className="grid grid-cols-2 gap-4">
              {trendGroups.map(([name, pts]) => {
                const sorted = [...pts].sort((a, b) => a.date.localeCompare(b.date))
                return (
                  <div key={name} className="bg-navy-800/50 border border-gold-500/10 rounded-sm p-3">
                    <div className="font-mono text-xs text-slate-300 uppercase tracking-wide mb-0.5">
                      {name}
                    </div>
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
                          formatter={(val, _name, entry: any) => [ // eslint-disable-line @typescript-eslint/no-explicit-any
                            `${val ?? ''}${pts[0]?.unit ? ' ' + pts[0].unit : ''}${entry.payload.abnormal ? ' ⚑' : ''}`,
                            name,
                          ] as [string, string]}
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
