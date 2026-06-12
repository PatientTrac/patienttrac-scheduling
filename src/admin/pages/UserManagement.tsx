import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Shield, Smartphone, Mail, MoreHorizontal } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth, type UserRole } from '@/lib/auth'
import { cn, formatDate } from '@/lib/utils'

const ROLES: { value: UserRole; label: string; desc: string; color: string }[] = [
  { value: 'super_admin', label: 'Super Admin', desc: 'Full system access incl. facilities', color: 'text-red-400'     },
  { value: 'admin',       label: 'Admin',       desc: 'Users, patients, insurance, appts',  color: 'text-gold-400'    },
  { value: 'provider',    label: 'Provider',    desc: 'Clinical access, own patients',       color: 'text-blue-400'    },
  { value: 'billing',     label: 'Billing',     desc: 'Financial & insurance only',          color: 'text-emerald-400' },
  { value: 'staff',       label: 'Staff',       desc: 'Scheduling & patient lookup',         color: 'text-slate-300'   },
  { value: 'readonly',    label: 'Read Only',   desc: 'View only access',                   color: 'text-slate-500'   },
]

export function UserManagement() {
  const { orgId, can, isSuperAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', first_name: '', last_name: '', role: 'staff' as UserRole })

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_members').select('*').eq('org_id', orgId!).order('created_at')
      if (error) throw error
      return data
    },
  })

  const inviteMutation = useMutation({
    mutationFn: async (form: typeof inviteForm) => {
      // In production: Supabase Edge Function sends invite email
      // For now: create org_member record with invite_token
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
      const { error } = await supabase.from('org_members').insert({
        org_id:          orgId,
        user_id:         crypto.randomUUID(), // placeholder until they accept invite
        email:           form.email,
        first_name:      form.first_name,
        last_name:       form.last_name,
        role:            form.role,
        is_active:       false,
        mfa_enabled:     false,
        invite_token:    token,
        invite_sent_at:  new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
      setShowInvite(false)
      setInviteForm({ email: '', first_name: '', last_name: '', role: 'staff' })
    },
  })

  const toggleMfa = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from('org_members')
        .update({ mfa_enabled: enabled }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-members'] }),
  })

  const filtered = members.filter(m =>
    !search || `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase().includes(search.toLowerCase())
  )

  const canCreate = can('users', 'create')
  const canEdit   = can('users', 'edit')

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <div className="section-heading mb-1">Admin · User Management</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Users & Staff</h1>
        </div>
        {canCreate && (
          <button onClick={() => setShowInvite(true)} className="btn-primary">
            <Plus size={14} />
            Invite User
          </button>
        )}
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-3 gap-2">
        {ROLES.filter(r => isSuperAdmin || r.value !== 'super_admin').map(r => (
          <div key={r.value} className="hud-panel px-3 py-2 flex items-center gap-2">
            <Shield size={11} className={r.color} />
            <div>
              <div className={cn('text-xs font-medium', r.color)}>{r.label}</div>
              <div className="text-[10px] text-slate-600">{r.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="hud-panel px-4 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="hud-input pl-8 text-xs" placeholder="Search users..." />
        </div>
        <div className="ml-auto font-mono text-xs text-slate-600">{filtered.length} users</div>
      </div>

      {/* User table */}
      <div className="hud-panel overflow-hidden">
        <table className="hud-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>MFA</th>
              <th>Last Login</th>
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-10">
                <div className="inline-flex items-center gap-2 text-slate-500">
                  <div className="w-4 h-4 border border-gold-500/40 border-t-gold-500 rounded-full animate-spin" />
                  <span className="font-mono text-xs">Loading...</span>
                </div>
              </td></tr>
            )}
            {filtered.map(m => {
              const role = ROLES.find(r => r.value === m.role)
              return (
                <tr key={m.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-sm bg-navy-700 border border-gold-500/20 flex items-center justify-center">
                        <span className="font-mono text-[9px] text-gold-400">
                          {m.first_name?.charAt(0)}{m.last_name?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm text-slate-200">{m.first_name} {m.last_name}</div>
                        <div className="font-mono text-[10px] text-slate-600">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={cn('flex items-center gap-1 text-xs font-medium', role?.color)}>
                      <Shield size={10} />
                      {role?.label ?? m.role}
                    </div>
                  </td>
                  <td>
                    <span className={cn('badge', m.is_active ? 'badge-active' : m.invite_token ? 'badge-pending' : 'badge-inactive')}>
                      {m.is_active ? 'active' : m.invite_token ? 'invited' : 'inactive'}
                    </span>
                  </td>
                  <td>
                    {canEdit ? (
                      <button
                        onClick={() => toggleMfa.mutate({ id: m.id, enabled: !m.mfa_enabled })}
                        className={cn('flex items-center gap-1.5 text-xs transition-colors',
                          m.mfa_enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-600 hover:text-gold-400')}
                      >
                        <Smartphone size={11} />
                        {m.mfa_enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    ) : (
                      <span className={cn('flex items-center gap-1 text-xs', m.mfa_enabled ? 'text-emerald-400' : 'text-slate-600')}>
                        <Smartphone size={10} />
                        {m.mfa_enabled ? 'On' : 'Off'}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="font-mono text-[10px] text-slate-600">
                      {m.last_login_at ? formatDate(m.last_login_at) : 'Never'}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <div className="flex items-center gap-2">
                        {m.invite_token && !m.is_active && (
                          <button className="font-mono text-[10px] text-gold-500 hover:text-gold-300 flex items-center gap-1">
                            <Mail size={10} />
                            Resend
                          </button>
                        )}
                        <button className="text-slate-600 hover:text-gold-400 transition-colors">
                          <MoreHorizontal size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80">
          <div className="hud-panel w-full max-w-md">
            <div className="px-5 py-4 border-b border-gold-500/10 flex items-center justify-between">
              <div className="section-heading">Invite New User</div>
              <button onClick={() => setShowInvite(false)} className="btn-ghost text-xs">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="data-label block mb-1.5">First Name</label>
                  <input value={inviteForm.first_name} onChange={e => setInviteForm(f => ({ ...f, first_name: e.target.value }))} className="hud-input" placeholder="First name" />
                </div>
                <div>
                  <label className="data-label block mb-1.5">Last Name</label>
                  <input value={inviteForm.last_name} onChange={e => setInviteForm(f => ({ ...f, last_name: e.target.value }))} className="hud-input" placeholder="Last name" />
                </div>
              </div>
              <div>
                <label className="data-label block mb-1.5">Email Address</label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} className="hud-input" placeholder="user@practice.com" />
              </div>
              <div>
                <label className="data-label block mb-1.5">Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as UserRole }))} className="hud-input">
                  {ROLES.filter(r => isSuperAdmin || r.value !== 'super_admin').map(r => (
                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                  ))}
                </select>
              </div>
              <div className="px-3 py-2 bg-gold-500/5 border border-gold-500/10 rounded-sm">
                <div className="text-[10px] text-slate-500 font-mono">
                  User will receive an email invitation · MFA setup required on first login
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gold-500/10 flex justify-end gap-3">
              <button onClick={() => setShowInvite(false)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={() => inviteMutation.mutate(inviteForm)} disabled={inviteMutation.isPending} className="btn-primary text-xs">
                {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
