import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, CheckCircle, Building2, MapPin, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { SmartAddressBlock, TaxIdField } from '@/components/forms/SmartAddressBlock'
import { useAuth } from '../lib/auth'


const FACILITY_TYPES = [
  'Medical Office','Clinic','Hospital','Outpatient Surgery Center',
  'Behavioral Health Center','Rehabilitation Center','Telehealth',
  'Urgent Care','Laboratory','Imaging Center','Other',
]

const schema = z.object({
  facility_name:       z.string().min(1, 'Required'),
  facility_type:       z.string().optional(),
  specialty:           z.string().optional(),
  npi:                 z.string().optional(),
  tax_id:              z.string().optional(),
  tax_id_type:         z.string().default('EIN'),
  email:               z.string().email().optional().or(z.literal('')),
  website:             z.string().optional(),
  is_us_facility:      z.boolean().default(true),
  country_code:        z.string().default('US'),
  address1:            z.string().optional(),
  address2:            z.string().optional(),
  city:                z.string().optional(),
  state:               z.string().optional(),
  province:            z.string().optional(),
  zipcode:             z.string().optional(),
  postal_code:         z.string().optional(),
  phone:               z.string().optional(),
  phone_country_code:  z.string().default('+1'),
  fax:                 z.string().optional(),
  is_active:           z.boolean().default(true),
})

type FacilityForm = z.infer<typeof schema>

const SECTIONS = [
  { id: 'info',    label: 'Facility Info', icon: Building2 },
  { id: 'address', label: 'Address',       icon: MapPin },
  { id: 'tax',     label: 'Tax / NPI',     icon: FileText },
]

