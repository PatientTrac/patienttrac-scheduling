/** Shared loading / empty / error states used by every section. */

export function Loading() {
  return (
    <div className="flex items-center gap-2 py-6 text-slate-500">
      <div className="w-4 h-4 border border-gold-500/40 border-t-gold-500 rounded-full animate-spin" />
      <span className="font-mono text-xs">Loading…</span>
    </div>
  )
}

export function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-10 border border-dashed border-gold-500/10 rounded-sm">
      <span className="font-mono text-xs text-slate-600">{label}</span>
    </div>
  )
}

export function Err({ error }: { error: unknown }) {
  return (
    <div className="font-mono text-xs text-red-400 py-4">
      Failed to load: {String(error)}
    </div>
  )
}
