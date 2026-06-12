import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, User, Phone, MapPin, Briefcase, AlertTriangle, Shield, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { SmartAddressBlock, TaxIdField } from '@/components/forms/SmartAddressBlock'
import { PhotoUpload } from '@/components/forms/PhotoUpload'
import { useAuth } from '../lib/auth'


const schema = z.object({
  title: z.string().optional(),
  first_name: z.string().min(1, 'Required'),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, 'Required'),
  birth: z.string().min(1, 'Required'),
  gender: z.string().optional(),
  marital_status: z.string().optional(),
  blood_type: z.string().optional(),
  preferred_language: z.string().optional(),
  interpreter_needed: z.boolean().optional(),
  race: z.string().optional(),
  patient_type: z.string().optional(),
  status: z.string().default('active'),
  is_us_resident: z.boolean().default(true),
  country_code: z.string().default('US'),
  tax_id: z.string().optional(),
  tax_id_type: z.string().default('SSN'),
  passport_number: z.string().optional(),
  passport_country: z.string().optional(),
  drv_license: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  province: z.string().optional(),
  zipcode: z.string().optional(),
  postal_code: z.string().optional(),
  county: z.string().optional(),
  phone: z.string().optional(),
  phone_country_code: z.string().default('+1'),
  cell_phone: z.string().optional(),
  mobile_country_code: z.string().default('+1'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  photo_url: z.string().optional(),
  photo_storage_path: z.string().optional(),
})

type PatientForm = z.infer<typeof schema>

const SECTIONS = [
  { id: 'demographics', label: 'Demographics',   icon: User },
  { id: 'residency',    label: 'Residency / ID',  icon: Shield },
  { id: 'address',      label: 'Address',         icon: MapPin },
  { id: 'contact',      label: 'Contact',         icon: Phone },
  { id: 'emergency',    label: 'Emergency',       icon: AlertTriangle },
  { id: 'employer',     label: 'Employer',        icon: Briefcase },
]

