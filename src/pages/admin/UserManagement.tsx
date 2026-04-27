import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrgMember {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string
  facility_id: number | null
  is_active: boolean
  mfa_enabled: boolean
  invite_sent_at: string | null
  invite_accepted_at: string | null
  last_login_at: string | null
  created_at: string
}

interface Facility {
  facility_id: number
  facility_name: string
}

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  super_admin: { bg: 'rgba(201,169,110,0.15)', text: '#c9a96e', label: 'Super Admin' },
  admin:       { bg: 'rgba(59,91,219,0.15)',   text: '#7b9ef7', label: 'Admin' },
  provider:    { bg: 'rgba(0,212,255,0.12)',   text: '#00d4ff', label: 'Provider' },
  billing:     { bg: 'rgba(52,199,89,0.15)',   text: '#34c759', label: 'Billing' },
  staff:       { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.6)', label: 'Staff' },
  readonly:    { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.4)', label: 'Read Only' },
}

// ── Invite status helper ──────────────────────────────────────────────────────
function inviteStatus(m: OrgMember): { label: string; color: string; canSend: boolean } {
  if (m.invite_accepted_at) return { label: 'Active', color: '#34c759', canSend: false }
  if (!m.is_active && m.invite_sent_at) return { label: 'Invite sent', color: '#f59e0b', canSend: true }
  if (!m.is_active && !m.invite_sent_at) return { label: 'Not invited', color: '#ef4444', canSend: true }
  if (m.is_active && m.last_login_at) return { label: 'Active', color: '#34c759', canSend: false }
  return { label: 'Pending', color: '#f59e0b', canSend: true }
}

