// AppShell.tsx — PatientTracForge Main Layout
// Auth guard: redirects to /admin/login if not authenticated
// MFA gate: shows TOTP challenge if mfaRequired and not yet verified
// §170.315(d)(2) — All access to clinical data requires authenticated + MFA-verified session

import { Outlet, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAuth } from '@/lib/auth'
import { Shield, Smartphone, AlertCircle, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Inline MFA challenge (shown inside AppShell before clinical content) ──
function MFAGate() {
  const { verifyTotp, mfaVerified, signOut, member } = useAuth()
  const [totp,    setTotp]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [attempts,setAttempts]= useState(0)

  async function handleVerify() {
    if (totp.length !== 6) return
    setLoading(true); setError(null)
    const { error } = await verifyTotp(totp)
    setLoading(false)
    if (error) {
      setAttempts(a => a + 1)
      setError(attempts >= 4
        ? 'Too many failed attempts. Please sign out and try again.'
        : error
      )
      setTotp('')
    }
  }

  function handleChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 6)
    setTotp(digits)
    if (digits.length === 6) {
      setTimeout(() => {
        verifyTotp(digits).then(({ error }) => {
          if (error) {
            setAttempts(a => a + 1)
            setError(error)
            setTotp('')
            setLoading(false)
          }
        })
        setLoading(true)
      }, 200)
    }
  }

  if (mfaVerified) return null

  return (
    <div className="min-h-screen bg-navy-900 bg-hud-grid flex items-center justify-center p-4">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/3 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gold-500/2 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 relative">
              <div className="absolute inset-0 border border-gold-500/60 rotate-45 rounded-sm" />
              <div className="absolute inset-2 bg-gold-500/20 rotate-45 rounded-sm" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gold-500" />
              </div>
            </div>
            <div className="text-left">
              <div className="font-display font-bold text-lg text-gold-300 tracking-wider uppercase leading-none">
                PatientTracForge
              </div>
              <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase">
                Two-Factor Authentication
              </div>
            </div>
          </div>
          <div className="hud-accent-line" />
        </div>

        <div className="hud-panel hud-bracket p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone size={14} className="text-gold-500/60" />
            <span className="section-heading">Verify Your Identity</span>
          </div>

          <div className="px-3 py-3 bg-gold-500/5 border border-gold-500/15 rounded-sm">
            <div className="text-xs text-slate-400 leading-relaxed">
              {member?.first_name ? `Welcome, ${member.first_name}. ` : ''}
              Open your <span className="text-gold-300">Google Authenticator</span> app and enter the
              6-digit code for <span className="text-gold-300">PatientTracForge</span>.
            </div>
          </div>

          <div>
            <label className="data-label block mb-1.5">Authentication Code</label>
            <input
              type="text"
              inputMode="numeric"
              value={totp}
              onChange={e => handleChange(e.target.value)}
              className={cn(
                'hud-input font-mono text-center text-2xl tracking-[0.5em] py-3',
                totp.length === 6 && 'border-gold-500/50'
              )}
              placeholder="000000"
              maxLength={6}
              autoFocus
              disabled={loading || attempts >= 5}
            />
            <div className="mt-1.5 flex justify-center gap-1">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className={cn(
                  'w-2 h-0.5 rounded-full transition-colors duration-150',
                  i < totp.length ? 'bg-gold-500' : 'bg-slate-700'
                )} />
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-sm">
              <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
              <span className="text-xs text-red-400 font-mono">{error}</span>
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={loading || totp.length < 6 || attempts >= 5}
            className="btn-primary w-full justify-center"
          >
            {loading ? <Loader size={14} className="animate-spin" /> : <Shield size={14} />}
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>

          <div className="flex items-center justify-between">
            <button
              onClick={signOut}
              className="font-mono text-[10px] text-slate-600 hover:text-red-400 transition-colors"
            >
              Sign Out
            </button>
            <div className="font-mono text-[10px] text-slate-700">
              HIPAA 45 CFR §164.312(d)
            </div>
          </div>

          <div className="px-3 py-2 border border-slate-700/50 rounded-sm">
            <div className="text-[10px] text-slate-600 font-mono">
              Code expires every 30 seconds · All access is logged · §170.315(d)(2)
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AppShell ───────────────────────────────────────────────────────────────
export function AppShell() {
  const { user, loading, mfaRequired, mfaVerified, member } = useAuth()

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin mx-auto mb-3" />
          <div className="font-mono text-xs text-slate-600">Loading PatientTracForge...</div>
        </div>
      </div>
    )
  }

  // Not authenticated — redirect to admin login
  if (!user) {
    return <Navigate to="/admin/login" replace />
  }

  // MFA required but not yet verified — show challenge gate
  if (mfaRequired && !mfaVerified) {
    // Check if MFA is not set up yet — redirect to setup
    if (member && member.mfa_enabled === false) {
      return <Navigate to="/admin/mfa-setup" replace />
    }
    return <MFAGate />
  }

  // Fully authenticated — render clinical app
  return (
    <div className="flex h-screen bg-navy-900 bg-hud-grid overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-gold-500/3 blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-80 h-80 rounded-full bg-gold-500/2 blur-3xl" />
      </div>

      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-6 py-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
