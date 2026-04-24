/**
 * CheckIn page — drives the complete encounter workflow:
 * 1. Patient arrives → mark appointment checked-in
 * 2. Verify insurance coverage
 * 3. Open encounter (calls cr.checkin_and_route())
 * 4. Route to correct clinical app based on provider specialty
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User, Shield, Activity, ExternalLink, CheckCircle,
  AlertCircle, ChevronRight, Clock, Building2, Stethoscope,
  ArrowLeft, Loader, DollarSign,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn, formatDate, calculateAge, formatCurrency } from '@/lib/utils'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

type CheckinStep = 'arrival' | 'insurance' | 'encounter' | 'routed'

const APP_ICONS: Record<string, string> = {
  revela:       '🔬',
  mental_health:'🧠',
  scheduling:   '📅',
}

const APP_COLORS: Record<string, string> = {
  revela:       'border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/15',
  mental_health:'border-blue-500/40   bg-blue-500/10   hover:bg-blue-500/15',
  scheduling:   'border-gold-500/40   bg-gold-500/10   hover:bg-gold-500/15',
}

export function CheckIn() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<CheckinStep>('arrival')
  const [routeResult, setRouteResult] = useState<any>(null)
  const [selectedApp, setSelectedApp] = useState<string | null>(null)

  // Load appointment with patient, provider, facility
  const { data: appt, isLoading: apptLoading } = useQuery({
    queryKey: ['appt-checkin', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('cr').from('appointments')
        .select(`
          *,
          patient:patient_id(
            patient_id, first_name, last_name, birth, gender,
            cell_phone, phone_country_code, email,
            address1, city, state, zipcode, country_code,
            photo_url, preferred_language, interpreter_needed
          ),
          provider:provider_id(
            provider_id, first_name, last_name, credential,
            specialty, npi, facility_id
          ),
          facility:facility_id(
            facility_id, facility_name, facility_type, specialty,
            address1, city, state, phone
          ),
          appt_type:appt_type_id(
            name, code, duration_mins, color,
            primary_cpt_code, primary_cpt_desc, default_fee
          )
        `)
        .eq('appointment_id', parseInt(appointmentId!))
        .single()
      if (error) throw error
      return data
    },
    enabled: !!appointmentId,
  })

  // Load patient insurance
  const { data: insurance = [] } = useQuery({
    queryKey: ['patient-insurance-checkin', appt?.patient_id],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('patient_insurance')
        .select('*')
        .eq('patient_id', appt!.patient_id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
      return data ?? []
    },
    enabled: !!appt?.patient_id,
  })

  // Check-in mutation — calls cr.checkin_and_route()
  const checkinMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('checkin_and_route', {
        p_appointment_id: parseInt(appointmentId!),
        p_org_id: ORG_ID,
      }, { schema: 'cr' } as any)
      if (error) throw error
      return data
    },
    onSuccess: (result) => {
      setRouteResult(result)
      setStep('routed')
      queryClient.invalidateQueries({ queryKey: ['appointments-cal'] })
      queryClient.invalidateQueries({ queryKey: ['appt-checkin', appointmentId] })
    },
  })

  // Mark insurance verified
  const verifyInsuranceMutation = useMutation({
    mutationFn: async (insuranceId: number) => {
      const { error } = await supabase.schema('cr').from('patient_insurance')
        .update({ eligibility_verified: true, eligibility_date: new Date().toISOString() })
        .eq('insurance_id', insuranceId)
      if (error) throw error
      // Log eligibility check
      await supabase.schema('cr').from('eligibility_checks').insert({
        insurance_id:   insuranceId,
        patient_id:     appt!.patient_id,
        org_id:         ORG_ID,
        method:         'manual',
        status:         'active',
        checked_at:     new Date().toISOString(),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient-insurance-checkin'] }),
  })

  if (apptLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-500">
        <Loader size={16} className="animate-spin text-gold-500" />
        <span className="font-mono text-xs">Loading appointment...</span>
      </div>
    </div>
  )

  if (!appt) return (
    <div className="text-center py-20">
      <div className="font-mono text-xs text-red-400">Appointment not found</div>
    </div>
  )

  const patient  = appt.patient as any
  const provider = appt.provider as any
  const facility = appt.facility as any
  const apptType = appt.appt_type as any

  const primaryIns   = insurance.find((i: any) => i.is_primary)
  const secondaryIns = insurance.find((i: any) => !i.is_primary && i.insurance_type === 'secondary')
  const tertiaryIns  = insurance.find((i: any) => i.insurance_type === 'tertiary')

  const allInsuranceVerified = insurance.length === 0 ||
    insurance.every((i: any) => i.eligibility_verified)

  const steps = [
    { id: 'arrival',   label: 'Patient Arrival',  icon: User },
    { id: 'insurance', label: 'Insurance',         icon: Shield },
    { id: 'encounter', label: 'Open Encounter',    icon: Activity },
    { id: 'routed',    label: 'Route to App',      icon: ExternalLink },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/schedule')} className="btn-ghost p-1.5">
          <ArrowLeft size={16} />
        </button>
        <div>
          <div className="section-heading mb-0.5">Encounter Workflow</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">
            Patient Check-In
          </h1>
        </div>
      </div>

      {/* Progress stepper */}
      <div className="hud-panel px-5 py-3 flex items-center justify-between">
        {steps.map(({ id, label, icon: Icon }, idx) => (
          <div key={id} className="flex items-center gap-3">
            <div className={cn(
              'flex items-center gap-2 text-xs',
              step === id        ? 'text-gold-300 font-medium' :
              steps.findIndex(s => s.id === step) > idx ? 'text-emerald-400' :
              'text-slate-600'
            )}>
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center border transition-colors',
                step === id        ? 'border-gold-500 bg-gold-500/20' :
                steps.findIndex(s => s.id === step) > idx ? 'border-emerald-500 bg-emerald-500/20' :
                'border-slate-700 bg-transparent'
              )}>
                {steps.findIndex(s => s.id === step) > idx
                  ? <CheckCircle size={12} className="text-emerald-400" />
                  : <Icon size={11} />
                }
              </div>
              <span className="font-mono hidden sm:block">{label}</span>
            </div>
            {idx < steps.length - 1 && (
              <ChevronRight size={12} className="text-slate-700 mx-1" />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left: Patient + appointment card */}
        <div className="space-y-3">
          {/* Patient */}
          <div className="hud-panel p-4">
            <div className="section-heading mb-3">Patient</div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-sm bg-navy-700 border border-gold-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {patient.photo_url
                  ? <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
                  : <span className="font-display font-bold text-lg text-gold-400">
                      {patient.first_name?.charAt(0)}{patient.last_name?.charAt(0)}
                    </span>
                }
              </div>
              <div>
                <div className="font-body text-sm font-medium text-slate-200">
                  {patient.last_name}, {patient.first_name}
                </div>
                <div className="font-mono text-[10px] text-slate-500">
                  DOB: {formatDate(patient.birth)} · Age {calculateAge(patient.birth)}
                </div>
                <div className="font-mono text-[10px] text-slate-600">
                  {patient.cell_phone ?? patient.phone ?? '—'}
                </div>
              </div>
            </div>
            {patient.interpreter_needed && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-sm">
                <AlertCircle size={10} className="text-amber-400" />
                <span className="font-mono text-[10px] text-amber-300">Interpreter needed · {patient.preferred_language}</span>
              </div>
            )}
          </div>

          {/* Appointment */}
          <div className="hud-panel p-4">
            <div className="section-heading mb-3">Appointment</div>
            <dl className="space-y-2">
              {[
                { label: 'Date',     value: formatDate(appt.appointment_date) },
                { label: 'Time',     value: appt.appointment_time },
                { label: 'Type',     value: apptType?.name ?? appt.appointment_type },
                { label: 'Duration', value: `${appt.duration_mins ?? 30} min` },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3">
                  <dt className="data-label w-16 mt-0.5 flex-shrink-0">{label}</dt>
                  <dd className="text-xs text-slate-300">{value}</dd>
                </div>
              ))}
              {apptType?.primary_cpt_code && (
                <div className="flex gap-3">
                  <dt className="data-label w-16 mt-0.5 flex-shrink-0">CPT</dt>
                  <dd className="font-mono text-xs text-gold-400">{apptType.primary_cpt_code}</dd>
                </div>
              )}
              {appt.reason && (
                <div className="flex gap-3">
                  <dt className="data-label w-16 mt-0.5 flex-shrink-0">Reason</dt>
                  <dd className="text-xs text-slate-400 italic">{appt.reason}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Provider + Facility */}
          <div className="hud-panel p-4">
            <div className="section-heading mb-3">Provider & Facility</div>
            <div className="flex items-center gap-2 mb-2">
              <Stethoscope size={12} className="text-gold-500/50" />
              <div>
                <div className="text-xs text-slate-200 font-medium">
                  {provider.first_name} {provider.last_name}, {provider.credential}
                </div>
                <div className="font-mono text-[10px] text-slate-500">{provider.specialty}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 size={12} className="text-gold-500/50" />
              <div>
                <div className="text-xs text-slate-300">{facility.facility_name}</div>
                <div className="font-mono text-[10px] text-slate-600">{facility.facility_type}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Step content */}
        <div className="col-span-2 space-y-4">

          {/* STEP 1: Arrival */}
          {step === 'arrival' && (
            <div className="hud-panel p-5 space-y-4">
              <div className="section-heading">Patient Arrival Confirmation</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'ID Verified',           key: 'id' },
                  { label: 'Demographic Info Confirmed', key: 'demo' },
                  { label: 'HIPAA Notice Signed',   key: 'hipaa' },
                  { label: 'Consent Forms Completed', key: 'consent' },
                ].map(({ label, key }) => (
                  <ArrivalCheckbox key={key} label={label} />
                ))}
              </div>
              {patient.interpreter_needed && (
                <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-sm">
                  <div className="text-xs text-amber-300 font-medium">Interpreter Required</div>
                  <div className="text-xs text-slate-500 mt-0.5">Arrange {patient.preferred_language} interpreter before proceeding</div>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={() => setStep('insurance')} className="btn-primary">
                  Patient Arrived — Continue to Insurance
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Insurance */}
          {step === 'insurance' && (
            <div className="hud-panel p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="section-heading">Insurance Verification</div>
                {allInsuranceVerified && (
                  <div className="badge badge-active">All Verified</div>
                )}
              </div>

              {insurance.length === 0 ? (
                <div className="flex items-center justify-center py-8 border border-dashed border-gold-500/15 rounded-sm">
                  <div className="text-center">
                    <div className="font-mono text-xs text-slate-500 mb-2">No insurance on file</div>
                    <button className="btn-secondary text-xs">+ Add Insurance</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { ins: primaryIns,   label: 'Primary',   color: 'border-gold-500/30 bg-gold-500/5' },
                    { ins: secondaryIns, label: 'Secondary', color: 'border-blue-500/20  bg-blue-500/5' },
                    { ins: tertiaryIns,  label: 'Tertiary',  color: 'border-slate-500/20 bg-slate-500/5' },
                  ].filter(({ ins }) => ins).map(({ ins, label, color }) => (
                    <InsuranceCard
                      key={ins.insurance_id}
                      insurance={ins}
                      label={label}
                      color={color}
                      onVerify={() => verifyInsuranceMutation.mutate(ins.insurance_id)}
                      verifying={verifyInsuranceMutation.isPending}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setStep('arrival')} className="btn-ghost text-xs">← Back</button>
                <button
                  onClick={() => setStep('encounter')}
                  className="btn-primary"
                >
                  {allInsuranceVerified ? 'Insurance Verified' : 'Skip / Continue'}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Open Encounter */}
          {step === 'encounter' && (
            <div className="hud-panel p-5 space-y-5">
              <div className="section-heading">Open Encounter</div>

              <div className="space-y-3">
                <div className="hud-panel border-gold-500/20 px-4 py-3">
                  <div className="text-xs text-slate-400 mb-3">
                    Opening an encounter will create a unique <span className="text-gold-300 font-mono">encounter_id</span> that
                    links this visit across all PatientTracForge clinical modules.
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: 'Patient',    value: `${patient.first_name} ${patient.last_name}` },
                      { label: 'Provider',   value: `${provider.first_name} ${provider.last_name}, ${provider.credential}` },
                      { label: 'Facility',   value: facility.facility_name },
                      { label: 'Specialty',  value: provider.specialty },
                      { label: 'Type',       value: apptType?.name ?? appt.appointment_type },
                      { label: 'CPT',        value: apptType?.primary_cpt_code ?? '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex gap-2">
                        <span className="data-label w-20 flex-shrink-0">{label}</span>
                        <span className="text-slate-300">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Routing preview */}
                <div className="hud-panel border-blue-500/15 px-4 py-3">
                  <div className="data-label mb-2">Will route to (based on provider specialty)</div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{APP_ICONS[getAppKeyForSpecialty(provider.specialty)]}</span>
                    <div>
                      <div className="text-sm text-slate-200 font-medium">
                        {getAppLabelForSpecialty(provider.specialty)}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {provider.specialty} · {facility.facility_name}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {checkinMutation.error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-sm">
                  <AlertCircle size={13} className="text-red-400" />
                  <span className="text-xs text-red-400 font-mono">{String(checkinMutation.error)}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <button onClick={() => setStep('insurance')} className="btn-ghost text-xs">← Back</button>
                <button
                  onClick={() => checkinMutation.mutate()}
                  disabled={checkinMutation.isPending}
                  className="btn-primary"
                >
                  {checkinMutation.isPending
                    ? <><Loader size={14} className="animate-spin" /> Opening Encounter...</>
                    : <><Activity size={14} /> Open Encounter & Check In</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Routed */}
          {step === 'routed' && routeResult && (
            <div className="hud-panel p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle size={20} className="text-emerald-400" />
                </div>
                <div>
                  <div className="font-display font-semibold text-slate-100">Encounter Opened</div>
                  <div className="font-mono text-xs text-emerald-400">
                    encounter_id: {routeResult.encounter_id}
                  </div>
                </div>
              </div>

              <div className="hud-accent-line" />

              <div>
                <div className="section-heading mb-3">Route to Clinical Module</div>
                <div className="space-y-2">
                  {(routeResult.routes ?? []).map((route: any) => (
                    <a
                      key={route.app_key}
                      href={route.app_url}
                      target={route.app_key !== 'scheduling' ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className={cn(
                        'flex items-center gap-4 px-4 py-3.5 rounded-sm border transition-all duration-150',
                        route.is_primary ? APP_COLORS[route.app_key] : 'border-slate-700/50 bg-slate-800/20 hover:bg-slate-800/40',
                        'group cursor-pointer'
                      )}
                    >
                      <span className="text-2xl">{APP_ICONS[route.app_key]}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('font-display font-semibold text-sm',
                            route.is_primary ? 'text-slate-100' : 'text-slate-400')}>
                            {route.app_label}
                          </span>
                          {route.is_primary && <span className="badge badge-active text-[9px]">Primary</span>}
                        </div>
                        <div className="font-mono text-[10px] text-slate-600 mt-0.5">
                          {route.specialty} · encounter_id {routeResult.encounter_id}
                        </div>
                      </div>
                      <ExternalLink size={14} className={cn(
                        'transition-colors',
                        route.is_primary ? 'text-gold-500/60 group-hover:text-gold-400' : 'text-slate-600'
                      )} />
                    </a>
                  ))}
                </div>
              </div>

              <div className="hud-panel border-slate-700/50 px-4 py-3 flex items-center gap-3">
                <Clock size={12} className="text-slate-600" />
                <span className="font-mono text-[10px] text-slate-600">
                  Encounter opened {new Date().toLocaleTimeString()} ·
                  encounter_id <span className="text-gold-500">{routeResult.encounter_id}</span> is
                  the cross-app key for this visit
                </span>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => navigate('/schedule')} className="btn-ghost text-xs">
                  ← Back to Schedule
                </button>
                <button
                  onClick={() => navigate(`/patients/${appt.patient_id}`)}
                  className="btn-secondary text-xs"
                >
                  View Patient Record →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ArrivalCheckbox({ label }: { label: string }) {
  const [checked, setChecked] = useState(false)
  return (
    <label className={cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-sm border cursor-pointer transition-all',
      checked ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gold-500/10 hover:border-gold-500/20'
    )}>
      <div className={cn(
        'w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors',
        checked ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-600'
      )}>
        {checked && <CheckCircle size={10} className="text-emerald-400" />}
      </div>
      <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="hidden" />
      <span className="text-xs text-slate-300">{label}</span>
    </label>
  )
}

function InsuranceCard({ insurance: ins, label, color, onVerify, verifying }: any) {
  return (
    <div className={cn('rounded-sm border p-3 space-y-2', color)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded',
            label === 'Primary' ? 'bg-gold-500/20 text-gold-400' :
            label === 'Secondary' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400')}>
            {label}
          </span>
          <span className="text-sm font-medium text-slate-200">{ins.insurance_company}</span>
        </div>
        {ins.eligibility_verified ? (
          <div className="flex items-center gap-1 text-emerald-400">
            <CheckCircle size={12} />
            <span className="font-mono text-[10px]">Verified</span>
          </div>
        ) : (
          <button onClick={onVerify} disabled={verifying}
            className="btn-ghost text-xs py-1 px-2 text-gold-400 hover:text-gold-300">
            {verifying ? <Loader size={11} className="animate-spin" /> : <Shield size={11} />}
            Verify
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Policy #',   value: ins.policy_number ?? '—' },
          { label: 'Group #',    value: ins.group_number  ?? '—' },
          { label: 'Subscriber', value: ins.subscriber_name ?? '—' },
          { label: 'Copay',      value: ins.copay_amount != null ? `$${ins.copay_amount}` : '—' },
          { label: 'Deductible', value: ins.deductible_amount != null ? `$${ins.deductible_amount}` : '—' },
          { label: 'Plan',       value: ins.plan_name ?? '—' },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="data-label mb-0.5">{label}</div>
            <div className="font-mono text-[10px] text-slate-300 truncate">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function getAppKeyForSpecialty(specialty: string): string {
  if (!specialty) return 'scheduling'
  const s = specialty.toLowerCase()
  if (s.includes('plastic') || s.includes('cosmetic')) return 'revela'
  if (s.includes('psych') || s.includes('mental') || s.includes('addiction') || s.includes('therapy')) return 'mental_health'
  return 'scheduling'
}

function getAppLabelForSpecialty(specialty: string): string {
  const key = getAppKeyForSpecialty(specialty)
  return { revela: 'Revela — Plastic Surgery', mental_health: 'Mental Health', scheduling: 'PatientTracForge Scheduling' }[key] ?? 'Scheduling'
}
