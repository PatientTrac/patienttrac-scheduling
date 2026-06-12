import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, UserPlus } from 'lucide-react'
import { AppLauncher } from './AppLauncher'

const breadcrumbs: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/patients':   'Patients',
  '/patients/new': 'New Patient',
  '/schedule':   'Schedule',
  '/encounters': 'Encounters',
  '/billing':    'Billing',
  '/insurance':  'Insurance',
  '/settings':   'Settings',
}

export function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const label = breadcrumbs[location.pathname] ?? 'PatientTracForge'

  return (
    <header className="h-14 flex-shrink-0 flex items-center gap-4 px-6 border-b border-gold-500/10 bg-navy-950/40 backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-1">
        <span className="font-mono text-[10px] text-slate-600 tracking-widest uppercase">PTF</span>
        <span className="text-slate-700">/</span>
        <span className="font-display font-semibold text-sm text-gold-300 tracking-wide uppercase">
          {label}
        </span>
      </div>

      {/* Search */}
      <div className="relative w-64">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          type="text"
          placeholder="Search patients, encounters..."
          className="w-full pl-8 pr-3 py-1.5 bg-navy-800/60 border border-gold-500/15 rounded-sm
                     text-xs font-body text-slate-300 placeholder-slate-600
                     focus:outline-none focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/15
                     transition-all duration-150"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <AppLauncher />
        <button
          onClick={() => navigate('/patients/new')}
          className="btn-primary py-1.5 text-xs"
        >
          <UserPlus size={13} />
          New Patient
        </button>

        <button className="relative p-2 text-slate-500 hover:text-gold-400 transition-colors">
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-gold-500" />
        </button>

        {/* User avatar placeholder */}
        <div className="w-7 h-7 rounded-sm bg-navy-700 border border-gold-500/20 flex items-center justify-center">
          <span className="font-mono text-[10px] text-gold-400">WH</span>
        </div>
      </div>
    </header>
  )
}
