import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, CheckCircle, User, MapPin, FileText, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { SmartAddressBlock, TaxIdField } from '@/components/forms/SmartAddressBlock'
import { PhotoUpload } from '@/components/forms/PhotoUpload'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

const SPECIALTIES = [
  'Plastic Surgery','Cosmetic Surgery','Dermatology','Psychiatry','Psychology',
  'Addiction Medicine','Family Medicine','Internal Medicine','Cardiology',
  'Orthopedics','Neurology','Obstetrics & Gynecology','Pediatrics','Oncology',
  'Radiology','Anesthesiology','Emergency Medicine','General Surgery','Other',
]

const CREDENTIALS = ['MD','DO','PhD','PsyD','LCSW','LMFT','NP','PA','RN','DDS','DMD','Other']

const schema = z.object({
  first_name:          z.string().min(1, 'Required'),
  last_name:           z.string().min(1, 'Required'),
  title:               z.string().optional(),
  suffix:              z.string().optional(),
  credential:          z.string().optional(),
  specialty:           z.string().optional(),
  npi:                 z.string().optional(),
  dea_number:          z.string().optional(),
  license_number:      z.string().optional(),
  license_expiry:      z.string().optional(),
  email:               z.string().email().optional().or(z.literal('')),
  is_us_provider:      z.boolean().default(true),
  country_code:        z.string().default('US'),
  tax_id:              z.string().optional(),
  tax_id_type:         z.string().default('SSN'),
  address1:            z.string().optional(),
  address2:            z.string().optional(),
  city:                z.string().optional(),
  state:               z.string().optional(),
  province:            z.string().optional(),
  zipcode:             z.string().optional(),
  postal_code:         z.string().optional(),
  phone:               z.string().optional(),
  phone_country_code:  z.string().default('+1'),
  cell_phone:          z.string().optional(),
  mobile_country_code: z.string().default('+1'),
  photo_url:           z.string().optional(),
  is_active:           z.boolean().default(true),
})

type ProviderForm = z.infer<typeof schema>

const SECTIONS = [
  { id: 'info',       label: 'Provider Info',  icon: User },
  { id: 'license',    label: 'Credentials',    icon: Shield },
  { id: 'address',    label: 'Address',        icon: MapPin },
  { id: 'tax',        label: 'Tax / ID',       icon: FileText },
]

