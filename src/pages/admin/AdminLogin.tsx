import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const MFA_REQUIRED_ROLES = ['super_admin', 'admin', 'provider']
type Step = 'credentials' | 'mfa_challenge' | 'mfa_setup'

export default function AdminLogin() {
  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [setupCode, setSetupCode] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionToken, setSessionToken] = useState('')

  // ── Helper: call setup endpoint to generate fresh QR + secret ─────────────
  const initSetup = async (token: string) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/totp-setup?action=setup`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Setup failed')
    setQrUrl(data.qr_url)
    setMfaSecret(data.secret)
  }

  // ── Helper: reset MFA on the server (wipe secret + flags) ─────────────────
  const resetMfaOnServer = async (token: string) => {
    await fetch(`${SUPABASE_URL}/functions/v1/totp-setup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disable' }),
    }).catch(() => {})
  }

  // ── Step 1: credentials ────────────────────────────────────────────────────
  const handleCredentials = async () => {
    setError('')
    if (!email || !password) { setError('Email and password required'); return }
    setLoading(true)
    try {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) throw new Error(authErr.message)
      const token = authData.session?.access_token
      if (!token) throw new Error('No session token')
      setSessionToken(token)

      const { data: member, error: memberErr } = await supabase
        .from('org_members')
        .select('role, mfa_enabled, mfa_secret, mfa_verified_at, is_active, org_id')
        .eq('user_id', authData.user.id).single()

      if (memberErr || !member) throw new Error('Account not found. Contact your administrator.')
      if (!member.is_active) throw new Error('Account not yet active.')

      if (MFA_REQUIRED_ROLES.includes(member.role)) {
        if (member.mfa_enabled && member.mfa_secret && member.mfa_verified_at) {
          setStep('mfa_challenge')
        } else {
          // If a partial/stale setup exists, wipe it first to be safe
          if (member.mfa_secret && !member.mfa_verified_at) {
            await resetMfaOnServer(token)
          }
          await initSetup(token)
          setStep('mfa_setup')
        }
      } else {
        window.location.href = '/admin'
      }
    } catch (e: any) {
      setError(e.message)
      await supabase.auth.signOut()
    } finally { setLoading(false) }
  }

  // ── Step 2a: existing MFA — verify on every login ──────────────────────────
  const handleMfaChallenge = async () => {
    setError('')
    if (totpCode.length !== 6) { setError('Enter the 6-digit code'); return }
    setLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/totp-setup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'challenge', token: totpCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invalid code')
      window.location.href = '/admin'
    } catch (e: any) { setError(e.message); setTotpCode('') }
    finally { setLoading(false) }
  }

  // ── Step 2b: first-time setup — verify and activate ────────────────────────
  const handleMfaVerify = async () => {
    setError('')
    if (setupCode.length !== 6) { setError('Enter the 6-digit code'); return }
    setLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/totp-setup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token: setupCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invalid code')
      window.location.href = '/admin'
    } catch (e: any) { setError(e.message); setSetupCode('') }
    finally { setLoading(false) }
  }

  // ── Reset & retry: wipe secret on server, generate fresh QR ────────────────
  const resetAndRetry = async () => {
    setError(''); setSetupCode(''); setLoading(true)
    try {
      await resetMfaOnServer(sessionToken)
      await initSetup(sessionToken)
    } catch (e: any) {
      setError('Could not reset MFA. Try signing in again.')
    } finally { setLoading(false) }
  }

  const onTotpInput = (val: string, setter: (v: string) => void) =>
    setter(val.replace(/\D/g, '').slice(0, 6))

  const S = {
    page: { minHeight:'100vh', background:'#060e1c', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif', padding:20 } as React.CSSProperties,
    card: { width:'100%', maxWidth:440, background:'#0a1628', border:'1px solid rgba(201,169,110,0.2)', borderRadius:16, overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' } as React.CSSProperties,
    hdr: { background:'#060e1c', padding:'28px 32px', textAlign:'center' as const, borderBottom:'1px solid rgba(201,169,110,0.12)' },
    body: { padding:'28px 32px' } as React.CSSProperties,
    lbl: { display:'block', fontSize:10, color:'rgba(201,169,110,0.7)', letterSpacing:'1.2px', textTransform:'uppercase' as const, marginBottom:6 },
    inp: { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'11px 14px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' as const, marginBottom:16 },
    totpInp: { width:'100%', background:'rgba(255,255,255,0.05)', border:'2px solid rgba(201,169,110,0.4)', borderRadius:10, padding:'20px 14px', color:'#c9a96e', fontSize:32, fontWeight:700, fontFamily:'monospace', letterSpacing:'0.4em', textAlign:'center' as const, outline:'none', boxSizing:'border-box' as const, marginBottom:16 } as React.CSSProperties,
    btn: (on=true) => ({ width:'100%', padding:'13px', background: on?'#c9a96e':'rgba(201,169,110,0.2)', border:'none', borderRadius:8, color: on?'#060e1c':'rgba(255,255,255,0.3)', fontSize:14, fontWeight:700, cursor: on?'pointer':'not-allowed', marginTop:8 } as React.CSSProperties),
    err: { background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 14px', color:'#f87171', fontSize:13, marginBottom:16 } as React.CSSProperties,
    link: { background:'none', border:'none', color:'rgba(201,169,110,0.6)', fontSize:12, cursor:'pointer', textDecoration:'underline', padding:0 } as React.CSSProperties,
    back: { width:'100%', padding:'10px', marginTop:6, background:'transparent', border:'none', color:'rgba(255,255,255,0.3)', fontSize:12, cursor:'pointer' } as React.CSSProperties,
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.hdr}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <polygon points="16,2 30,16 16,30 2,16" fill="none" stroke="#c9a96e" strokeWidth="1.5"/>
              <polygon points="16,7 25,16 16,25 7,16" fill="#c9a96e" opacity="0.3"/>
              <polygon points="16,11 21,16 16,21 11,16" fill="#c9a96e"/>
            </svg>
            <span style={{ color:'#c9a96e', fontSize:20, fontWeight:600 }}>PatientTracForge</span>
          </div>
          <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, letterSpacing:'1.5px', textTransform:'uppercase' }}>
            {step==='credentials'?'Admin Portal':step==='mfa_challenge'?'Two-Factor Authentication':'Set Up Google Authenticator'}
          </div>
        </div>

        <div style={S.body}>
          {step==='credentials' && (<>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:24, lineHeight:1.6 }}>
              Patient data · Scheduling · Billing — HIPAA compliant
            </p>
            <label style={S.lbl}>Email Address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleCredentials()} placeholder="you@yourpractice.com" style={S.inp}/>
            <label style={S.lbl}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleCredentials()} placeholder="••••••••••••" style={S.inp}/>
            {error && <div style={S.err}>{error}</div>}
            <button onClick={handleCredentials} disabled={loading} style={S.btn()}>
              {loading?'Signing in…':'Sign in securely →'}
            </button>
            <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.2)' }}>256-bit TLS · HIPAA compliant · Google Authenticator MFA</span>
            </div>
          </>)}

          {step==='mfa_challenge' && (<>
            <div style={{ background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:10, padding:'14px 16px', marginBottom:24 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#00d4ff', marginBottom:4 }}>Google Authenticator</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.6 }}>Enter the current 6-digit code from your authenticator app.</div>
            </div>
            <label style={S.lbl}>Authenticator Code</label>
            <input
              autoFocus type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
              value={totpCode}
              onChange={e=>onTotpInput(e.target.value, setTotpCode)}
              onKeyDown={e=>e.key==='Enter'&&totpCode.length===6&&handleMfaChallenge()}
              placeholder="000000" style={S.totpInp}
            />
            {error && <div style={S.err}>{error}</div>}
            <button onClick={handleMfaChallenge} disabled={loading||totpCode.length!==6} style={S.btn(totpCode.length===6)}>
              {loading?'Verifying…':'Verify & Sign In →'}
            </button>
            <button onClick={()=>{setStep('credentials');setTotpCode('');setError('');supabase.auth.signOut()}} style={S.back}>← Back</button>
          </>)}

          {step==='mfa_setup' && (<>
            <div style={{ background:'rgba(201,169,110,0.08)', border:'1px solid rgba(201,169,110,0.2)', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#c9a96e', marginBottom:4 }}>Set up Google Authenticator</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.6 }}>Required for your role. One-time setup.</div>
            </div>
            <div style={{ textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:8 }}>1. Install Google Authenticator · 2. Tap + → Scan QR</div>
              {qrUrl && <div style={{ display:'inline-block', background:'#fff', padding:12, borderRadius:8 }}>
                <img src={qrUrl} alt="QR Code" width={180} height={180}/>
              </div>}
            </div>
            {mfaSecret && <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'10px 14px', marginBottom:16, textAlign:'center' }}>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:4 }}>Manual entry key</div>
              <code style={{ fontSize:12, color:'#c9a96e', letterSpacing:'1.5px', wordBreak:'break-all' }}>{mfaSecret}</code>
            </div>}
            <label style={S.lbl}>3. Enter the 6-digit code to confirm</label>
            <input
              autoFocus type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
              value={setupCode}
              onChange={e=>onTotpInput(e.target.value, setSetupCode)}
              onKeyDown={e=>e.key==='Enter'&&setupCode.length===6&&handleMfaVerify()}
              placeholder="000000" style={S.totpInp}
            />
            {error && <>
              <div style={S.err}>{error}</div>
              <div style={{ textAlign:'center', marginBottom:12 }}>
                <button onClick={resetAndRetry} disabled={loading} style={S.link}>
                  ↻ Reset and start over with a new QR code
                </button>
              </div>
            </>}
            <button onClick={handleMfaVerify} disabled={loading||setupCode.length!==6} style={S.btn(setupCode.length===6)}>
              {loading?'Activating…':'Activate MFA & Sign In →'}
            </button>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
              <button onClick={resetAndRetry} disabled={loading} style={{ ...S.link, fontSize:11 }}>
                ↻ New QR code
              </button>
              <button onClick={()=>{setStep('credentials');setSetupCode('');setError('');setQrUrl('');setMfaSecret('');supabase.auth.signOut()}} style={{ ...S.link, fontSize:11 }}>
                ← Back to login
              </button>
            </div>
          </>)}
        </div>
      </div>
    </div>
  )
}