// ── New Member Modal ──────────────────────────────────────────────────────────
function NewMemberModal({ facilities, onClose, onCreated }: {
  facilities: Facility[]
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', role: 'provider', facility_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!form.email || !form.first_name || !form.last_name) { setError('All fields required'); return }
    setSaving(true); setError('')
    try {
      // Create auth user
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: form.email,
        password: Math.random().toString(36).slice(-12) + '!A1',
        email_confirm: false,
      })
      if (authErr) throw authErr

      // Create org_member
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('')

      const { data: member, error: memberErr } = await supabase
        .from('org_members')
        .insert({
          org_id: '00000000-0000-0000-0000-000000000001',
          user_id: authData.user.id,
          email: form.email,
          first_name: form.first_name,
          last_name: form.last_name,
          role: form.role,
          facility_id: form.facility_id ? Number(form.facility_id) : null,
          is_active: false,
          mfa_enabled: false,
          invite_token: token,
          invite_sent_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (memberErr) throw memberErr
      onCreated(member.id)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#0d1b2e', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 12, width: 480, padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ color: '#c9a96e', fontSize: 16, fontWeight: 600 }}>New Team Member</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {[
          { key: 'first_name', label: 'First Name', placeholder: 'Constantino' },
          { key: 'last_name', label: 'Last Name', placeholder: 'Mendieta' },
          { key: 'email', label: 'Email Address', placeholder: 'doctor@practice.com' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'rgba(201,169,110,0.7)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>{f.label}</label>
            <input
              value={(form as any)[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none' }}
            />
          </div>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'rgba(201,169,110,0.7)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              style={{ width: '100%', background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none' }}>
              {Object.entries(ROLE_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'rgba(201,169,110,0.7)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>Facility</label>
            <select value={form.facility_id} onChange={e => setForm(p => ({ ...p, facility_id: e.target.value }))}
              style={{ width: '100%', background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none' }}>
              <option value="">— None —</option>
              {facilities.map(f => <option key={f.facility_id} value={f.facility_id}>{f.facility_name.replace('PatientTracForge ', '')}</option>)}
            </select>
          </div>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleCreate} disabled={saving}
            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#c9a96e', color: '#060e1c', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Creating…' : 'Create & Send Invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function UserManagement() {
  const queryClient = useQueryClient()
  const [showNewModal, setShowNewModal] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  // ── Fetch members ──────────────────────────────────────────────────────────
  const { data: members = [], isLoading } = useQuery<OrgMember[]>({
    queryKey: ['org_members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_members')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ['facilities'],
    queryFn: async () => {
      const { data, error } = await supabase.from('facilities').select('facility_id, facility_name')
      if (error) throw error
      return data
    },
  })

  // ── Send invite ────────────────────────────────────────────────────────────
  const sendInvite = async (memberId: string) => {
    setInviting(memberId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ member_id: memberId, invited_by_name: 'Wayne Hayes' }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      showToast(`Invite sent to ${json.email}`)
      queryClient.invalidateQueries({ queryKey: ['org_members'] })
    } catch (e: any) {
      showToast(`Error: ${e.message}`, true)
    } finally {
      setInviting(null)
    }
  }

  // ── Toggle active ──────────────────────────────────────────────────────────
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('org_members').update({ is_active: !is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org_members'] }),
  })

  const showToast = (msg: string, isError = false) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const handleCreated = async (memberId: string) => {
    setShowNewModal(false)
    queryClient.invalidateQueries({ queryKey: ['org_members'] })
    await sendInvite(memberId)
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = members.filter(m => {
    const matchSearch = search === '' ||
      `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || m.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div style={{ fontFamily: 'var(--font-sans, sans-serif)', padding: '28px 32px', maxWidth: 1100 }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', top: 24, right: 24, background: toastMsg.startsWith('Error') ? '#7f1d1d' : '#052e16', border: `1px solid ${toastMsg.startsWith('Error') ? '#ef4444' : '#34c759'}`, borderRadius: 10, padding: '12px 20px', color: '#fff', fontSize: 13, zIndex: 2000, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#fff', margin: 0 }}>Team Members</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
            {members.filter(m => m.is_active).length} active · {members.filter(m => !m.invite_accepted_at && m.invite_sent_at).length} invite pending · {members.length} total
          </p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#c9a96e', border: 'none', borderRadius: 8, color: '#060e1c', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Add Member
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 14px', color: '#fff', fontSize: 13, outline: 'none' }}/>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 14px', color: 'rgba(255,255,255,0.7)', fontSize: 13, outline: 'none' }}>
          <option value="all">All Roles</option>
          {Object.entries(ROLE_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 140px', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {['Member', 'Role', 'Facility', 'MFA', 'Status', 'Actions'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: 'rgba(201,169,110,0.6)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>

        {isLoading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Loading…</div>
        )}

        {filtered.map((member, i) => {
          const status = inviteStatus(member)
          const role = ROLE_COLORS[member.role] ?? ROLE_COLORS.readonly
          const isInviting = inviting === member.id
          const facilityName = facilities.find(f => f.facility_id === member.facility_id)?.facility_name
            ?.replace('PatientTracForge ', '') ?? '—'

          return (
            <div key={member.id}
              style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 140px', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>

              {/* Member */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: member.is_active ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  {member.first_name} {member.last_name}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{member.email}</div>
              </div>

              {/* Role badge */}
              <div>
                <span style={{ display: 'inline-block', background: role.bg, color: role.text, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {role.label}
                </span>
              </div>

              {/* Facility */}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{facilityName}</div>

              {/* MFA */}
              <div>
                <span style={{ fontSize: 12, color: member.mfa_enabled ? '#34c759' : 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: member.mfa_enabled ? '#34c759' : 'rgba(255,255,255,0.2)', display: 'inline-block' }}/>
                  {member.mfa_enabled ? 'Enabled' : 'Off'}
                </span>
              </div>

              {/* Status */}
              <div>
                <span style={{ fontSize: 12, color: status.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color, display: 'inline-block' }}/>
                  {status.label}
                </span>
                {member.invite_sent_at && !member.invite_accepted_at && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                    Sent {new Date(member.invite_sent_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6 }}>
                {status.canSend && (
                  <button onClick={() => sendInvite(member.id)} disabled={isInviting}
                    style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: isInviting ? 'rgba(201,169,110,0.2)' : 'rgba(201,169,110,0.15)', color: '#c9a96e', fontSize: 11, fontWeight: 600, cursor: isInviting ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                    {isInviting ? '…' : member.invite_sent_at ? '↺ Resend' : '✉ Invite'}
                  </button>
                )}
                <button
                  onClick={() => toggleActive.mutate({ id: member.id, is_active: member.is_active })}
                  title={member.is_active ? 'Deactivate' : 'Activate'}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer' }}>
                  {member.is_active ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          )
        })}

        {!isLoading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No members found</div>
        )}
      </div>

      {/* HIPAA notice */}
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 16 }}>
        All user actions are logged to the HIPAA audit trail · MFA required for provider and admin roles
      </p>

      {/* New member modal */}
      {showNewModal && (
        <NewMemberModal facilities={facilities} onClose={() => setShowNewModal(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
