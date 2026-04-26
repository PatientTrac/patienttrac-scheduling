import { useEffect, useState } from 'react'
import { Users, CalendarDays, DollarSign, Activity, AlertCircle, TrendingUp,
         FileText, Clock, CheckCircle, Brain, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function useDashboardStats() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().split('T')[0]

        const [
          { count: patientCount },
          { count: todayAppts },
          { count: openEncounters },
          { data: arData },
          { count: pendingBilling },
          { count: openRejections },
          { count: expiringAuths },
          { data: recentPts },
          { data: recentAppts },
        ] = await Promise.all([
          supabase.schema('cr').from('patient').select('*', { count: 'exact', head: true }).eq('org_id', ORG_ID).eq('purge', false),
          supabase.schema('cr').from('appointments').select('*', { count: 'exact', head: true }).eq('org_id', ORG_ID).eq('appt_date', today),
          supabase.schema('cr').from('encounter').select('*', { count: 'exact', head: true }).eq('org_id', ORG_ID).eq('encounter_status', 'open'),
          supabase.schema('cr').from('ar_aging').select('amount_due').eq('org_id', ORG_ID),
          supabase.schema('cr').from('superbill').select('*', { count: 'exact', head: true }).eq('org_id', ORG_ID).in('billing_status', ['draft', 'ready']),
          supabase.schema('cr').from('claim_rejections').select('*', { count: 'exact', head: true }).eq('org_id', ORG_ID).eq('status', 'open'),
          supabase.schema('cr').from('prior_authorizations').select('*', { count: 'exact', head: true })
            .eq('org_id', ORG_ID).eq('status', 'approved')
            .lte('expiration_date', new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0])
            .gte('expiration_date', today),
          supabase.schema('cr').from('patient').select('patient_id,first_name,last_name,insert_date').eq('org_id', ORG_ID).order('insert_date', { ascending: false }).limit(5),
          supabase.schema('cr').from('appointments').select('appt_id,appt_time,appt_type,patient:patient_id(first_name,last_name)').eq('org_id', ORG_ID).eq('appt_date', today).order('appt_time').limit(6),
        ])

        const totalAr = arData?.reduce((s: number, r: any) => s + parseFloat(r.amount_due ?? 0), 0) ?? 0

        setStats({ patientCount, todayAppts, openEncounters, totalAr, pendingBilling, openRejections, expiringAuths, recentPts, recentAppts })
      } catch (err) {
        console.error('Dashboard stats error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { stats, loading }
}

export function Dashboard() {
  const { stats, loading } = useDashboardStats()

  const kpis = [
    { label: 'Active Patients',   value: loading ? '…' : (stats?.patientCount  ?? '—'), icon: Users,        color: 'text-blue-400',    sub: 'Total registered' },
    { label: "Today's Appts",     value: loading ? '…' : (stats?.todayAppts    ?? '—'), icon: CalendarDays, color: 'text-gold-400',    sub: 'Scheduled today' },
    { label: 'Open Encounters',   value: loading ? '…' : (stats?.openEncounters ?? '—'), icon: Activity,    color: 'text-emerald-400', sub: 'Awaiting close' },
    { label: 'A/R Balance',       value: loading ? '…' : formatCurrency(stats?.totalAr ?? 0), icon: DollarSign, color: 'text-red-400', sub: 'Outstanding' },
    { label: 'Pending Claims',    value: loading ? '…' : (stats?.pendingBilling  ?? '—'), icon: FileText,   color: 'text-amber-400',   sub: 'Draft + ready' },
    { label: 'Open Rejections',   value: loading ? '…' : (stats?.openRejections  ?? '—'), icon: AlertCircle, color: 'text-red-500',   sub: 'Claim denials' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="section-heading mb-1">Operations Center</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Dashboard</h1>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs text-slate-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="font-mono text-[10px] text-slate-600 mt-0.5">
            {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Alert banners */}
      {!loading && stats?.expiringAuths > 0 && (
        <div className="hud-panel px-4 py-2.5 border-amber-500/30 bg-amber-500/5 flex items-center gap-3">
          <ShieldCheck size={13} className="text-amber-400 flex-shrink-0"/>
          <span className="font-mono text-[11px] text-amber-300">
            {stats.expiringAuths} prior authorization{stats.expiringAuths > 1 ? 's' : ''} expiring within 14 days
          </span>
        </div>
      )}
      {!loading && stats?.openRejections > 0 && (
        <div className="hud-panel px-4 py-2.5 border-red-500/25 bg-red-500/5 flex items-center gap-3">
          <AlertCircle size={13} className="text-red-400 flex-shrink-0"/>
          <span className="font-mono text-[11px] text-red-300">
            {stats.openRejections} open claim rejection{stats.openRejections > 1 ? 's' : ''} require attention
          </span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-6 gap-3">
        {kpis.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="hud-panel hud-bracket px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <div className="data-label text-[10px]">{label}</div>
              <Icon size={12} className={color} />
            </div>
            <div className="font-display font-bold text-lg text-slate-100">{value}</div>
            <div className="font-mono text-[9px] text-slate-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* Today's Schedule */}
        <div className="hud-panel overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gold-500/10 flex items-center justify-between">
            <div className="section-heading">Today's Schedule</div>
            <CalendarDays size={12} className="text-gold-400"/>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center font-mono text-xs text-slate-600">Loading…</div>
          ) : stats?.recentAppts?.length ? (
            <div className="divide-y divide-gold-500/5">
              {stats.recentAppts.map((a: any) => (
                <div key={a.appt_id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gold-500/3">
                  <div className="font-mono text-[10px] text-gold-400 w-12 flex-shrink-0">{a.appt_time}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-200 truncate">
                      {(a.patient as any)?.last_name}, {(a.patient as any)?.first_name}
                    </div>
                    <div className="font-mono text-[9px] text-slate-600 capitalize">{a.appt_type?.replace(/_/g,' ')}</div>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"/>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <CheckCircle size={20} className="text-emerald-400 mx-auto mb-2"/>
              <div className="font-mono text-xs text-slate-600">No appointments today</div>
            </div>
          )}
        </div>

        {/* Recent Patients */}
        <div className="hud-panel overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gold-500/10 flex items-center justify-between">
            <div className="section-heading">Recent Registrations</div>
            <Users size={12} className="text-blue-400"/>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center font-mono text-xs text-slate-600">Loading…</div>
          ) : stats?.recentPts?.length ? (
            <div className="divide-y divide-gold-500/5">
              {stats.recentPts.map((p: any) => (
                <div key={p.patient_id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gold-500/3">
                  <div className="w-7 h-7 rounded-full bg-navy-700/60 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="font-mono text-[9px] text-gold-400">
                      {p.first_name?.[0]}{p.last_name?.[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-200 truncate">{p.last_name}, {p.first_name}</div>
                    <div className="font-mono text-[9px] text-slate-600">
                      {p.insert_date ? formatDate(p.insert_date) : '—'}
                    </div>
                  </div>
                  <span className="badge bg-blue-500/10 text-blue-400 text-[8px]">New</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center font-mono text-xs text-slate-600">No patients yet</div>
          )}
        </div>

      </div>

      {/* Revenue snapshot */}
      <div className="hud-panel px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="section-heading">Revenue Cycle Snapshot</div>
          <TrendingUp size={12} className="text-gold-400"/>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-3">
          {[
            { label:'Pending Claims',    value: loading ? '…' : (stats?.pendingBilling  ?? '—'), color:'text-amber-400' },
            { label:'Open Rejections',   value: loading ? '…' : (stats?.openRejections  ?? '—'), color:'text-red-400'   },
            { label:'Auth Alerts',       value: loading ? '…' : (stats?.expiringAuths   ?? '—'), color:'text-amber-400' },
            { label:'Total A/R',         value: loading ? '…' : formatCurrency(stats?.totalAr ?? 0), color:'text-gold-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className={cn('font-display font-bold text-xl', color)}>{value}</div>
              <div className="font-mono text-[9px] text-slate-600 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