export function NewProvider() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeSection, setActiveSection] = useState('info')
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ProviderForm>({
    resolver: zodResolver(schema),
    defaultValues: { is_active: true, is_us_provider: true, country_code: 'US', tax_id_type: 'SSN', phone_country_code: '+1', mobile_country_code: '+1' },
  })

  const w = watch()

  const mutation = useMutation({
    mutationFn: async (data: ProviderForm) => {
      const { data: result, error } = await supabase
        .schema('cr').from('providers')
        .insert({ ...data, org_id: ORG_ID, insert_date: new Date().toISOString() })
        .select().single()
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
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
    <div className="space-y-5 animate-fade-in max-w-5xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-ghost p-1.5"><ArrowLeft size={16} /></button>
        <div>
          <div className="section-heading mb-0.5">Provider Management</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Add Provider</h1>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-1 space-y-3">
          <div className="hud-panel p-4 flex flex-col items-center gap-2">
            <div className="section-heading mb-1">Photo</div>
            <PhotoUpload
              currentUrl={w.photo_url}
              patientName={`${w.first_name ?? ''} ${w.last_name ?? ''}`}
              onUpload={(url) => setValue('photo_url', url)}
              onRemove={() => setValue('photo_url', '')}
              size="lg"
              folder="providers"
            />
          </div>
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

        <div className="col-span-4">
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">

            {activeSection === 'info' && (
              <div className="hud-panel p-5 space-y-4">
                <div className="section-heading">Provider Information</div>
                <div className="grid grid-cols-6 gap-3">
                  <div>
                    <label className="data-label block mb-1.5">Title</label>
                    <select {...register('title')} className="hud-input text-xs">
                      <option value="">—</option>
                      {['Dr.','Mr.','Mrs.','Ms.'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="data-label block mb-1.5">First Name *</label>
                    <input {...register('first_name')} className="hud-input" placeholder="First name" />
                    {errors.first_name && <p className="mt-1 text-xs text-red-400">{errors.first_name.message}</p>}
                  </div>
                  <div className="col-span-2">
                    <label className="data-label block mb-1.5">Last Name *</label>
                    <input {...register('last_name')} className="hud-input" placeholder="Last name" />
                    {errors.last_name && <p className="mt-1 text-xs text-red-400">{errors.last_name.message}</p>}
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Credential</label>
                    <select {...register('credential')} className="hud-input text-xs">
                      <option value="">—</option>
                      {CREDENTIALS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="data-label block mb-1.5">Specialty</label>
                    <select {...register('specialty')} className="hud-input">
                      <option value="">Select specialty...</option>
                      {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Email</label>
                    <input {...register('email')} type="email" className="hud-input" placeholder="provider@practice.com" />
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Active</label>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input type="checkbox" {...register('is_active')} className="accent-gold-500" defaultChecked />
                      <span className="text-sm text-slate-300">Provider is active</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => next('info')} className="btn-primary text-xs py-1.5">Next: Credentials →</button>
                </div>
              </div>
            )}

            {activeSection === 'license' && (
              <div className="hud-panel p-5 space-y-4">
                <div className="section-heading">Credentials & Licensing</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="data-label block mb-1.5">NPI Number</label>
                    <input {...register('npi')} className="hud-input font-mono" placeholder="10-digit NPI" maxLength={10} />
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">DEA Number</label>
                    <input {...register('dea_number')} className="hud-input font-mono" placeholder="DEA number" />
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">State License Number</label>
                    <input {...register('license_number')} className="hud-input font-mono" placeholder="License #" />
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">License Expiry</label>
                    <input {...register('license_expiry')} type="date" className="hud-input" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => next('license')} className="btn-primary text-xs py-1.5">Next: Address →</button>
                </div>
              </div>
            )}

            {activeSection === 'address' && (
              <div className="hud-panel p-5">
                <SmartAddressBlock
                  label="Practice Address"
                  value={{ country_code: w.country_code, address1: w.address1, address2: w.address2, city: w.city, state: w.state, province: w.province, zipcode: w.zipcode, postal_code: w.postal_code, county: undefined, phone_country_code: w.phone_country_code, phone: w.phone, cell_phone: w.cell_phone, mobile_country_code: w.mobile_country_code }}
                  onChange={addrUpdate}
                  showPhone
                  showMobile
                />
                <div className="flex justify-end mt-4">
                  <button type="button" onClick={() => next('address')} className="btn-primary text-xs py-1.5">Next: Tax / ID →</button>
                </div>
              </div>
            )}

            {activeSection === 'tax' && (
              <div className="hud-panel p-5 space-y-4">
                <div className="section-heading">Tax & Identification</div>
                <div className="hud-panel border-gold-500/20 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-200 font-medium">US Provider</div>
                    <div className="text-xs text-slate-500 mt-0.5">Determines tax ID type and reporting requirements</div>
                  </div>
                  <button type="button"
                    onClick={() => { const n = !w.is_us_provider; setValue('is_us_provider', n); setValue('country_code', n ? 'US' : 'CO'); setValue('tax_id_type', n ? 'SSN' : 'FOREIGN') }}
                    className={cn('relative w-12 h-6 rounded-full transition-colors duration-200', w.is_us_provider ? 'bg-gold-500' : 'bg-slate-600')}>
                    <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200', w.is_us_provider ? 'translate-x-6' : 'translate-x-0.5')} />
                  </button>
                </div>
                <TaxIdField
                  countryCode={w.country_code ?? 'US'}
                  isUSResident={w.is_us_provider ?? true}
                  taxIdType={w.tax_id_type ?? 'SSN'}
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
                {mutation.isPending ? 'Saving...' : 'Add Provider'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
