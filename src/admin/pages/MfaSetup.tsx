import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Shield, Smartphone, CheckCircle, Copy, AlertCircle, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 'intro' | 'qr' | 'verify' | 'done'

export function MfaSetup() {
  const navigate = useNavigate()
  const [step,    setStep]    = useState<Step>('intro')
  const [qrUrl,   setQrUrl]   = useState('')
  const [secret,  setSecret]  = useState('')
  const [token,   setToken]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [copied,  setCopied]  = useState(false)

  async function startSetup() {
    setLoading(true); setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not authenticated'); setLoading(false); return }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/totp-setup?action=setup`,
      { headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } }
    )
    const data = await res.json()
    if (data.error) { setError(data.error); setLoading(false); return }

    setQrUrl(data.qr_url)
    setSecret(data.secret)
    setStep('qr')
    setLoading(false)
  }

  async function verifyCode() {
    if (token.length !== 6) return
    setLoading(true); setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not authenticated'); setLoading(false); return }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/totp-setup`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token })
      }
    )
    const data = await res.json()
    if (data.error) { setError(data.error); setLoading(false); return }
    setStep('done')
    setLoading(false)
  }

  function handleTokenChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setToken(digits)
    if (digits.length === 6) setTimeout(verifyCode, 300)
  }

  function copySecret() {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-fade-in">
      <div>
        <div className="section-heading mb-1">Security · Two-Factor Authentication</div>
        <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Set Up MFA</h1>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {[['intro','Download App'],['qr','Scan QR'],['verify','Verify'],['done','Done']].map(([s, label], i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn('flex items-center gap-1.5 text-xs font-mono',
              step === s ? 'text-gold-400' : ['done','verify','qr'].indexOf(step) > ['intro','qr','verify','done'].indexOf(s as any) ? 'text-emerald-400' : 'text-slate-600')}>
              <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] border',
                step === s ? 'border-gold-500 bg-gold-500/20 text-gold-400' :
                'border-slate-700 text-slate-600')}>{i+1}</div>
              {label}
            </div>
            {i < 3 && <div className="w-6 h-px bg-slate-700" />}
          </div>
        ))}
      </div>

      <div className="hud-panel hud-bracket p-6 space-y-5">

        {step === 'intro' && (
          <>
            <div className="flex items-start gap-3">
              <Smartphone size={20} className="text-gold-500/60 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-200 mb-1">Google Authenticator Required</div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  PatientTracForge requires two-factor authentication for all admin and provider accounts.
                  You'll need the Google Authenticator app installed on your phone.
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { step: '1', text: 'Install Google Authenticator on iOS or Android' },
                { step: '2', text: 'Click Continue to generate your QR code' },
                { step: '3', text: 'Scan the QR code with the app' },
                { step: '4', text: 'Enter the 6-digit code to activate' },
              ].map(({ step: s, text }) => (
                <div key={s} className="flex items-center gap-3 px-3 py-2 bg-navy-950/40 rounded-sm">
                  <div className="w-5 h-5 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="font-mono text-[10px] text-gold-400">{s}</span>
                  </div>
                  <span className="text-xs text-slate-300">{text}</span>
                </div>
              ))}
            </div>
            <button onClick={startSetup} disabled={loading} className="btn-primary w-full justify-center">
              {loading ? <Loader size={14} className="animate-spin" /> : <Shield size={14} />}
              {loading ? 'Generating...' : 'Continue — Generate QR Code'}
            </button>
          </>
        )}

        {step === 'qr' && (
          <>
            <div className="text-center">
              <div className="text-sm text-slate-300 mb-4">
                Open <span className="text-gold-300 font-medium">Google Authenticator</span> → tap <span className="text-gold-300">+</span> → <span className="text-gold-300">Scan a QR code</span>
              </div>
              {qrUrl && (
                <div className="inline-block p-3 bg-white rounded-sm mb-4">
                  <img src={qrUrl} alt="MFA QR Code" className="w-48 h-48" />
                </div>
              )}
            </div>
            <div className="hud-panel px-3 py-2.5">
              <div className="data-label mb-1">Manual entry key (if QR doesn't scan)</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs text-gold-400 tracking-widest break-all">{secret}</code>
                <button onClick={copySecret} className={cn('btn-ghost text-xs py-1 px-2 flex-shrink-0',
                  copied ? 'text-emerald-400' : '')}>
                  {copied ? <CheckCircle size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <button onClick={() => setStep('verify')} className="btn-primary w-full justify-center">
              I've scanned the code →
            </button>
          </>
        )}

        {step === 'verify' && (
          <>
            <div className="text-center">
              <div className="text-sm text-slate-300 mb-2">
                Enter the <span className="text-gold-300">6-digit code</span> from Google Authenticator
              </div>
              <div className="text-xs text-slate-600 mb-5">The code refreshes every 30 seconds</div>
              <input
                type="text" inputMode="numeric" autoFocus
                value={token}
                onChange={e => handleTokenChange(e.target.value)}
                className={cn('hud-input font-mono text-center text-3xl tracking-[0.6em] py-4 max-w-xs mx-auto block',
                  token.length === 6 && 'border-gold-500/50')}
                placeholder="000000"
                maxLength={6}
              />
              <div className="flex justify-center gap-1 mt-3">
                {[0,1,2,3,4,5].map(i => (
                  <div key={i} className={cn('w-2 h-0.5 rounded-full transition-colors',
                    i < token.length ? 'bg-gold-500' : 'bg-slate-700')} />
                ))}
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-sm">
                <AlertCircle size={13} className="text-red-400" />
                <span className="text-xs text-red-400 font-mono">{error}</span>
              </div>
            )}
            <button onClick={verifyCode} disabled={loading || token.length < 6} className="btn-primary w-full justify-center">
              {loading ? <Loader size={14} className="animate-spin" /> : <Shield size={14} />}
              {loading ? 'Verifying...' : 'Verify & Activate MFA'}
            </button>
            <button onClick={() => setStep('qr')} className="w-full text-center font-mono text-[10px] text-slate-600 hover:text-gold-400">
              ← Back to QR code
            </button>
          </>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <div>
              <div className="font-display font-bold text-lg text-slate-100 mb-1">MFA Activated</div>
              <div className="text-xs text-slate-500">
                Google Authenticator is now required to sign in to PatientTracForge.
                Keep your phone secure — it's your second factor.
              </div>
            </div>
            <div className="px-4 py-3 bg-amber-500/5 border border-amber-500/15 rounded-sm text-left">
              <div className="text-xs text-amber-300 font-medium mb-1">Important</div>
              <div className="text-xs text-slate-500">
                If you lose access to your authenticator app, contact your system administrator to reset MFA.
                Screenshot or write down your backup key shown on the previous screen.
              </div>
            </div>
            <button onClick={() => navigate('/admin')} className="btn-primary w-full justify-center">
              Go to Admin Dashboard →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
