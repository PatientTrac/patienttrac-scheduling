import { useQuery } from '@tanstack/react-query'
import { Users, Building2, Shield, Activity, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export function AdminOverview() {
  const { member, role, isSuperAdmin } = useAuth()

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [usersRes, facilitiesRes, apptTypesRes] = await Promise.all([
        supabase.from('org_members').select('id, role, is_active', { count: 'exact' }),
        supabase.schema('cr').from('facilities').select('facility_id', { count: 'exact' }),
        supabase.from('appointment_types').select('appt_type_id', { count: 'exact' }),
      ])
      return {
        totalUsers:     usersRes.count ?? 0,
        totalFacilities: facilitiesRes.count ?? 0,
        totalApptTypes: apptTypesRes.count ?? 0,
      }
    },
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <div className="section-heading mb-1">Admin Portal</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Overview</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn('badge', isSuperAdmin ? 'badge-urgent' : 'badge-pending')}>
            {role?.replace('_', ' ')}
          </div>
          {member?.mfa_enabled && <div className="badge badge-active">MFA ON</div>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Users & Staff',     value: stats?.totalUsers ?? '—',       icon: Users,     color: 'text-blue-400'    },
          { label: 'Facilities',        value: stats?.totalFacilities ?? '—',  icon: Building2, color: 'text-gold-400'    },
          { label: 'Appointment Types', value: stats?.totalApptTypes ?? '—',   icon: Activity,  color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="hud-panel hud-bracket p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="data-label">{label}</div>
              <Icon size={14} className={cn('mt-0.5', color)} />
            </div>
            <div className="font-display font-bold text-3xl text-slate-100">{value}</div>
          </div>
        ))}
      </div>

      {/* Role matrix */}
      <div className="hud-panel p-5">
        <div className="section-heading mb-4">Role Access Matrix</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gold-500/10">
                <th className="py-2 px-3 text-left font-mono text-slate-500 uppercase tracking-widest">Resource</th>
                {['super_admin','admin','provider','billing','staff','readonly'].map(r => (
                  <th key={r} className="py-2 px-3 text-center font-mono text-slate-500 uppercase tracking-widest">{r.replace('_',' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['facilities','users','patients','insurance','appointments','billing','reports','system'].map(resource => (
                <tr key={resource} className="border-b border-white/5 hover:bg-gold-500/3">
                  <td className="py-2 px-3 font-mono text-slate-400 capitalize">{resource}</td>
                  {[
                    { r:'super_admin', f:true, c:true, e:true, d:true   },
                    { r:'admin',       f:resource!=='system', c:resource==='users'||resource==='appointments'||resource==='billing', e:true, d:resource==='users'||resource==='appointments' },
                    { r:'provider',    f:resource!=='users'&&resource!=='system', c:resource==='patients'||resource==='appointments', e:resource==='patients', d:false },
                    { r:'billing',     f:resource!=='users'&&resource!=='system', c:resource==='insurance'||resource==='billing', e:resource==='insurance'||resource==='billing', d:false },
                    { r:'staff',       f:resource!=='users'&&resource!=='reports'&&resource!=='system', c:resource==='patients'||resource==='appointments'||resource==='insurance', e:resource==='patients'||resource==='appointments', d:false },
                    { r:'readonly',    f:resource!=='users'&&resource!=='system', c:false, e:false, d:false },
                  ].map(({ r, f }) => (
                    <td key={r} className="py-2 px-3 text-center">
                      <span className={cn('inline-block w-4 h-4 rounded-full', f ? 'bg-emerald-500/30 text-emerald-400' : 'bg-slate-800 text-slate-700')}>
                        {f ? '✓' : '·'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security notice */}
      <div className="hud-panel border-amber-500/20 px-4 py-3 flex items-start gap-3">
        <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-slate-400">
          <span className="text-amber-300 font-medium">MFA Required for Admin Access.</span>
          {' '}All admin actions are logged to the HIPAA audit trail. Facility management is restricted to Super Admin only.
          Users without MFA enabled will be prompted to set up Google Authenticator on next login.
        </div>
      </div>
    </div>
  )
}