export function NewFacility() {
  const { orgId: ORG_ID } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeSection, setActiveSection] = useState('info')
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FacilityForm>({
    resolver: zodResolver(schema),
    defaultValues: { is_active: true, is_us_facility: true, country_code: 'US', tax_id_type: 'EIN', phone_country_code: '+1' },
  })

  const w = watch()

  const mutation = useMutation({
    mutationFn: async (data: FacilityForm) => {
      const { data: result, error } = await supabase
        .schema('cr').from('facilities')
        .insert({ ...data, org_id: ORG_ID, insert_date: new Date().toISOString() })
        .select().single()
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
      navigate('/settings')
    },
  })

  function next(current: string) {
    setCompleted(prev => new Set([...prev, current]))
    const idx = SECTIONS.findIndex(s => s.id === current)
    if (idx < SECTIONS.length - 1) setActiveSection(SECTIONS[idx + 1].id)
  }

  function addrUpdate(updates: Record<string, string>) {
    Object.entries(updates).forEach(([k, v]) => setValue(k as any, v as any))
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-ghost p-1.5"><ArrowLeft size={16} /></button>
        <div>
          <div className="section-heading mb-0.5">Facility Management</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Add Facility</h1>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1">
          <div className="hud-panel p-3">
            <div className="section-heading mb-2">Sections</div>
            <ul className="space-y-0.5">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button type="button" onClick={() => setActiveSection(id)}
                    className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-sm text-xs transition-all duration-150 text-left border-l-2',
                      activeSection === id ? 'text-gold-300 bg-gold-500/10 border-gold-500 pl-[9px]' : 'text-slate-400 hover:text-gold-300 hover:bg-gold-500/5 border-transparent')}>
                    {completed.has(id) ? <CheckCircle size={11} className="text-emerald-400" /> : <Icon size={11} className={activeSection === id ? 'text-gold-400' : 'text-slate-600'} />}
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-span-3">
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">

            {activeSection === 'info' && (
              <div className="hud-panel p-5 space-y-4">
                <div className="section-heading">Facility Information</div>
                <div>
                  <label className="data-label block mb-1.5">Facility Name *</label>
                  <input {...register('facility_name')} className="hud-input" placeholder="Practice or facility name" />
                  {errors.facility_name && <p className="mt-1 text-xs text-red-400">{errors.facility_name.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="data-label block mb-1.5">Facility Type</label>
                    <select {...register('facility_type')} className="hud-input">
                      <option value="">Select type...</option>
                      {FACILITY_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Specialty</label>
                    <input {...register('specialty')} className="hud-input" placeholder="Primary specialty" />
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Email</label>
                    <input {...register('email')} type="email" className="hud-input" placeholder="admin@facility.com" />
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Website</label>
                    <input {...register('website')} className="hud-input" placeholder="https://..." />
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                      <input type="checkbox" {...register('is_active')} className="accent-gold-500" defaultChecked />
                      <span className="text-sm text-slate-300">Facility is active</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => next('info')} className="btn-primary text-xs py-1.5">Next: Address →</button>
                </div>
              </div>
            )}

            {activeSection === 'address' && (
              <div className="hud-panel p-5 space-y-4">
                <SmartAddressBlock
                  label="Facility Address"
                  value={{ country_code: w.country_code, address1: w.address1, address2: w.address2, city: w.city, state: w.state, province: w.province, zipcode: w.zipcode, postal_code: w.postal_code, county: undefined, phone_country_code: w.phone_country_code, phone: w.phone, cell_phone: undefined, mobile_country_code: '+1' }}
                  onChange={addrUpdate}
                  showPhone
                  showMobile={false}
                />
                <div>
                  <label className="data-label block mb-1.5">Fax</label>
                  <div className="flex gap-1.5">
                    <input type="text" value={w.phone_country_code ?? '+1'} onChange={e => setValue('phone_country_code', e.target.value)} className="hud-input w-16 font-mono text-center text-xs" />
                    <input {...register('fax')} className="hud-input flex-1 font-mono" placeholder="Fax number" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => next('address')} className="btn-primary text-xs py-1.5">Next: Tax / NPI →</button>
                </div>
              </div>
            )}

            {activeSection === 'tax' && (
              <div className="hud-panel p-5 space-y-4">
                <div className="section-heading">Tax & Licensing</div>
                <div className="hud-panel border-gold-500/20 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-200 font-medium">US Facility</div>
                    <div className="text-xs text-slate-500 mt-0.5">Determines EIN vs foreign tax ID requirements</div>
                  </div>
                  <button type="button"
                    onClick={() => { const n = !w.is_us_facility; setValue('is_us_facility', n); setValue('country_code', n ? 'US' : 'CO'); setValue('tax_id_type', n ? 'EIN' : 'FOREIGN') }}
                    className={cn('relative w-12 h-6 rounded-full transition-colors duration-200', w.is_us_facility ? 'bg-gold-500' : 'bg-slate-600')}>
                    <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200', w.is_us_facility ? 'translate-x-6' : 'translate-x-0.5')} />
                  </button>
                </div>
                <div>
                  <label className="data-label block mb-1.5">NPI Number</label>
                  <input {...register('npi')} className="hud-input font-mono" placeholder="10-digit facility NPI" maxLength={10} />
                </div>
                <TaxIdField
                  countryCode={w.country_code ?? 'US'}
                  isUSResident={w.is_us_facility ?? true}
                  taxIdType={w.tax_id_type ?? 'EIN'}
                  value={w.tax_id ?? ''}
                  onChange={v => setValue('tax_id', v)}
                  onTypeChange={v => setValue('tax_id_type', v)}
                />
              </div>
            )}

            {mutation.error && (
              <div className="hud-panel border-red-500/30 px-4 py-2.5">
                <p className="text-xs text-red-400 font-mono">{String(mutation.error)}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button type="button" onClick={() => navigate(-1)} className="btn-ghost text-xs">← Cancel</button>
              <button type="submit" disabled={mutation.isPending} className="btn-primary">
                {mutation.isPending ? <div className="w-3.5 h-3.5 border border-navy-900/40 border-t-navy-900 rounded-full animate-spin" /> : <Save size={14} />}
                {mutation.isPending ? 'Saving...' : 'Add Facility'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
