import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  CreditCard,
  Shield,
  Settings,
  Activity,
  ChevronRight,
  FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',   group: 'main' },
  { to: '/patients',   icon: Users,            label: 'Patients',    group: 'main' },
  { to: '/schedule',   icon: CalendarDays,     label: 'Schedule',    group: 'main' },
  { to: '/encounters',      icon: Activity,    label: 'Encounters',       group: 'clinical' },
  { to: '/record-requests', icon: FolderOpen,  label: 'Record Requests',  group: 'clinical' },
  { to: '/billing',    icon: CreditCard,       label: 'Billing',     group: 'financial' },
  { to: '/insurance',  icon: Shield,           label: 'Insurance',   group: 'financial' },
  { to: '/settings',   icon: Settings,         label: 'Settings',    group: 'system' },
]

const groups = [
  { id: 'main',      label: 'Operations' },
  { id: 'clinical',  label: 'Clinical' },
  { id: 'financial', label: 'Financial' },
  { id: 'system',    label: 'System' },
]

export function Sidebar() {
  return (
    <aside className="w-56 flex-shrink-0 flex flex-col border-r border-gold-500/10 bg-navy-950/60 backdrop-blur-sm">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gold-500/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 relative flex-shrink-0">
            <div className="absolute inset-0 border border-gold-500/60 rotate-45 rounded-sm" />
            <div className="absolute inset-1.5 bg-gold-500/20 rotate-45 rounded-sm" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-gold-500" />
            </div>
          </div>
          <div>
            <div className="font-display font-bold text-sm text-gold-300 tracking-wider leading-none uppercase">
              PatientTracForge
            </div>
            <div className="font-mono text-[9px] text-slate-500 tracking-widest uppercase mt-0.5">
              Scheduling
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-5 overflow-y-auto">
        {groups.map((group) => {
          const items = navItems.filter((i) => i.group === group.id)
          if (!items.length) return null
          return (
            <div key={group.id}>
              <div className="px-3 mb-1.5 section-heading text-[9px]">{group.label}</div>
              <ul className="space-y-0.5">
                {items.map(({ to, icon: Icon, label }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm transition-all duration-150',
                          isActive
                            ? 'text-gold-300 bg-gold-500/8 border-l-2 border-gold-500 pl-[10px]'
                            : 'text-slate-400 hover:text-gold-300 hover:bg-gold-500/5 border-l-2 border-transparent'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon size={14} className={isActive ? 'text-gold-400' : 'text-slate-500'} />
                          <span className="font-body">{label}</span>
                          {isActive && <ChevronRight size={10} className="ml-auto text-gold-500/50" />}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gold-500/10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[10px] text-slate-500 tracking-wider">SYSTEM ONLINE</span>
        </div>
        <div className="mt-1 font-mono text-[9px] text-slate-600">
          v0.1.0 · PatientTracForge
        </div>
      </div>
    </aside>
  )
}
