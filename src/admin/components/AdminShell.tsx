import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, Shield, CalendarDays,
  FileText, Settings, LogOut, ChevronRight, Lock,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/admin',           icon: LayoutDashboard, label: 'Overview',         resource: 'system'       as const, end: true  },
  { to: '/admin/users',     icon: Users,            label: 'Users & Staff',    resource: 'users'        as const           },
  { to: '/admin/facilities',icon: Building2,        label: 'Facilities',       resource: 'facilities'   as const           },
  { to: '/admin/appt-types',icon: CalendarDays,     label: 'Appt Types + CPT', resource: 'appointments' as const           },
  { to: '/admin/roles',     icon: Shield,           label: 'Roles & Access',   resource: 'system'       as const           },
  { to: '/admin/audit',     icon: FileText,         label: 'Audit Log',        resource: 'reports'      as const           },
  { to: '/admin/settings',  icon: Settings,         label: 'System Settings',  resource: 'system'       as const           },
]

export function AdminShell() {
  const { member, role, can, signOut, isSuperAdmin } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  return (
    <div className="flex h-screen bg-navy-900 bg-hud-grid overflow-hidden">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-gold-500/3 blur-3xl" />
      </div>

      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-gold-500/10 bg-navy-950/60">
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
              <div className="font-display font-bold text-xs text-gold-300 tracking-wider uppercase">PatientTrac</div>
              <div className="font-mono text-[9px] text-red-400/80 tracking-widest uppercase mt-0.5 flex items-center gap-1">
                <Lock size={8} />
                Admin Portal
              </div>
            </div>
          </div>
        </div>

        {/* User badge */}
        <div className="px-4 py-3 border-b border-gold-500/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-navy-700 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
              <span className="font-mono text-[9px] text-gold-400">
                {member?.first_name?.charAt(0)}{member?.last_name?.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-300 font-medium truncate">
                {member?.first_name} {member?.last_name}
              </div>
              <div className={cn(
                'font-mono text-[9px] tracking-wider uppercase',
                isSuperAdmin ? 'text-red-400' : 'text-gold-500/70'
              )}>
                {role?.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(({ to, icon: Icon, label, resource, end }) => {
              const allowed = can(resource, 'view')
              return (
                <li key={to}>
                  {allowed ? (
                    <NavLink
                      to={to}
                      end={end}
                      className={({ isActive }) => cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs transition-all duration-150 border-l-2',
                        isActive
                          ? 'text-gold-300 bg-gold-500/10 border-gold-500'
                          : 'text-slate-400 hover:text-gold-300 hover:bg-gold-500/5 border-transparent'
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon size={12} className={isActive ? 'text-gold-400' : 'text-slate-600'} />
                          <span className="flex-1">{label}</span>
                          {isActive && <ChevronRight size={9} className="text-gold-500/50" />}
                        </>
                      )}
                    </NavLink>
                  ) : (
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs text-slate-700 border-l-2 border-transparent cursor-not-allowed">
                      <Lock size={10} className="text-slate-800" />
                      <span>{label}</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Back to app + sign out */}
        <div className="px-2 py-3 border-t border-gold-500/10 space-y-1">
          <NavLink to="/" className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-gold-400 rounded-sm hover:bg-gold-500/5 transition-colors">
            <ChevronRight size={10} className="rotate-180" />
            Back to Scheduling
          </NavLink>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-red-400 rounded-sm hover:bg-red-500/5 transition-colors"
          >
            <LogOut size={11} />
            Sign Out
          </button>
        </div>
        <div className="px-4 py-2 border-t border-gold-500/10">
          <div className="font-mono text-[9px] text-slate-700">All actions are HIPAA-logged</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <Outlet />
      </div>
    </div>
  )
}
