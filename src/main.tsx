import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@patienttrac/clinical-viewer/styles.css'
import App from './App.tsx'
import { initAudit } from './lib/audit'
import { supabase } from './lib/supabase'
import { registerAppStore } from '../packages/ui/src/store'
import { useAppStore } from './lib/store'

// ── Shared package store registration ────────────────────────
// Must run before any @patienttrac/ui component is rendered
registerAppStore(useAppStore)

// ── §170.315(d)(2) Audit Initialization ──────────────────────
// Called once on app load — sets context for all audit calls
// Session is picked up from Supabase Auth on load
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) {
    // Get org + role from user metadata
    const meta = session.user.user_metadata || {}
    initAudit({
      org_id: meta.org_id || '00000000-0000-0000-0000-000000000001',
      user_id: session.user.id,
      user_email: session.user.email || '',
      user_role: meta.role || 'staff',
      session_id: session.access_token.slice(-16), // last 16 chars as session ref
      app_source: 'scheduling',
    })
  }
})

// Re-init on auth state change (login / logout)
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    const meta = session.user.user_metadata || {}
    initAudit({
      org_id: meta.org_id || '00000000-0000-0000-0000-000000000001',
      user_id: session.user.id,
      user_email: session.user.email || '',
      user_role: meta.role || 'staff',
      session_id: session.access_token.slice(-16),
      app_source: 'scheduling',
    })
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
// build 1777303650
