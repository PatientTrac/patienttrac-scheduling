import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Search, CheckCircle, Clock, DollarSign, Tag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { cn, formatCurrency } from '@/lib/utils'

interface ApptType {
  appt_type_id:        string
  name:                string
  code:                string
  description:         string | null
  specialty:           string | null
  duration_mins:       number
  color:               string
  primary_cpt_code:    string | null
  primary_cpt_desc:    string | null
  additional_cpt_codes: string[] | null
  default_icd_codes:   string[] | null
  default_fee:         number | null
  default_pos_code:    string | null
  requires_auth:       boolean
  is_telehealth:       boolean
  is_active:           boolean
}

const SPECIALTIES = ['All','Plastic Surgery','Psychiatry','Psychology','Family Medicine','Internal Medicine','Cardiology','Orthopedics','Other']
const POS_CODES = [
  { code: '11', label: '11 — Office' },
  { code: '02', label: '02 — Telehealth' },
  { code: '21', label: '21 — Inpatient Hospital' },
  { code: '22', label: '22 — Outpatient Hospital' },
  { code: '24', label: '24 — Ambulatory Surgical Center' },
]

export function AppointmentTypes() {
  const { orgId, can } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterSpecialty, setFilterSpecialty] = useState('All')
  const [editing, setEditing] = useState<ApptType | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data: apptTypes = [], isLoading } = useQuery({
    queryKey: ['appt-types', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_types')
        .select('*')
        .eq('org_id', orgId!)
        .order('specialty').order('name')
      if (error) throw error
      return data as ApptType[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (form: Partial<ApptType>) => {
      if (form.appt_type_id) {
        const { error } = await supabase.from('appointment_types')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('appt_type_id', form.appt_type_id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('appointment_types')
          .insert({ ...form, org_id: orgId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appt-types'] })
      setShowForm(false)
      setEditing(null)
    },
  })

  const filtered = apptTypes.filter(t => {
    const matchSearch = !search || `${t.name} ${t.code} ${t.primary_cpt_code ?? ''}`.toLowerCase().includes(search.toLowerCase())
    const matchSpec = filterSpecialty === 'All' || t.specialty === filterSpecialty
    return matchSearch && matchSpec
  })

  const grouped = filtered.reduce<Record<string, ApptType[]>>((acc, t) => {
    const key = t.specialty ?? 'General'
    acc[key] = [...(acc[key] ?? []), t]
    return acc
  }, {})

  const canEdit = can('appointments', 'edit')

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <div className="section-heading mb-1">Admin · Appointment Configuration</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">
            Appointment Types + CPT Codes
          </h1>
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn-primary">
            <Plus size={14} />
            New Type
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="hud-panel px-4 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="hud-input pl-8 text-xs" placeholder="Search by name, code, or CPT..." />
        </div>
        <select value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)} className="hud-input text-xs w-44">
          {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="ml-auto font-mono text-xs text-slate-600">{filtered.length} types</div>
      </div>

      {/* CPT info banner */}
      <div className="hud-panel border-gold-500/15 px-4 py-2.5 flex items-center gap-3">
        <Tag size={12} className="text-gold-500/60" />
        <span className="font-mono text-[10px] text-slate-500">
          CPT codes auto-populate the superbill when an encounter is closed · Default ICD-10 codes pre-fill diagnosis fields in clinical modules
        </span>
      </div>

      {/* Type list grouped by specialty */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-4 h-4 border border-gold-500/40 border-t-gold-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([specialty, types]) => (
            <div key={specialty} className="hud-panel overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gold-500/10 flex items-center gap-2 bg-gold-500/3">
                <div className="section-heading">{specialty}</div>
                <span className="font-mono text-[10px] text-slate-600">{types.length} types</span>
              </div>
              <table className="hud-table">
                <thead>
                  <tr>
                    <th>Name / Code</th>
                    <th>Primary CPT</th>
                    <th>Add'l CPT</th>
                    <th>Default ICD</th>
                    <th>Duration</th>
                    <th>Fee</th>
                    <th>POS</th>
                    <th>Status</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {types.map(t => (
                    <tr key={t.appt_type_id} onClick={() => canEdit && (setEditing(t), setShowForm(true))}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                          <div>
                            <div className="text-sm text-slate-200">{t.name}</div>
                            <div className="font-mono text-[10px] text-slate-600">{t.code}</div>
                          </div>
                          {t.is_telehealth && <span className="badge badge-pending text-[9px]">Tele</span>}
                        </div>
                      </td>
                      <td>
                        {t.primary_cpt_code ? (
                          <div>
                            <div className="font-mono text-xs text-gold-400">{t.primary_cpt_code}</div>
                            <div className="text-[10px] text-slate-600 max-w-32 truncate">{t.primary_cpt_desc}</div>
                          </div>
                        ) : <span className="text-slate-700">—</span>}
                      </td>
                      <td>
                        {t.additional_cpt_codes?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {t.additional_cpt_codes.map(c => (
                              <span key={c} className="font-mono text-[10px] text-slate-400 bg-navy-700 px-1.5 py-0.5 rounded-sm">{c}</span>
                            ))}
                          </div>
                        ) : <span className="text-slate-700">—</span>}
                      </td>
                      <td>
                        {t.default_icd_codes?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {t.default_icd_codes.slice(0,2).map(c => (
                              <span key={c} className="font-mono text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-sm">{c}</span>
                            ))}
                          </div>
                        ) : <span className="text-slate-700">—</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 font-mono text-xs text-slate-400">
                          <Clock size={10} />
                          {t.duration_mins}m
                        </div>
                      </td>
                      <td>
                        {t.default_fee ? (
                          <div className="flex items-center gap-1 font-mono text-xs text-emerald-400">
                            <DollarSign size={10} />
                            {t.default_fee.toFixed(0)}
                          </div>
                        ) : <span className="text-slate-700">—</span>}
                      </td>
                      <td><span className="font-mono text-[10px] text-slate-500">{t.default_pos_code}</span></td>
                      <td>
                        <span className={cn('badge', t.is_active ? 'badge-active' : 'badge-inactive')}>
                          {t.is_active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      {canEdit && (
                        <td>
                          <button className="font-mono text-[10px] text-slate-600 hover:text-gold-400 transition-colors">
                            EDIT →
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create modal */}
      {showForm && (
        <ApptTypeForm
          initial={editing}
          onSave={data => saveMutation.mutate(data)}
          onClose={() => { setShowForm(false); setEditing(null) }}
          saving={saveMutation.isPending}
        />
      )}
    </div>
  )
}

function ApptTypeForm({
  initial, onSave, onClose, saving,
}: {
  initial: ApptType | null
  onSave: (data: Partial<ApptType>) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<Partial<ApptType>>(initial ?? {
    is_active: true, is_telehealth: false, requires_auth: false,
    duration_mins: 30, default_pos_code: '11', color: '#c9a96e',
  })

  function set(k: keyof ApptType, v: any) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80">
      <div className="hud-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gold-500/10 flex items-center justify-between">
          <div className="section-heading">{initial ? 'Edit Appointment Type' : 'New Appointment Type'}</div>
          <button onClick={onClose} className="btn-ghost text-xs">✕ Close</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="data-label block mb-1.5">Name *</label>
              <input value={form.name ?? ''} onChange={e => set('name', e.target.value)} className="hud-input" placeholder="e.g. New Patient Level 3" />
            </div>
            <div>
              <label className="data-label block mb-1.5">Code *</label>
              <input value={form.code ?? ''} onChange={e => set('code', e.target.value.toUpperCase())} className="hud-input font-mono" placeholder="NP-3" maxLength={20} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="data-label block mb-1.5">Specialty</label>
              <select value={form.specialty ?? 'All'} onChange={e => set('specialty', e.target.value)} className="hud-input">
                {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="data-label block mb-1.5">Duration (mins)</label>
              <input type="number" value={form.duration_mins ?? 30} onChange={e => set('duration_mins', parseInt(e.target.value))} className="hud-input" min={5} step={5} />
            </div>
            <div>
              <label className="data-label block mb-1.5">Calendar Color</label>
              <input type="color" value={form.color ?? '#c9a96e'} onChange={e => set('color', e.target.value)} className="hud-input h-9 cursor-pointer" />
            </div>
          </div>

          <div className="hud-accent-line" />
          <div className="section-heading">CPT Billing Configuration</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="data-label block mb-1.5">Primary CPT Code</label>
              <input value={form.primary_cpt_code ?? ''} onChange={e => set('primary_cpt_code', e.target.value)} className="hud-input font-mono" placeholder="e.g. 99213" maxLength={10} />
            </div>
            <div>
              <label className="data-label block mb-1.5">CPT Description</label>
              <input value={form.primary_cpt_desc ?? ''} onChange={e => set('primary_cpt_desc', e.target.value)} className="hud-input" placeholder="Short description" />
            </div>
            <div>
              <label className="data-label block mb-1.5">Additional CPT Codes</label>
              <input
                value={(form.additional_cpt_codes ?? []).join(', ')}
                onChange={e => set('additional_cpt_codes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                className="hud-input font-mono"
                placeholder="90833, GQ (comma-separated)"
              />
            </div>
            <div>
              <label className="data-label block mb-1.5">Default ICD-10 Codes</label>
              <input
                value={(form.default_icd_codes ?? []).join(', ')}
                onChange={e => set('default_icd_codes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                className="hud-input font-mono"
                placeholder="F32.9, F41.1 (comma-separated)"
              />
            </div>
            <div>
              <label className="data-label block mb-1.5">Default Fee</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                <input type="number" value={form.default_fee ?? ''} onChange={e => set('default_fee', parseFloat(e.target.value))} className="hud-input pl-6 font-mono" placeholder="0.00" step={0.01} />
              </div>
            </div>
            <div>
              <label className="data-label block mb-1.5">Place of Service</label>
              <select value={form.default_pos_code ?? '11'} onChange={e => set('default_pos_code', e.target.value)} className="hud-input">
                {POS_CODES.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {[
              ['is_active',     'Active'],
              ['is_telehealth', 'Telehealth'],
              ['requires_auth', 'Requires Prior Auth'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!(form as any)[key]} onChange={e => set(key as keyof ApptType, e.target.checked)} className="accent-gold-500" />
                <span className="text-sm text-slate-300">{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gold-500/10 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving} className="btn-primary text-xs">
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Type'}
          </button>
        </div>
      </div>
    </div>
  )
}
