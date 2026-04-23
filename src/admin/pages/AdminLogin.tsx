import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Shield, Eye, EyeOff, Loader, AlertCircle, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 'credentials' | 'mfa'

export function AdminLogin() {
  const { signIn, verifyTotp, mfaRequired } = useAuth()
  const navigate = useNavigate()
  const [step,      setStep]      = useState<Step>('credentials')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [totp,      setTotp]      = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) { setError(error); return }
    if (mfaRequired) setStep('mfa')
    else navigate('/admin')
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await verifyTotp(totp)
    setLoading(false)
    if (error) { setError(error); return }
    navigate('/admin')
  }

  // Auto-submit TOTP when 6 digits entered
  function handleTotpChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setTotp(digits)
    if (digits.length === 6) {
      setTimeout(() => {
        const syntheticEvent = { preventDefault: () => {} } as React.FormEvent
        handleMfa(syntheticEvent)
      }, 200)
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 bg-hud-grid flex items-center justify-center p-4">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/3 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gold-500/2 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
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
                Admin Portal
              </div>
            </div>
          </div>
          <div className="hud-accent-line" />
        </div>

        {/* Card */}
        <div className="hud-panel hud-bracket p-6 space-y-5">
          {step === 'credentials' && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={14} className="text-gold-500/60" />
                <span className="section-heading">Secure Sign In</span>
              </div>

              <form onSubmit={handleCredentials} className="space-y-4">
                <div>
                  <label className="data-label block mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="hud-input"
                    placeholder="admin@practice.com"
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <label className="data-label block mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="hud-input pr-10"
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-gold-400"
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-sm">
                    <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-400 font-mono">{error}</span>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                  {loading
                    ? <Loader size={14} className="animate-spin" />
                    : <Shield size={14} />
                  }
                  {loading ? 'Verifying...' : 'Sign In'}
                </button>
              </form>

              <div className="text-center">
                <button className="font-mono text-[10px] text-slate-600 hover:text-gold-400 transition-colors">
                  Forgot password?
                </button>
              </div>
            </>
          )}

          {step === 'mfa' && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Smartphone size={14} className="text-gold-500/60" />
                <span className="section-heading">Two-Factor Authentication</span>
              </div>

              <div className="px-3 py-3 bg-gold-500/5 border border-gold-500/15 rounded-sm">
                <div className="text-xs text-slate-400 leading-relaxed">
                  Open your <span className="text-gold-300">Google Authenticator</span> app and enter the 6-digit code for PatientTracForge.
                </div>
              </div>

              <form onSubmit={handleMfa} className="space-y-4">
                <div>
                  <label className="data-label block mb-1.5">Authentication Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={totp}
                    onChange={e => handleTotpChange(e.target.value)}
                    className={cn(
                      'hud-input font-mono text-center text-2xl tracking-[0.5em] py-3',
                      totp.length === 6 && 'border-gold-500/50'
                    )}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                  />
                  <div className="mt-1.5 flex justify-center gap-1">
                    {[0,1,2,3,4,5].map(i => (
                      <div
                        key={i}
                        className={cn(
                          'w-2 h-0.5 rounded-full transition-colors duration-150',
                          i < totp.length ? 'bg-gold-500' : 'bg-slate-700'
                        )}
                      />
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-sm">
                    <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-400 font-mono">{error}</span>
                  </div>
                )}

                <button type="submit" disabled={loading || totp.length < 6} className="btn-primary w-full justify-center">
                  {loading ? <Loader size={14} className="animate-spin" /> : <Shield size={14} />}
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setTotp(''); setError(null) }}
                  className="w-full text-center font-mono text-[10px] text-slate-600 hover:text-gold-400"
                >
                  ← Back to sign in
                </button>
              </form>

              <div className="px-3 py-2 border border-slate-700/50 rounded-sm">
                <div className="text-[10px] text-slate-600 font-mono">
                  Code expires every 30 seconds · Don't share this code with anyone
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-4 font-mono text-[10px] text-slate-700">
          PatientTracForge · HIPAA Compliant · All access logged
        </div>
      </div>
    </div>
  )
}
