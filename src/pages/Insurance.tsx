import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Shield, Plus, Search, CheckCircle, AlertCircle, Clock, Edit, Loader } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn, formatDate } from '@/lib/utils'
import { useAuth } from '../lib/auth'

const RELATIONSHIP_OPTIONS = ['self','spouse','child','parent','other']
const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  primary:   { label: 'Primary',   color: 'bg-gold-500/15 text-gold-400 border-gold-500/30' },
  secondary: { label: 'Secondary', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  tertiary:  { label: 'Tertiary',  color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
}

export function Insurance() {
  const { orgId: ORG_ID } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all'|'verified'|'unverified'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editRecord, setEditRecord] = useState<any | null>(null)

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['insurance-all', ORG_ID],
    queryFn: async () => {
      const { data, error } = await supabase.schema('cr').from('patient_insurance')
        .select('*, patient:patient_id(first_name, last_name, birth, photo_url)')
        .eq('org_id', ORG_ID).eq('is_active', true)
        .order('patient_id').order('is_primary', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: companies = [] } = useQuery({
    queryKey: ['insurance-companies'],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('insurance_companies')
        .select('company_id, company_name, payer_id').eq('is_active', true).order('company_name')
      return data ?? []
    },
  })

  const verifyMutation = useMutation({
    mutationFn: async ({ id, patientId }: { id: number; patientId: number }) => {
      await supabase.schema('cr').from('patient_insurance')
        .update({ eligibility_verified: true, eligibility_date: new Date().toISOString() })
        .eq('insurance_id', id)
      await supabase.schema('cr').from('eligibility_checks').insert({
        insurance_id: id, patient_id: patientId, org_id: ORG_ID,
        method: 'manual', status: 'active', checked_at: new Date().toISOString(),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insurance-all'] }),
  })

  const saveMutation = useMutation({
    mutationFn: async (form: any) => {
      if (form.insurance_id) {
        const { error } = await supabase.schema('cr').from('patient_insurance')
          .update({ ...form, updated_at: new Date().toISOString() }).eq('insurance_id', form.insurance_id)
        if (error) throw error
      } else {
        const { error } = await supabase.schema('cr').from('patient_insurance')
          .insert({ ...form, org_id: ORG_ID, is_active: true, insert_date: new Date().toISOString() })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-all'] })
      setShowAddModal(false); setEditRecord(null)
    },
  })

  const filtered = records.filter((r: any) => {
    const p = r.patient as any
    const matchSearch = !search || `${p?.first_name} ${p?.last_name} ${r.insurance_company} ${r.policy_number}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' ? true : filterStatus === 'verified' ? r.eligibility_verified : !r.eligibility_verified
    return matchSearch && matchStatus
  })

  const byPatient = filtered.reduce<Record<string, any[]>>((acc, r) => {
    const key = String(r.patient_id); acc[key] = [...(acc[key] ?? []), r]; return acc
  }, {})

  const totalUnverified = records.filter((r: any) => !r.eligibility_verified).length

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <div className="section-heading mb-1">Financial</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Insurance</h1>
        </div>
        <button onClick={() => { setEditRecord(null); setShowAddModal(true) }} className="btn-primary">
          <Plus size={14} />Add Coverage
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Records',      value: records.length,          icon: Shield,       color: 'text-gold-400' },
          { label: 'Verified',           value: records.filter((r:any) => r.eligibility_verified).length, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Needs Verification', value: totalUnverified,         icon: AlertCircle,  color: 'text-amber-400' },
          { label: 'Patients Covered',   value: new Set(records.map((r:any) => r.patient_id)).size, icon: Shield, color: 'text-blue-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="hud-panel hud-bracket px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <div className="data-label">{label}</div>
              <Icon size={13} className={color} />
            </div>
            <div className="font-display font-bold text-2xl text-slate-100">{value}</div>
          </div>
        ))}
      </div>

      {totalUnverified > 0 && (
        <div className="hud-panel border-amber-500/20 px-4 py-2.5 flex items-center gap-3">
          <AlertCircle size={13} className="text-amber-400 flex-shrink-0" />
          <span className="text-xs text-slate-400">
            <span className="text-amber-300 font-medium">{totalUnverified} records</span> need eligibility verification
          </span>
          <button onClick={() => setFilterStatus('unverified')} className="ml-auto font-mono text-[10px] text-amber-400 hover:text-amber-300">SHOW UNVERIFIED →</button>
        </div>
      )}

      <div className="hud-panel px-4 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="hud-input pl-8 text-xs" placeholder="Search patient, insurer, policy #..." />
        </div>
        <div className="flex border border-gold-500/20 rounded-sm overflow-hidden">
          {(['all','verified','unverified'] as const).map(v => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={cn('px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors',
                filterStatus === v ? 'bg-gold-500/15 text-gold-300' : 'text-slate-500 hover:text-gold-400')}>
              {v}
            </button>
          ))}
        </div>
        <div className="ml-auto font-mono text-xs text-slate-600">{filtered.length} records</div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader size={14} className="animate-spin text-gold-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(byPatient).map(([patientId, patientRecords]) => {
            const patient = (patientRecords[0] as any).patient
            return (
              <div key={patientId} className="hud-panel overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gold-500/10 bg-gold-500/3">
                  <div className="w-7 h-7 rounded-sm bg-navy-700 border border-gold-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {patient?.photo_url
                      ? <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
                      : <span className="font-mono text-[9px] text-gold-400">{patient?.first_name?.charAt(0)}{patient?.last_name?.charAt(0)}</span>}
                  </div>
                  <span className="text-sm font-medium text-slate-200 hover:text-gold-300 cursor-pointer transition-colors flex-1"
                    onClick={() => navigate(`/patients/${patientId}`)}>
                    {patient?.last_name}, {patient?.first_name}
                    {patient?.birth && <span className="font-mono text-[10px] text-slate-600 ml-3">DOB: {formatDate(patient.birth)}</span>}
                  </span>
                  <button onClick={() => { setEditRecord({ patient_id: parseInt(patientId) }); setShowAddModal(true) }} className="btn-ghost text-xs py-1">
                    <Plus size={11} />Add Coverage
                  </button>
                </div>
                <div className="divide-y divide-gold-500/5">
                  {(patientRecords as any[]).map((ins) => {
                    const priority = ins.insurance_type ?? (ins.is_primary ? 'primary' : 'secondary')
                    const pl = PRIORITY_LABELS[priority] ?? PRIORITY_LABELS.primary
                    return (
                      <div key={ins.insurance_id} className="px-4 py-3 hover:bg-gold-500/3 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <span className={cn('badge text-[9px] mt-0.5 flex-shrink-0', pl.color)}>{pl.label}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-200">{ins.insurance_company}</div>
                              {ins.plan_name && <div className="text-xs text-slate-500">{ins.plan_name}</div>}
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                                {[
                                  { label: 'Policy', value: ins.policy_number },
                                  { label: 'Group',  value: ins.group_number },
                                  { label: 'Member', value: ins.subscriber_name },
                                ].filter(({ value }) => value).map(({ label, value }) => (
                                  <div key={label} className="flex gap-1.5">
                                    <span className="data-label">{label}:</span>
                                    <span className="font-mono text-[10px] text-slate-300">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-start gap-4 flex-shrink-0 text-right">
                            {ins.copay_amount != null && (
                              <div><div className="data-label">Copay</div><div className="font-mono text-xs text-gold-400">${ins.copay_amount}</div></div>
                            )}
                            {ins.deductible_amount != null && (
                              <div><div className="data-label">Deductible</div><div className="font-mono text-xs text-slate-300">${ins.deductible_amount}</div></div>
                            )}
                            <div className="min-w-20">
                              {ins.eligibility_verified ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <div className="flex items-center gap-1 text-emerald-400"><CheckCircle size={11} /><span className="font-mono text-[10px]">Verified</span></div>
                                  {ins.eligibility_date && <div className="font-mono text-[9px] text-slate-600">{formatDate(ins.eligibility_date)}</div>}
                                </div>
                              ) : (
                                <button onClick={() => verifyMutation.mutate({ id: ins.insurance_id, patientId: ins.patient_id })}
                                  disabled={verifyMutation.isPending}
                                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors font-mono text-[10px]">
                                  {verifyMutation.isPending ? <Loader size={10} className="animate-spin" /> : <AlertCircle size={10} />}
                                  Verify
                                </button>
                              )}
                              <button onClick={() => { setEditRecord(ins); setShowAddModal(true) }}
                                className="mt-1 flex items-center gap-1 text-slate-600 hover:text-gold-400 transition-colors font-mono text-[9px]">
                                <Edit size={9} />Edit
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-1.5">
                          {ins.effective_date && <div className="flex items-center gap-1"><Clock size={9} className="text-slate-600" /><span className="font-mono text-[9px] text-slate-600">Effective: {formatDate(ins.effective_date)}</span></div>}
                          {ins.termination_date && <div className="flex items-center gap-1"><AlertCircle size={9} className="text-amber-500/60" /><span className="font-mono text-[9px] text-amber-500/60">Terminates: {formatDate(ins.termination_date)}</span></div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {Object.keys(byPatient).length === 0 && (
            <div className="text-center py-16 text-slate-600 font-mono text-xs">
              {search ? 'No records match your search.' : 'No insurance records found.'}
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <InsuranceModal initial={editRecord} companies={companies}
          onSave={data => saveMutation.mutate(data)}
          onClose={() => { setShowAddModal(false); setEditRecord(null) }}
          saving={saveMutation.isPending} />
      )}
    </div>
  )
}

function InsuranceModal({ initial, companies, onSave, onClose, saving }: any) {
  const [form, setForm] = useState<any>({
    insurance_type: 'primary', is_primary: true, relationship_to_patient: 'self',
    is_active: true, eligibility_verified: false, is_us_insurance: true, ...initial,
  })
  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })) }

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-ins-modal'],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('patient')
        .select('patient_id, first_name, last_name').eq('org_id', ORG_ID).eq('status','active').order('last_name').limit(200)
      return data ?? []
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80">
      <div className="hud-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gold-500/10 flex items-center justify-between">
          <div className="section-heading">{initial?.insurance_id ? 'Edit Coverage' : 'Add Insurance Coverage'}</div>
          <button onClick={onClose} className="btn-ghost text-xs">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="data-label block mb-1.5">Patient *</label>
              <select value={form.patient_id ?? ''} onChange={e => set('patient_id', parseInt(e.target.value))} className="hud-input">
                <option value="">Select patient...</option>
                {patients.map((p: any) => <option key={p.patient_id} value={p.patient_id}>{p.last_name}, {p.first_name}</option>)}
              </select>
            </div>
            <div>
              <label className="data-label block mb-1.5">Coverage Priority *</label>
              <select value={form.insurance_type} onChange={e => { set('insurance_type', e.target.value); set('is_primary', e.target.value === 'primary') }} className="hud-input">
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="tertiary">Tertiary</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="data-label block mb-1.5">Insurance Company *</label>
              <select value={form.insurance_company ?? ''} onChange={e => set('insurance_company', e.target.value)} className="hud-input">
                <option value="">Select insurer...</option>
                {companies.map((c: any) => <option key={c.company_id} value={c.company_name}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="data-label block mb-1.5">Plan Name</label>
              <input value={form.plan_name ?? ''} onChange={e => set('plan_name', e.target.value)} className="hud-input" placeholder="e.g. PPO Gold" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="data-label block mb-1.5">Policy Number *</label>
              <input value={form.policy_number ?? ''} onChange={e => set('policy_number', e.target.value)} className="hud-input font-mono" placeholder="Policy #" />
            </div>
            <div>
              <label className="data-label block mb-1.5">Group Number</label>
              <input value={form.group_number ?? ''} onChange={e => set('group_number', e.target.value)} className="hud-input font-mono" placeholder="Group #" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="data-label block mb-1.5">Subscriber Name</label>
              <input value={form.subscriber_name ?? ''} onChange={e => set('subscriber_name', e.target.value)} className="hud-input" placeholder="Name on policy" />
            </div>
            <div>
              <label className="data-label block mb-1.5">Relationship</label>
              <select value={form.relationship_to_patient} onChange={e => set('relationship_to_patient', e.target.value)} className="hud-input">
                {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="data-label block mb-1.5">Copay</label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                <input type="number" value={form.copay_amount ?? ''} onChange={e => set('copay_amount', parseFloat(e.target.value))} className="hud-input pl-6 font-mono" placeholder="0.00" step={0.01} /></div>
            </div>
            <div>
              <label className="data-label block mb-1.5">Deductible</label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                <input type="number" value={form.deductible_amount ?? ''} onChange={e => set('deductible_amount', parseFloat(e.target.value))} className="hud-input pl-6 font-mono" placeholder="0.00" step={0.01} /></div>
            </div>
            <div>
              <label className="data-label block mb-1.5">OOP Max</label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                <input type="number" value={form.out_of_pocket_max ?? ''} onChange={e => set('out_of_pocket_max', parseFloat(e.target.value))} className="hud-input pl-6 font-mono" placeholder="0.00" step={0.01} /></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="data-label block mb-1.5">Effective Date</label>
              <input type="date" value={form.effective_date ?? ''} onChange={e => set('effective_date', e.target.value)} className="hud-input" />
            </div>
            <div>
              <label className="data-label block mb-1.5">Termination Date</label>
              <input type="date" value={form.termination_date ?? ''} onChange={e => set('termination_date', e.target.value || null)} className="hud-input" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            {[['eligibility_verified','Eligibility verified'],['prior_auth_required','Prior auth required'],['is_us_insurance','US insurance']].map(([key,label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!(form as any)[key]} onChange={e => set(key, e.target.checked)} className="accent-gold-500" />
                <span className="text-sm text-slate-300">{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gold-500/10 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.patient_id || !form.insurance_company} className="btn-primary text-xs">
            {saving ? 'Saving...' : initial?.insurance_id ? 'Save Changes' : 'Add Coverage'}
          </button>
        </div>
      </div>
    </div>
  )
}
