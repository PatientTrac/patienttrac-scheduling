/**
 * AuthContext — PatientTracForge Auth + RBAC + MFA
 * 
 * Flow:
 * 1. User signs in with email + password (Supabase Auth)
 * 2. If mfa_enabled → TOTP challenge (Google Authenticator)
 * 3. On success → load org_member record → inject role into context
 * 4. All UI gated by usePermission() hook
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export type UserRole = 'super_admin' | 'admin' | 'provider' | 'billing' | 'staff' | 'readonly'

export type Resource = 'facilities' | 'users' | 'patients' | 'insurance' | 'appointments' | 'billing' | 'reports' | 'system'

export interface OrgMember {
  id:             string
  org_id:         string
  user_id:        string
  role:           UserRole
  email:          string
  first_name:     string
  last_name:      string
  facility_id:    number | null
  is_active:      boolean
  mfa_enabled:    boolean
  mfa_verified_at: string | null
  last_login_at:  string | null
}

export interface AuthState {
  user:          User | null
  session:       Session | null
  member:        OrgMember | null
  role:          UserRole | null
  orgId:         string | null
  loading:       boolean
  mfaRequired:   boolean
  mfaVerified:   boolean
  signIn:        (email: string, password: string) => Promise<{ error: string | null }>
  verifyTotp:    (token: string) => Promise<{ error: string | null }>
  signOut:       () => Promise<void>
  can:           (resource: Resource, action: 'view' | 'create' | 'edit' | 'delete') => boolean
  isSuperAdmin:  boolean
  isAdmin:       boolean
}

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001'

// Permission matrix — mirrors the DB seed
const PERMISSIONS: Record<UserRole, Record<Resource, Record<string, boolean>>> = {
  super_admin: {
    facilities:   { view: true,  create: true,  edit: true,  delete: true  },
    users:        { view: true,  create: true,  edit: true,  delete: true  },
    patients:     { view: true,  create: true,  edit: true,  delete: true  },
    insurance:    { view: true,  create: true,  edit: true,  delete: true  },
    appointments: { view: true,  create: true,  edit: true,  delete: true  },
    billing:      { view: true,  create: true,  edit: true,  delete: true  },
    reports:      { view: true,  create: true,  edit: true,  delete: true  },
    system:       { view: true,  create: true,  edit: true,  delete: true  },
  },
  admin: {
    facilities:   { view: true,  create: false, edit: false, delete: false },
    users:        { view: true,  create: true,  edit: true,  delete: true  },
    patients:     { view: true,  create: true,  edit: true,  delete: false },
    insurance:    { view: true,  create: true,  edit: true,  delete: false },
    appointments: { view: true,  create: true,  edit: true,  delete: true  },
    billing:      { view: true,  create: true,  edit: true,  delete: false },
    reports:      { view: true,  create: false, edit: false, delete: false },
    system:       { view: false, create: false, edit: false, delete: false },
  },
  provider: {
    facilities:   { view: true,  create: false, edit: false, delete: false },
    users:        { view: false, create: false, edit: false, delete: false },
    patients:     { view: true,  create: true,  edit: true,  delete: false },
    insurance:    { view: true,  create: false, edit: false, delete: false },
    appointments: { view: true,  create: true,  edit: true,  delete: false },
    billing:      { view: true,  create: false, edit: false, delete: false },
    reports:      { view: true,  create: false, edit: false, delete: false },
    system:       { view: false, create: false, edit: false, delete: false },
  },
  billing: {
    facilities:   { view: true,  create: false, edit: false, delete: false },
    users:        { view: false, create: false, edit: false, delete: false },
    patients:     { view: true,  create: false, edit: false, delete: false },
    insurance:    { view: true,  create: true,  edit: true,  delete: false },
    appointments: { view: true,  create: false, edit: false, delete: false },
    billing:      { view: true,  create: true,  edit: true,  delete: false },
    reports:      { view: true,  create: false, edit: false, delete: false },
    system:       { view: false, create: false, edit: false, delete: false },
  },
  staff: {
    facilities:   { view: true,  create: false, edit: false, delete: false },
    users:        { view: false, create: false, edit: false, delete: false },
    patients:     { view: true,  create: true,  edit: true,  delete: false },
    insurance:    { view: true,  create: true,  edit: false, delete: false },
    appointments: { view: true,  create: true,  edit: true,  delete: false },
    billing:      { view: true,  create: false, edit: false, delete: false },
    reports:      { view: false, create: false, edit: false, delete: false },
    system:       { view: false, create: false, edit: false, delete: false },
  },
  readonly: {
    facilities:   { view: true,  create: false, edit: false, delete: false },
    users:        { view: false, create: false, edit: false, delete: false },
    patients:     { view: true,  create: false, edit: false, delete: false },
    insurance:    { view: true,  create: false, edit: false, delete: false },
    appointments: { view: true,  create: false, edit: false, delete: false },
    billing:      { view: true,  create: false, edit: false, delete: false },
    reports:      { view: true,  create: false, edit: false, delete: false },
    system:       { view: false, create: false, edit: false, delete: false },
  },
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null)
  const [session,     setSession]     = useState<Session | null>(null)
  const [member,      setMember]      = useState<OrgMember | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaVerified, setMfaVerified] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadMember(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadMember(session.user.id)
      else { setMember(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadMember(userId: string) {
    const { data } = await supabase
      .schema('saas')
      .from('org_members')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (data) {
      setMember(data as OrgMember)
      if (data.mfa_enabled && !data.mfa_verified_at) {
        setMfaRequired(true)
      }
    }
    setLoading(false)
  }

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (!data.user) return { error: 'Sign in failed' }
    return { error: null }
  }

  async function verifyTotp(token: string): Promise<{ error: string | null }> {
    // In production: validate TOTP token server-side via Edge Function
    // For now: mark as verified if 6 digits provided
    if (!/^\d{6}$/.test(token)) return { error: 'Enter the 6-digit code from your authenticator' }
    
    const { error } = await supabase
      .schema('saas')
      .from('org_members')
      .update({ mfa_verified_at: new Date().toISOString() })
      .eq('user_id', user?.id)

    if (error) return { error: error.message }
    setMfaVerified(true)
    setMfaRequired(false)
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setMember(null)
    setMfaRequired(false)
    setMfaVerified(false)
  }

  function can(resource: Resource, action: 'view' | 'create' | 'edit' | 'delete'): boolean {
    if (!member?.role) return false
    return PERMISSIONS[member.role]?.[resource]?.[action] ?? false
  }

  const role     = member?.role ?? null
  const orgId    = member?.org_id ?? DEV_ORG_ID

  return (
    <AuthContext.Provider value={{
      user, session, member, role, orgId, loading,
      mfaRequired, mfaVerified,
      signIn, verifyTotp, signOut, can,
      isSuperAdmin: role === 'super_admin',
      isAdmin: role === 'super_admin' || role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function usePermission(resource: Resource, action: 'view' | 'create' | 'edit' | 'delete'): boolean {
  const { can } = useAuth()
  return can(resource, action)
}
