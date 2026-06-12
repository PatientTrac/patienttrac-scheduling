// ============================================================================
// App Launcher — Forge is the platform hub: launches the specialty apps
// (Surgery, OR, Revela, Mind) with a single-use cross-app session token so
// the destination app inherits org context without re-login ceremony.
// Data-driven from saas.app_routing (via public view), module-gated per org.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, ExternalLink, Loader } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

interface AppRoute {
  app_key: string
  app_label: string
  app_url: string | null
  icon: string | null
}

export function AppLauncher() {
  const { orgId } = useAuth()
  const [open, setOpen] = useState(false)
  const [apps, setApps] = useState<AppRoute[]>([])
  const [launching, setLaunching] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!orgId) return
    supabase
      .from('app_routing')
      .select('app_key, app_label, app_url, icon')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .not('app_url', 'is', null)
      .then(({ data }) => {
        // dedupe by app_key (routing table is per-specialty)
        const seen = new Map<string, AppRoute>()
        for (const r of (data as AppRoute[]) ?? []) if (!seen.has(r.app_key)) seen.set(r.app_key, r)
        setApps([...seen.values()])
      })
  }, [orgId])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  async function launch(app: AppRoute) {
    if (!app.app_url) return
    setLaunching(app.app_key)
    try {
      const { data: token, error } = await supabase.rpc('issue_cross_app_token', {
        p_app_key: app.app_key,
        p_org_id: orgId,
      })
      const url = token && !error
        ? `${app.app_url}/?token=${token}`
        : app.app_url // fall back to plain launch; destination asks for login
      window.open(url, '_blank', 'noopener')
    } finally {
      setLaunching(null)
      setOpen(false)
    }
  }

  if (apps.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Launch PatientTrac apps"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-gold-500/15 bg-navy-800/60 text-slate-300 hover:text-gold-300 hover:border-gold-500/30 text-xs font-mono"
      >
        <LayoutGrid size={14} />
        Apps
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-sm border border-gold-500/20 bg-navy-900 shadow-xl">
          <div className="px-3 py-2 border-b border-gold-500/10 text-[10px] uppercase tracking-wider text-slate-500 font-mono">
            PatientTrac Platform
          </div>
          {apps.map(app => (
            <button
              key={app.app_key}
              onClick={() => launch(app)}
              disabled={launching !== null}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-navy-800 hover:text-gold-300"
            >
              <span>{app.app_label}</span>
              {launching === app.app_key
                ? <Loader size={12} className="animate-spin" />
                : <ExternalLink size={12} className="opacity-50" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
