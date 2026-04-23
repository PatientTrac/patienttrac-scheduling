import { type LucideIcon } from 'lucide-react'

interface ModuleStubProps {
  icon: LucideIcon
  title: string
  description: string
  sprint: string
}

export function ModuleStub({ icon: Icon, title, description, sprint }: ModuleStubProps) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <div className="section-heading mb-1">PatientTrac</div>
        <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">{title}</h1>
      </div>
      <div className="hud-panel hud-bracket p-16 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-sm border border-gold-500/20 bg-gold-500/5 flex items-center justify-center mb-5">
          <Icon size={24} className="text-gold-500/60" />
        </div>
        <div className="font-display font-semibold text-lg text-slate-300 mb-2">{title} Module</div>
        <div className="font-mono text-xs text-slate-600 mb-4 max-w-sm">{description}</div>
        <div className="badge badge-pending">{sprint}</div>
      </div>
    </div>
  )
}
