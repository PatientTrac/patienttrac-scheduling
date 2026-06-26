import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Activity, Shield, CreditCard, Edit, ClipboardList } from 'lucide-react'
import { launchApp } from '../lib/crossAppLaunch'
import { useAuth } from '../lib/auth'
import { supabase, type PatientRow } from '@/lib/supabase'
import { formatDate, calculateAge, cn } from '@/lib/utils'
import { ClinicalChart, ClinicalViewerProvider } from '@patienttrac/clinical-viewer'

const tabs = [
  { id: 'overview',    label: 'Overview',    icon: Activity },
  { id: 'insurance',   label: 'Insurance',   icon: Shield },
  { id: 'encounters',  label: 'Encounters',  icon: Calendar },
  { id: 'billing',     label: 'Billing',     icon: CreditCard },
  { id: 'chart',       label: 'Clinical Chart', icon: ClipboardList },
]

export function PatientDetail() {
  const { patientId } = useParams<{ patientId: string }>()
  const { orgId } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('cr')
        .from('patient')
        .select('*')
        .eq('patient_id', patientId!)
        .single()
      if (error) throw error
      return data as PatientRow
    },
    enabled: !!patientId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-4 h-4 border border-gold-500/40 border-t-gold-500 rounded-full animate-spin" />
          <span className="font-mono text-xs">Loading patient...</span>
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="text-center py-20">
        <div className="font-mono text-xs text-red-400">Patient not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/patients')} className="btn-ghost p-1.5 mt-1">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="section-heading mb-1">Patient Profile</div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-navy-700 border border-gold-500/20 flex items-center justify-center">
              <span className="font-display font-bold text-lg text-gold-400">
                {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
              </span>
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">
                {patient.first_name} {patient.last_name}
              </h1>
              <div className="flex items-center gap-4 mt-0.5">
                <span className="font-mono text-xs text-slate-500">
                  #{patient.patient_id.slice(0, 8).toUpperCase()}
                </span>
                <span className={cn(
                  'badge',
                  patient.status === 'active' ? 'badge-active' : 'badge-inactive'
                )}>
                  {patient.status}
                </span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* Cross-app deep links — single-use token carries patient context */}
              <button className="btn-secondary text-xs"
                onClick={() => launchApp('surgery', { orgId, patientId: Number(patientId) })}>
                Open in Surgery
              </button>
              <button className="btn-secondary text-xs"
                onClick={() => launchApp('or', { orgId, patientId: Number(patientId) })}>
                Open in OR
              </button>
              <button className="btn-secondary">
                <Edit size={13} />
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick info bar */}
      <div className="hud-panel px-5 py-3 grid grid-cols-5 gap-4 divide-x divide-gold-500/10">
        {[
          { label: 'Date of Birth', value: formatDate(patient.date_of_birth, 'long'), icon: Calendar },
          { label: 'Age',           value: `${calculateAge(patient.date_of_birth)} years`, icon: Activity },
          { label: 'Mobile',        value: patient.phone_mobile ?? '—', icon: Phone },
          { label: 'Email',         value: patient.email ?? '—', icon: Mail },
          { label: 'City',          value: patient.city ?? '—', icon: MapPin },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="px-4 first:pl-0 last:pr-0">
            <div className="data-label flex items-center gap-1.5 mb-1">
              <Icon size={10} />
              {label}
            </div>
            <div className="font-body text-sm text-slate-300 truncate">{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gold-500/10">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-all duration-150 -mb-px',
              activeTab === id
                ? 'text-gold-300 border-gold-500 font-medium'
                : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="hud-panel p-5">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="section-heading mb-3">Demographics</div>
              <dl className="space-y-3">
                {[
                  { label: 'Full Name',   value: `${patient.first_name} ${patient.last_name}` },
                  { label: 'Gender',      value: patient.gender ?? '—' },
                  { label: 'SSN Last 4',  value: patient.ssn_last4 ? `•••• ${patient.ssn_last4}` : '—' },
                  { label: 'Address',     value: [patient.address_line1, patient.city, patient.state, patient.zip].filter(Boolean).join(', ') || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-4">
                    <dt className="data-label w-28 flex-shrink-0 mt-0.5">{label}</dt>
                    <dd className="text-sm text-slate-300">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <div className="section-heading mb-3">Recent Encounters</div>
              <div className="flex items-center justify-center h-24 border border-dashed border-gold-500/10 rounded-sm">
                <span className="font-mono text-xs text-slate-600">No encounters yet</span>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'insurance' || activeTab === 'encounters' || activeTab === 'billing') && (
          <div className="flex items-center justify-center py-16 border border-dashed border-gold-500/10 rounded-sm">
            <div className="text-center">
              <div className="font-display text-sm text-slate-500 uppercase tracking-wider mb-1">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </div>
              <div className="font-mono text-xs text-slate-600">Module coming in next sprint</div>
            </div>
          </div>
        )}

        {activeTab === 'chart' && (
          <ClinicalViewerProvider client={supabase}>
            <ClinicalChart patientId={Number(patientId)} />
          </ClinicalViewerProvider>
        )}
      </div>
    </div>
  )
}

