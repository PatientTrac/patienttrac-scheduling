import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, User, Phone, MapPin, Briefcase, AlertTriangle } from 'lucide-react'
import { supabase, type PatientInsert } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const patientSchema = z.object({
  first_name:   z.string().min(1, 'Required'),
  last_name:    z.string().min(1, 'Required'),
  date_of_birth: z.string().min(1, 'Required'),
  gender:       z.string().optional(),
  email:        z.string().email('Invalid email').optional().or(z.literal('')),
  phone_mobile: z.string().optional(),
  phone_home:   z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city:         z.string().optional(),
  state:        z.string().optional(),
  zip:          z.string().optional(),
  ssn_last4:    z.string().max(4).optional(),
  status:       z.enum(['active', 'inactive', 'deceased']).default('active'),
})

type PatientFormData = z.infer<typeof patientSchema>

const sections = [
  { id: 'demographics', label: 'Demographics', icon: User },
  { id: 'contact',      label: 'Contact',       icon: Phone },
  { id: 'address',      label: 'Address',       icon: MapPin },
  { id: 'emergency',    label: 'Emergency',     icon: AlertTriangle },
  { id: 'employer',     label: 'Employer',      icon: Briefcase },
]

export function NewPatient() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeSection, setActiveSection] = useState('demographics')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: { status: 'active' },
  })

  const mutation = useMutation({
    mutationFn: async (data: PatientFormData) => {
      const insert: PatientInsert = {
        ...data,
        email: data.email || null,
        phone_mobile: data.phone_mobile || null,
        phone_home: data.phone_home || null,
        address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        ssn_last4: data.ssn_last4 || null,
        gender: data.gender || null,
        photo_url: null,
      }
      const { data: result, error } = await supabase.schema('cr').from('patient').insert(insert).select().single()
      if (error) throw error
      return result
    },
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate(`/patients/${patient.patient_id}`)
    },
  })

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/patients')} className="btn-ghost p-1.5">
          <ArrowLeft size={16} />
        </button>
        <div>
          <div className="section-heading mb-0.5">Patient Registry</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">
            Register New Patient
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Section nav */}
        <div className="hud-panel p-3">
          <div className="section-heading mb-3">Sections</div>
          <ul className="space-y-0.5">
            {sections.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm transition-all duration-150 text-left',
                    activeSection === id
                      ? 'text-gold-300 bg-gold-500/8 border-l-2 border-gold-500 pl-[10px]'
                      : 'text-slate-400 hover:text-gold-300 hover:bg-gold-500/5 border-l-2 border-transparent'
                  )}
                >
                  <Icon size={13} className={activeSection === id ? 'text-gold-400' : 'text-slate-600'} />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Form */}
        <div className="col-span-3">
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            {/* Demographics */}
            {activeSection === 'demographics' && (
              <div className="hud-panel p-5 space-y-4">
                <div className="section-heading">Patient Demographics</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="data-label block mb-1.5">First Name *</label>
                    <input {...register('first_name')} className="hud-input" placeholder="First name" />
                    {errors.first_name && <p className="mt-1 text-xs text-red-400">{errors.first_name.message}</p>}
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Last Name *</label>
                    <input {...register('last_name')} className="hud-input" placeholder="Last name" />
                    {errors.last_name && <p className="mt-1 text-xs text-red-400">{errors.last_name.message}</p>}
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Date of Birth *</label>
                    <input {...register('date_of_birth')} type="date" className="hud-input" />
                    {errors.date_of_birth && <p className="mt-1 text-xs text-red-400">{errors.date_of_birth.message}</p>}
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Gender</label>
                    <select {...register('gender')} className="hud-input">
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="non_binary">Non-binary</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">SSN Last 4</label>
                    <input {...register('ssn_last4')} className="hud-input" placeholder="XXXX" maxLength={4} />
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Status</label>
                    <select {...register('status')} className="hud-input">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Contact */}
            {activeSection === 'contact' && (
              <div className="hud-panel p-5 space-y-4">
                <div className="section-heading">Contact Information</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="data-label block mb-1.5">Email</label>
                    <input {...register('email')} type="email" className="hud-input" placeholder="patient@email.com" />
                    {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Mobile Phone</label>
                    <input {...register('phone_mobile')} className="hud-input" placeholder="(555) 000-0000" />
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">Home Phone</label>
                    <input {...register('phone_home')} className="hud-input" placeholder="(555) 000-0000" />
                  </div>
                </div>
              </div>
            )}

            {/* Address */}
            {activeSection === 'address' && (
              <div className="hud-panel p-5 space-y-4">
                <div className="section-heading">Address</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="data-label block mb-1.5">Street Address</label>
                    <input {...register('address_line1')} className="hud-input" placeholder="123 Main St" />
                  </div>
                  <div className="col-span-2">
                    <label className="data-label block mb-1.5">Address Line 2</label>
                    <input {...register('address_line2')} className="hud-input" placeholder="Apt, Suite, etc." />
                  </div>
                  <div>
                    <label className="data-label block mb-1.5">City</label>
                    <input {...register('city')} className="hud-input" placeholder="City" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="data-label block mb-1.5">State</label>
                      <input {...register('state')} className="hud-input" placeholder="TX" maxLength={2} />
                    </div>
                    <div>
                      <label className="data-label block mb-1.5">ZIP</label>
                      <input {...register('zip')} className="hud-input" placeholder="75001" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Emergency / Employer stubs */}
            {(activeSection === 'emergency' || activeSection === 'employer') && (
              <div className="hud-panel p-5">
                <div className="section-heading mb-3">
                  {activeSection === 'emergency' ? 'Emergency Contacts' : 'Employer Information'}
                </div>
                <div className="flex items-center justify-center py-12 border border-dashed border-gold-500/10 rounded-sm">
                  <span className="font-mono text-xs text-slate-600">
                    Coming in next sprint — save patient first, then add from profile
                  </span>
                </div>
              </div>
            )}

            {/* Footer actions */}
            {mutation.error && (
              <div className="hud-panel border-red-500/30 px-4 py-3">
                <p className="text-xs text-red-400 font-mono">{String(mutation.error)}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => navigate('/patients')} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting || mutation.isPending} className="btn-primary">
                {mutation.isPending ? (
                  <div className="w-3.5 h-3.5 border border-navy-900/40 border-t-navy-900 rounded-full animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {mutation.isPending ? 'Saving...' : 'Register Patient'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Need useState import
import { useState } from 'react'
