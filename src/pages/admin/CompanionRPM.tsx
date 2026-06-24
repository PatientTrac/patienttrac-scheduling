import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, ChevronRight, X, ShieldCheck, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface RpmRow {
  patient_id: number
  name: string
  medical_grade_days_30d: number
  total_medical_readings_30d: number
  last_medical_reading_at: string | null
  meets_99454: boolean
}
interface RpmDetail {
  patient_id: number
  window_days: number
  medical_grade_days_30d: number
  meets_99454: boolean
  days: { d: string; readings: number; types: string[] }[]
}
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString() : '—')

export default function CompanionRPM() {
  const [selected, setSelected] = useState<number | null>(null)
  const roster = useQuery({
    queryKey: ['companion-rpm-roster'],
    queryFn: async () => {
      const { data, error } = await supabase.schema('cr').rpc('companion_rpm_roster')
      if (error) throw error
      return (data ?? []) as RpmRow[]
    },
  })

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <div className="section-heading mb-1">Patient Companion</div>
        <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">RPM Eligibility Tracking</h1>
      </div>

      {/* Tracking-only disclaimer */}
      <div className="hud-panel p-4 border border-gold-500/20">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-gold-400 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-400 leading-relaxed">
            This is a <span className="text-slate-200">tracking aid, not a billing determination</span>. Only FDA-cleared
            (medical-grade) device readings count toward the day totals below. CPT <span className="text-slate-200">99454</span> generally
            requires ≥16 reading-days in a 30-day period; time-based codes (99457 / 99458) require separately documented
            clinical time and are not shown here. A biller must confirm eligibility and medical necessity before any claim is submitted.
          </div>
        </div>
      </div>

      <div className="hud-panel p-5">
        <div className="section-heading mb-4">Patients with medical-grade readings (last 30 days)</div>
        {roster.isLoading && <div className="text-sm text-slate-500">Loading…</div>}
        {roster.error && (
          <div className="text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} /> {(roster.error as Error).message}
          </div>
        )}
        {roster.data && roster.data.length === 0 && (
          <div className="text-sm text-slate-500">
            No qualifying readings yet. Patients appear here once FDA-cleared device data flows in
            (<span className="text-slate-400">companion_vital.is_medical_grade = true</span>). Manual and consumer-wearable
            readings do not qualify for RPM.
          </div>
        )}
        {roster.data && roster.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-500/10">
                  {['Patient', 'Reading-days (30d)', 'Readings', '99454 (≥16 days)', 'Last reading', ''].map(h => (
                    <th key={h} className="py-2 px-3 text-left font-mono text-slate-500 uppercase tracking-widest text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.data.map(r => (
                  <tr key={r.patient_id} className="border-b border-white/5 hover:bg-gold-500/5 cursor-pointer" onClick={() => setSelected(r.patient_id)}>
                    <td className="py-2.5 px-3 text-slate-200">{r.name || `Patient #${r.patient_id}`}</td>
                    <td className="py-2.5 px-3 text-slate-300">{r.medical_grade_days_30d}</td>
                    <td className="py-2.5 px-3 text-slate-400">{r.total_medical_readings_30d}</td>
                    <td className="py-2.5 px-3">
                      {r.meets_99454
                        ? <span className="badge badge-success">Threshold met</span>
                        : <span className="badge badge-pending">{16 - r.medical_grade_days_30d} more days</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{fmtDate(r.last_medical_reading_at)}</td>
                    <td className="py-2.5 px-3 text-right"><ChevronRight size={15} className="text-slate-600" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected !== null && <RpmDrawer patientId={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function RpmDrawer({ patientId, onClose }: { patientId: number; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['companion-rpm-detail', patientId],
    queryFn: async () => {
      const { data, error } = await supabase.schema('cr').rpc('companion_rpm_detail', { p_patient_id: patientId })
      if (error) throw error
      return data as RpmDetail
    },
  })
  const d = detail.data
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-full max-w-lg h-full overflow-y-auto bg-navy-900 border-l border-gold-500/20 p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="section-heading mb-1">RPM detail · 30 days</div>
            <h2 className="font-display font-bold text-xl text-slate-100">Patient #{patientId}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200"><X size={18} /></button>
        </div>

        {detail.isLoading && <div className="text-sm text-slate-500">Loading…</div>}
        {detail.error && <div className="text-sm text-red-400">{(detail.error as Error).message}</div>}

        {d && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="hud-panel hud-bracket p-4">
                <div className="data-label flex items-center justify-between">Reading-days <CalendarDays size={14} className="text-gold-400" /></div>
                <div className="font-display font-bold text-2xl text-slate-100">{d.medical_grade_days_30d}<span className="text-sm text-slate-500"> / 16</span></div>
              </div>
              <div className="hud-panel hud-bracket p-4">
                <div className="data-label flex items-center justify-between">99454 <Activity size={14} className="text-emerald-400" /></div>
                <div className={cn('font-display font-bold text-lg mt-1', d.meets_99454 ? 'text-emerald-400' : 'text-slate-400')}>
                  {d.meets_99454 ? 'Threshold met' : 'Not yet'}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2">Qualifying days</div>
              {d.days.length === 0
                ? <div className="text-xs text-slate-600">No medical-grade readings in the last 30 days.</div>
                : (
                  <div className="space-y-1.5">
                    {d.days.map(day => (
                      <div key={day.d} className="flex items-center justify-between text-xs bg-white/5 rounded px-3 py-2">
                        <span className="text-slate-300">{fmtDate(day.d)}</span>
                        <span className="text-slate-500">{day.readings} reading{day.readings === 1 ? '' : 's'} · {(day.types || []).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Tracking only. Confirm device is FDA-cleared, patient consent and medical necessity are documented, and
              treatment-management time is recorded before billing 99457 / 99458.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
