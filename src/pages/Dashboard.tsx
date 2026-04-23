import { Users, CalendarDays, DollarSign, Activity, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

const kpis = [
  { label: 'Active Patients',     value: '—',    icon: Users,        color: 'text-blue-400',    sub: 'Total registered' },
  { label: 'Today\'s Appts',      value: '—',    icon: CalendarDays, color: 'text-gold-400',    sub: 'Scheduled today' },
  { label: 'Open Encounters',     value: '—',    icon: Activity,     color: 'text-emerald-400', sub: 'Awaiting close' },
  { label: 'A/R Balance',         value: '—',    icon: DollarSign,   color: 'text-red-400',     sub: 'Outstanding' },
]

const recentActivity = [
  { type: 'patient',    label: 'New patient registered',    time: '2 min ago',  status: 'active' },
  { type: 'encounter',  label: 'Encounter #ENC-2481 opened', time: '14 min ago', status: 'pending' },
  { type: 'payment',    label: 'Payment $125.00 received',  time: '31 min ago', status: 'active' },
  { type: 'appt',       label: 'Appointment confirmed',     time: '1 hr ago',   status: 'active' },
  { type: 'insurance',  label: 'Eligibility verified',      time: '2 hr ago',   status: 'active' },
]

export function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="section-heading mb-1">Operations Center</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">
            Dashboard
          </h1>
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

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="hud-panel hud-bracket p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="data-label">{kpi.label}</div>
              <kpi.icon size={14} className={cn('mt-0.5', kpi.color)} />
            </div>
            <div className="font-display font-bold text-3xl text-slate-100 tracking-wide">
              {kpi.value}
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-600">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Recent activity */}
        <div className="col-span-2 hud-panel p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="section-heading">Recent Activity</div>
            <button className="font-mono text-[10px] text-slate-500 hover:text-gold-400 transition-colors">
              VIEW ALL →
            </button>
          </div>
          <div className="space-y-0.5">
            {recentActivity.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-gold-500/3 transition-colors"
              >
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  item.status === 'active' ? 'bg-emerald-400' : 'bg-gold-400'
                )} />
                <span className="flex-1 text-sm text-slate-300">{item.label}</span>
                <span className="font-mono text-[10px] text-slate-600">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="hud-panel p-4">
          <div className="section-heading mb-4">Quick Actions</div>
          <div className="space-y-2">
            {[
              { label: 'Register New Patient',    icon: Users },
              { label: 'Schedule Appointment',    icon: CalendarDays },
              { label: 'Open Encounter',          icon: Activity },
              { label: 'Post Payment',            icon: DollarSign },
              { label: 'Verify Eligibility',      icon: AlertCircle },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                className="w-full flex items-center gap-3 px-3 py-2.5
                           border border-gold-500/10 rounded-sm
                           text-sm text-slate-400 hover:text-gold-300 hover:border-gold-500/30 hover:bg-gold-500/5
                           transition-all duration-150 text-left"
              >
                <Icon size={13} className="text-gold-500/60 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* System status bar */}
      <div className="hud-panel px-4 py-2.5 flex items-center gap-6">
        <div className="section-heading">System Status</div>
        {[
          { label: 'Supabase',  ok: true },
          { label: 'Database',  ok: true },
          { label: 'Auth',      ok: true },
          { label: 'Storage',   ok: true },
        ].map(({ label, ok }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', ok ? 'bg-emerald-400' : 'bg-red-400')} />
            <span className="font-mono text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
        <div className="ml-auto font-mono text-[10px] text-slate-600">
          PatientTrac Scheduling v0.1.0 · EMR Foundation Layer
        </div>
      </div>
    </div>
  )
}