export function NewPatient() {
  const { orgId: ORG_ID } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeSection, setActiveSection] = useState('demographics')
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<PatientForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'active', is_us_resident: true, country_code: 'US',
      tax_id_type: 'SSN', phone_country_code: '+1', mobile_country_code: '+1',
      preferred_language: 'English', patient_type: 'new',
    },
  })

  const w = watch()

  const mutation = useMutation({
    mutationFn: async (data: PatientForm) => {
      const { data: result, error } = await supabase
        .schema('cr').from('patient')
        .insert({ ...data, org_id: ORG_ID, insert_date: new Date().toISOString() })
        .select().single()
      if (error) throw error
      return result
    },
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate(`/patients/${patient.patient_id}`)
    },
  })

  function next(current: string) {
    setCompleted(prev => new Set([...prev, current]))
    const idx = SECTIONS.findIndex(s => s.id === current)
    if (idx < SECTIONS.length - 1) setActiveSection(SECTIONS[idx + 1].id)
  }

  function addrUpdate(updates: Record<string, string>) {
    Object.entries(updates).forEach(([k, v]) => setValue(k as keyof PatientForm, v as any))
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/patients')} className="btn-ghost p-1.5"><ArrowLeft size={16} /></button>
        <div>
          <div className="section-heading mb-0.5">Patient Registry</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Register New Patient</h1>
        </div>
        {w.first_name && <div className="ml-auto font-display text-sm text-gold-400">{w.first_name} {w.last_name}</div>}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Left: photo + nav */}
        <div className="col-span-1 space-y-3">
          <div className="hud-panel p-4 flex flex-col items-center gap-2">
            <div className="section-heading mb-1">Photo</div>
            <PhotoUpload
              currentUrl={w.photo_url}
              patientName={`${w.first_name ?? ''} ${w.last_name ?? ''}`}
              onUpload={(url, path) => { setValue('photo_url', url); setValue('photo_storage_path', path) }}
              onRemove={() => { setValue('photo_url', ''); setValue('photo_storage_path', '') }}
              size="lg"
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
                    {completed.has(id) ? <CheckCircle size={11} className="text-emerald-400 flex-shrink-0" /> : <Icon size={11} className={activeSection === id ? 'text-gold-400' : 'text-slate-600'} />}
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: form */}
        <div className="col-span-4">
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">

            {activeSection === 'demographics' && (
              <div className="hud-panel p-5 space-y-4">
                <div className="section-heading">Patient Demographics</div>
                <div className="grid grid-cols-6 gap-3">
                  <div>
                    <label className="data-label block mb-1.5">Title</label>
                    <select {...register('title')} className="hud-input text-xs">
                      <option value="">—</option>
                      {['Mr.','Mrs.','Ms.','Dr.','Prof.'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="data-label block mb-1.5">First Name *</label>
                    <input {...register('first_name')} className="hud-input" placeholder="First name" />
                    {errors.first_name && <p className="mt-1 text-xs text-red-400">{errors.first_name.message}</p>}
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Middle</label>
                    <input {...register('middle_name')} className="hud-input" placeholder="M.I." />
                  </div>
                  <div className="col-span-2">
                    <label className="data-label block mb-1.5">Last Name *</label>
                    <input {...register('last_name')} className="hud-input" placeholder="Last name" />
                    {errors.last_name && <p className="mt-1 text-xs text-red-400">{errors.last_name.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="data-label block mb-1.5">Date of Birth *</label>
                    <input {...register('birth')} type="date" className="hud-input" />
                    {errors.birth && <p className="mt-1 text-xs text-red-400">{errors.birth.message}</p>}
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Gender</label>
                    <select {...register('gender')} className="hud-input">
                      <option value="">Select...</option>
                      {[['M','Male'],['F','Female'],['NB','Non-binary'],['O','Other'],['U','Prefer not to say']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Marital Status</label>
                    <select {...register('marital_status')} className="hud-input">
                      <option value="">Select...</option>
                      {['Single','Married','Divorced','Widowed','Separated','Domestic Partner'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Blood Type</label>
                    <select {...register('blood_type')} className="hud-input">
                      <option value="">Unknown</option>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Preferred Language</label>
                    <select {...register('preferred_language')} className="hud-input">
                      {['English','Spanish','French','Portuguese','Haitian Creole','Mandarin','Arabic','Tagalog','Other'].map(l => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Patient Type</label>
                    <select {...register('patient_type')} className="hud-input">
                      {[['new','New'],['established','Established'],['referral','Referral'],['self_pay','Self-Pay']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Race</label>
                    <select {...register('race')} className="hud-input">
                      <option value="">Prefer not to say</option>
                      {['White','Black or African American','Hispanic or Latino','Asian','American Indian or Alaska Native','Native Hawaiian or Pacific Islander','Two or More Races','Other'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="data-label block mb-1.5">Interpreter Needed</label>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input type="checkbox" {...register('interpreter_needed')} className="accent-gold-500" />
                      <span className="text-sm text-slate-300">Patient requires interpreter services</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => next('demographics')} className="btn-primary text-xs py-1.5">Next: Residency / ID →</button>
                </div>
              </div>
            )}

            {activeSection === 'residency' && (
              <div className="hud-panel p-5 space-y-4">
                <div className="section-heading">Residency & Identification</div>
                <div className="hud-panel border-gold-500/20 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-200 font-medium">US Resident / Citizen</div>
                    <div className="text-xs text-slate-500 mt-0.5">Determines ID type, address fields, and insurance requirements</div>
                  </div>
                  <button type="button"
                    onClick={() => { const n = !w.is_us_resident; setValue('is_us_resident', n); setValue('country_code', n ? 'US' : 'CO'); setValue('tax_id_type', n ? 'SSN' : 'FOREIGN') }}
                    className={cn('relative w-12 h-6 rounded-full transition-colors duration-200', w.is_us_resident ? 'bg-gold-500' : 'bg-slate-600')}>
                    <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200', w.is_us_resident ? 'translate-x-6' : 'translate-x-0.5')} />
                  </button>
                </div>

                {!w.is_us_resident && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="data-label block mb-1.5">Country of Residence *</label>
                      <select value={w.country_code} onChange={e => setValue('country_code', e.target.value)} className="hud-input">
                        {[['CO','Colombia'],['MX','Mexico'],['VE','Venezuela'],['BR','Brazil'],['AR','Argentina'],['DO','Dominican Republic'],['PH','Philippines'],['ES','Spain'],['GB','United Kingdom'],['FR','France'],['DE','Germany'],['IN','India'],['CA','Canada'],['OT','Other']].map(([c,n]) => <option key={c} value={c}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="data-label block mb-1.5">Passport Country</label>
                      <input {...register('passport_country')} className="hud-input font-mono" placeholder="e.g. CO, MX, VE" maxLength={3} />
                    </div>
                    <div className="col-span-2">
                      <label className="data-label block mb-1.5">Passport Number</label>
                      <input {...register('passport_number')} className="hud-input font-mono tracking-wider" placeholder="Passport number" />
                    </div>
                  </div>
                )}

                <TaxIdField
                  countryCode={w.country_code ?? 'US'}
                  isUSResident={w.is_us_resident ?? true}
                  taxIdType={w.tax_id_type ?? 'SSN'}
                  value={w.tax_id ?? ''}
                  onChange={v => setValue('tax_id', v)}
                  onTypeChange={v => setValue('tax_id_type', v)}
                />

                {w.is_us_resident && (
                  <div>
                    <label className="data-label block mb-1.5">Driver's License</label>
                    <input {...register('drv_license')} className="hud-input font-mono" placeholder="License number" />
                  </div>
                )}
                <div className="flex justify-end">
                  <button type="button" onClick={() => next('residency')} className="btn-primary text-xs py-1.5">Next: Address →</button>
                </div>
              </div>
            )}

            {activeSection === 'address' && (
              <div className="hud-panel p-5">
                <SmartAddressBlock
                  label="Patient Address"
                  value={{ country_code: w.country_code, address1: w.address1, address2: w.address2, city: w.city, state: w.state, province: w.province, zipcode: w.zipcode, postal_code: w.postal_code, county: w.county, phone_country_code: w.phone_country_code, phone: w.phone, cell_phone: w.cell_phone, mobile_country_code: w.mobile_country_code }}
                  onChange={addrUpdate}
                  showPhone={false}
                  showMobile={false}
                />
                <div className="flex justify-end mt-4">
                  <button type="button" onClick={() => next('address')} className="btn-primary text-xs py-1.5">Next: Contact →</button>
                </div>
              </div>
            )}

            {activeSection === 'contact' && (
              <div className="hud-panel p-5 space-y-4">
                <div className="section-heading">Contact Information</div>
                <SmartAddressBlock
                  value={{ country_code: w.country_code, address1: '', address2: '', city: '', state: '', province: '', zipcode: '', postal_code: '', county: '', phone_country_code: w.phone_country_code, phone: w.phone, cell_phone: w.cell_phone, mobile_country_code: w.mobile_country_code }}
                  onChange={addrUpdate}
                  showPhone
                  showMobile
                  label=""
                />
                <div>
                  <label className="data-label block mb-1.5">Email</label>
                  <input {...register('email')} type="email" className="hud-input" placeholder="patient@email.com" />
                  {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => next('contact')} className="btn-primary text-xs py-1.5">Next: Emergency →</button>
                </div>
              </div>
            )}

            {(activeSection === 'emergency' || activeSection === 'employer') && (
              <div className="hud-panel p-5 space-y-4">
                <div className="section-heading">{activeSection === 'emergency' ? 'Emergency Contacts' : 'Employer Information'}</div>
                <div className="flex items-center justify-center py-10 border border-dashed border-gold-500/10 rounded-sm">
                  <span className="font-mono text-xs text-slate-600">Save patient first — add from patient profile</span>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => next(activeSection)} className="btn-secondary text-xs py-1.5">Skip for now →</button>
                </div>
              </div>
            )}

            {mutation.error && (
              <div className="hud-panel border-red-500/30 px-4 py-2.5">
                <p className="text-xs text-red-400 font-mono">{String(mutation.error)}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button type="button" onClick={() => navigate('/patients')} className="btn-ghost text-xs">← Cancel</button>
              <button type="submit" disabled={mutation.isPending} className="btn-primary">
                {mutation.isPending ? <div className="w-3.5 h-3.5 border border-navy-900/40 border-t-navy-900 rounded-full animate-spin" /> : <Save size={14} />}
                {mutation.isPending ? 'Registering...' : 'Register Patient'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
