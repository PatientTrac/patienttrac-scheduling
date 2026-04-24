/**
 * /intake?token=xxx  — patient-facing pre-visit questionnaire
 * No auth required. Token validated server-side with 48h expiry.
 */
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle, Clock, ChevronRight, ChevronLeft, Loader, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

type Step = 'loading' | 'welcome' | 'complaint' | 'symptoms' | 'medications' | 'review' | 'done' | 'error' | 'expired'

const TRIAGE_CONFIG = {
  emergent: { label: 'Emergent', color: 'bg-red-500/20 border-red-500/40 text-red-300', icon: '🚨' },
  urgent:   { label: 'Urgent',   color: 'bg-amber-500/20 border-amber-500/40 text-amber-300', icon: '⚠️' },
  routine:  { label: 'Routine',  color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300', icon: '✓' },
}

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Minimal', 2: 'Mild', 3: 'Mild', 4: 'Moderate', 5: 'Moderate',
  6: 'Moderate', 7: 'Severe', 8: 'Severe', 9: 'Very severe', 10: 'Worst possible',
}

export function Intake() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [step, setStep]         = useState<Step>('loading')
  const [intake, setIntake]     = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [triageResult, setTriageResult] = useState<any>(null)

  // Form state
  const [chiefComplaint, setChiefComplaint]     = useState('')
  const [symptomDuration, setSymptomDuration]   = useState('')
  const [severity, setSeverity]                 = useState(5)
  const [medications, setMedications]           = useState<string[]>([])
  const [medInput, setMedInput]                 = useState('')
  const [allergies, setAllergies]               = useState<string[]>([])
  const [allergyInput, setAllergyInput]         = useState('')
  const [recentChanges, setRecentChanges]       = useState('')
  const [additionalConcerns, setAdditionalConcerns] = useState('')

  useEffect(() => {
    if (!token) { setStep('error'); return }
    fetch(`${SUPABASE_URL}/functions/v1/patient-intake?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setStep(data.error.includes('expired') ? 'expired' : 'error')
          return
        }
        if (data.status === 'completed') { setStep('done'); return }
        setIntake(data)
        setStep('welcome')
      })
      .catch(() => setStep('error'))
  }, [token])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/patient-intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          token,
          responses: {
            chief_complaint: chiefComplaint,
            symptom_duration: symptomDuration,
            severity_1_10: severity,
            current_medications: medications,
            allergies_reported: allergies.length ? allergies : ['NKDA'],
            recent_changes: recentChanges,
            additional_concerns: additionalConcerns,
          }
        })
      })
      const data = await res.json()
      setTriageResult(data)
      setStep('done')
    } catch {
      setStep('error')
    } finally {
      setSubmitting(false)
    }
  }

  function addMed() {
    if (medInput.trim()) { setMedications(m => [...m, medInput.trim()]); setMedInput('') }
  }
  function addAllergy() {
    if (allergyInput.trim()) { setAllergies(a => [...a, allergyInput.trim()]); setAllergyInput('') }
  }

  const appt = intake?.appointment as any
  const provider = appt?.provider as any
  const apptDate = appt?.appointment_date
    ? new Date(appt.appointment_date).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
    : ''

  const steps = ['welcome','complaint','symptoms','medications','review']
  const stepIdx = steps.indexOf(step)
  const progress = stepIdx >= 0 ? ((stepIdx) / (steps.length - 1)) * 100 : 0

  // ── Shell ──────────────────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-navy-900 flex flex-col">
      {/* Top bar */}
      <div className="bg-navy-800 border-b border-gold-500/15 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="font-display font-bold text-gold-400 text-sm">PatientTracForge</div>
          <div className="font-mono text-[10px] text-slate-600">Pre-Visit Intake</div>
        </div>
        {stepIdx > 0 && stepIdx < steps.length - 1 && (
          <div className="font-mono text-xs text-slate-500">
            Step {stepIdx} of {steps.length - 2}
          </div>
        )}
      </div>
      {/* Progress bar */}
      {stepIdx >= 0 && step !== 'done' && (
        <div className="h-0.5 bg-navy-700 flex-shrink-0">
          <div className="h-full bg-gold-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-8">
          {children}
        </div>
      </div>
    </div>
  )

  // ── States ─────────────────────────────────────────────────────────────
  if (step === 'loading') return (
    <Shell>
      <div className="flex items-center justify-center py-20">
        <Loader size={20} className="animate-spin text-gold-500" />
      </div>
    </Shell>
  )

  if (step === 'expired') return (
    <Shell>
      <div className="text-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
          <Clock size={28} className="text-amber-400" />
        </div>
        <h2 className="font-display font-bold text-xl text-slate-100">Link Expired</h2>
        <p className="text-sm text-slate-400">This intake link has expired (48-hour limit). Please contact the clinic to receive a new link.</p>
        <div className="hud-panel px-4 py-3 text-sm text-slate-400">
          Call us: <span className="text-gold-300">(305) 123-4567</span>
        </div>
      </div>
    </Shell>
  )

  if (step === 'error') return (
    <Shell>
      <div className="text-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <h2 className="font-display font-bold text-xl text-slate-100">Invalid Link</h2>
        <p className="text-sm text-slate-400">This intake link is invalid or has already been used. Please contact the clinic.</p>
      </div>
    </Shell>
  )

  if (step === 'done') {
    const triage = triageResult?.triage_priority ?? 'routine'
    const tc = TRIAGE_CONFIG[triage as keyof typeof TRIAGE_CONFIG] ?? TRIAGE_CONFIG.routine
    const redFlags = triageResult?.red_flags ?? []
    return (
      <Shell>
        <div className="space-y-5 animate-fade-in">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <h2 className="font-display font-bold text-2xl text-slate-100">Intake Complete</h2>
            <p className="text-sm text-slate-400">Thank you! Your provider will review this before your visit.</p>
          </div>

          {/* Triage badge */}
          <div className={cn('border rounded-sm px-4 py-3 text-center', tc.color)}>
            <div className="text-lg mb-1">{tc.icon}</div>
            <div className="font-mono text-xs uppercase tracking-wider">Triage Priority</div>
            <div className="font-display font-bold text-lg mt-0.5">{tc.label}</div>
          </div>

          {/* Red flags */}
          {redFlags.length > 0 && (
            <div className="hud-panel border-red-500/20 px-4 py-3 space-y-2">
              <div className="font-mono text-xs text-red-400 uppercase tracking-wider">⚠ Items flagged for provider</div>
              {redFlags.map((flag: string, i: number) => (
                <div key={i} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          )}

          {triage === 'emergent' && (
            <div className="bg-red-500/20 border border-red-500/40 rounded-sm px-4 py-3 text-center">
              <div className="text-red-300 font-bold text-sm">If this is an emergency, call 911 immediately.</div>
            </div>
          )}

          <div className="hud-panel px-4 py-3 text-center">
            <div className="text-sm text-slate-400">Your appointment</div>
            {apptDate && <div className="font-medium text-slate-200 mt-1">{apptDate}</div>}
            {provider && <div className="text-sm text-slate-400">{provider.first_name} {provider.last_name}</div>}
          </div>
        </div>
      </Shell>
    )
  }

  // ── Welcome ────────────────────────────────────────────────────────────
  if (step === 'welcome') return (
    <Shell>
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="font-mono text-xs text-gold-500/60 uppercase tracking-widest mb-2">Pre-Visit Intake</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 leading-tight">
            Hello{intake?.patient?.first_name ? `, ${intake.patient.first_name}` : ''}
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Please complete this brief intake before your appointment. It takes about 3–5 minutes and helps your provider prepare.
          </p>
        </div>

        {/* Appointment card */}
        {appt && (
          <div className="hud-panel px-4 py-3 space-y-2">
            <div className="font-mono text-[10px] text-slate-600 uppercase tracking-wider">Your appointment</div>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-200">{apptDate}</div>
                <div className="text-sm text-slate-400">at {appt.appointment_time}</div>
                {provider && <div className="font-mono text-xs text-slate-500 mt-1">{provider.first_name} {provider.last_name} · {provider.specialty}</div>}
              </div>
            </div>
          </div>
        )}

        {/* What to expect */}
        <div className="space-y-2">
          {[
            { step: '1', text: 'Describe your chief complaint' },
            { step: '2', text: 'Rate your symptoms' },
            { step: '3', text: 'Review your medications & allergies' },
          ].map(({ step: s, text }) => (
            <div key={s} className="flex items-center gap-3 px-3 py-2.5 bg-navy-700/50 rounded-sm">
              <div className="w-6 h-6 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                <span className="font-mono text-[10px] text-gold-400">{s}</span>
              </div>
              <span className="text-sm text-slate-300">{text}</span>
            </div>
          ))}
        </div>

        <div className="text-xs text-slate-600 leading-relaxed">
          Your information is protected under HIPAA. This intake is linked to your appointment only.
        </div>

        <button onClick={() => setStep('complaint')} className="btn-primary w-full justify-center py-3">
          Start Intake
          <ChevronRight size={16} />
        </button>
      </div>
    </Shell>
  )

  // ── Chief Complaint ────────────────────────────────────────────────────
  if (step === 'complaint') return (
    <Shell>
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="font-mono text-xs text-slate-500 mb-1">Step 1 of 3</div>
          <h2 className="font-display font-bold text-xl text-slate-100">What brings you in today?</h2>
          <p className="text-sm text-slate-400 mt-1">Be as specific as possible — this goes directly to your provider.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="data-label block mb-2">Chief complaint *</label>
            <textarea
              value={chiefComplaint}
              onChange={e => setChiefComplaint(e.target.value)}
              className="hud-input w-full h-28 resize-none text-sm"
              placeholder="e.g. I have had persistent lower back pain for the past 3 weeks that radiates down my left leg..."
            />
            <div className="text-right font-mono text-[10px] text-slate-600 mt-1">{chiefComplaint.length} chars</div>
          </div>

          <div>
            <label className="data-label block mb-2">How long have you had this? *</label>
            <div className="grid grid-cols-2 gap-2">
              {['Today','2–3 days','1 week','2 weeks','1 month','3+ months'].map(opt => (
                <button key={opt} onClick={() => setSymptomDuration(opt)}
                  className={cn('px-3 py-2.5 text-sm rounded-sm border text-left transition-colors',
                    symptomDuration === opt
                      ? 'border-gold-500/50 bg-gold-500/15 text-gold-300'
                      : 'border-gold-500/10 text-slate-400 hover:border-gold-500/25 hover:text-slate-300')}>
                  {opt}
                </button>
              ))}
            </div>
            <input
              value={!['Today','2–3 days','1 week','2 weeks','1 month','3+ months'].includes(symptomDuration) ? symptomDuration : ''}
              onChange={e => setSymptomDuration(e.target.value)}
              className="hud-input w-full mt-2 text-sm"
              placeholder="Or describe duration..."
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setStep('welcome')} className="btn-secondary flex-1 justify-center">
            <ChevronLeft size={14} /> Back
          </button>
          <button
            onClick={() => setStep('symptoms')}
            disabled={!chiefComplaint.trim() || !symptomDuration}
            className="btn-primary flex-1 justify-center">
            Continue <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </Shell>
  )

  // ── Symptoms ───────────────────────────────────────────────────────────
  if (step === 'symptoms') return (
    <Shell>
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="font-mono text-xs text-slate-500 mb-1">Step 2 of 3</div>
          <h2 className="font-display font-bold text-xl text-slate-100">Rate your symptoms</h2>
        </div>

        <div className="space-y-4">
          {/* Severity slider */}
          <div>
            <label className="data-label block mb-3">
              Pain / discomfort severity
              <span className={cn('ml-2 font-mono text-sm font-bold',
                severity >= 8 ? 'text-red-400' : severity >= 5 ? 'text-amber-400' : 'text-emerald-400')}>
                {severity}/10 — {SEVERITY_LABELS[severity]}
              </span>
            </label>
            <input
              type="range" min={1} max={10} value={severity}
              onChange={e => setSeverity(parseInt(e.target.value))}
              className="w-full accent-gold-500"
            />
            <div className="flex justify-between font-mono text-[10px] text-slate-600 mt-1">
              <span>1 · Minimal</span>
              <span>5 · Moderate</span>
              <span>10 · Worst</span>
            </div>
          </div>

          {/* Recent changes */}
          <div>
            <label className="data-label block mb-2">Any recent changes or events that may be related?</label>
            <textarea
              value={recentChanges}
              onChange={e => setRecentChanges(e.target.value)}
              className="hud-input w-full h-20 resize-none text-sm"
              placeholder="e.g. Started a new medication, recent injury, surgery, travel, stress..."
            />
          </div>

          {/* Additional concerns */}
          <div>
            <label className="data-label block mb-2">Any other concerns you'd like to discuss?</label>
            <textarea
              value={additionalConcerns}
              onChange={e => setAdditionalConcerns(e.target.value)}
              className="hud-input w-full h-20 resize-none text-sm"
              placeholder="Any other symptoms, questions, or topics for your provider..."
            />
          </div>
        </div>

        {severity >= 8 && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-sm">
            <AlertTriangle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-red-300">If this is a medical emergency, please call 911 or go to your nearest emergency room.</span>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => setStep('complaint')} className="btn-secondary flex-1 justify-center">
            <ChevronLeft size={14} /> Back
          </button>
          <button onClick={() => setStep('medications')} className="btn-primary flex-1 justify-center">
            Continue <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </Shell>
  )

  // ── Medications ────────────────────────────────────────────────────────
  if (step === 'medications') return (
    <Shell>
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="font-mono text-xs text-slate-500 mb-1">Step 3 of 3</div>
          <h2 className="font-display font-bold text-xl text-slate-100">Medications & Allergies</h2>
          <p className="text-sm text-slate-400 mt-1">List all current medications including supplements.</p>
        </div>

        {/* Medications */}
        <div>
          <label className="data-label block mb-2">Current medications</label>
          <div className="space-y-2 mb-2">
            {medications.map((med, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-navy-700/50 rounded-sm">
                <span className="flex-1 text-sm text-slate-200">{med}</span>
                <button onClick={() => setMedications(m => m.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 transition-colors">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={medInput}
              onChange={e => setMedInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMed())}
              className="hud-input flex-1 text-sm"
              placeholder="Medication name, dose, frequency..."
            />
            <button onClick={addMed} disabled={!medInput.trim()} className="btn-secondary px-3">
              <Plus size={14} />
            </button>
          </div>
          {medications.length === 0 && (
            <button onClick={() => setMedications(['No current medications'])}
              className="mt-2 font-mono text-xs text-slate-500 hover:text-gold-400 transition-colors">
              + No current medications
            </button>
          )}
        </div>

        {/* Allergies */}
        <div>
          <label className="data-label block mb-2">Allergies (medications, foods, environmental)</label>
          <div className="space-y-2 mb-2">
            {allergies.map((allergy, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-red-500/5 border border-red-500/15 rounded-sm">
                <span className="flex-1 text-sm text-slate-200">{allergy}</span>
                <button onClick={() => setAllergies(a => a.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 transition-colors">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={allergyInput}
              onChange={e => setAllergyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAllergy())}
              className="hud-input flex-1 text-sm"
              placeholder="e.g. Penicillin — rash, Shellfish — anaphylaxis..."
            />
            <button onClick={addAllergy} disabled={!allergyInput.trim()} className="btn-secondary px-3">
              <Plus size={14} />
            </button>
          </div>
          {allergies.length === 0 && (
            <button onClick={() => setAllergies(['NKDA'])}
              className="mt-2 font-mono text-xs text-slate-500 hover:text-gold-400 transition-colors">
              + No known drug allergies (NKDA)
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setStep('symptoms')} className="btn-secondary flex-1 justify-center">
            <ChevronLeft size={14} /> Back
          </button>
          <button onClick={() => setStep('review')} className="btn-primary flex-1 justify-center">
            Review <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </Shell>
  )

  // ── Review ─────────────────────────────────────────────────────────────
  if (step === 'review') return (
    <Shell>
      <div className="space-y-5 animate-fade-in">
        <div>
          <h2 className="font-display font-bold text-xl text-slate-100">Review & Submit</h2>
          <p className="text-sm text-slate-400 mt-1">Please confirm everything looks correct before submitting.</p>
        </div>

        <div className="space-y-3">
          {[
            {
              label: 'Chief Complaint',
              content: chiefComplaint,
              onEdit: () => setStep('complaint'),
            },
            {
              label: 'Duration',
              content: symptomDuration,
              onEdit: () => setStep('complaint'),
            },
            {
              label: 'Severity',
              content: `${severity}/10 — ${SEVERITY_LABELS[severity]}`,
              onEdit: () => setStep('symptoms'),
            },
            {
              label: 'Medications',
              content: medications.length ? medications.join(', ') : 'None reported',
              onEdit: () => setStep('medications'),
            },
            {
              label: 'Allergies',
              content: allergies.length ? allergies.join(', ') : 'NKDA',
              onEdit: () => setStep('medications'),
            },
            ...(recentChanges ? [{ label: 'Recent Changes', content: recentChanges, onEdit: () => setStep('symptoms') }] : []),
            ...(additionalConcerns ? [{ label: 'Additional Concerns', content: additionalConcerns, onEdit: () => setStep('symptoms') }] : []),
          ].map(({ label, content, onEdit }) => (
            <div key={label} className="hud-panel px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="data-label mb-0.5">{label}</div>
                  <div className="text-sm text-slate-200 leading-relaxed">{content}</div>
                </div>
                <button onClick={onEdit} className="btn-ghost text-xs py-1 flex-shrink-0">Edit</button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setStep('medications')} className="btn-secondary flex-1 justify-center">
            <ChevronLeft size={14} /> Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary flex-1 justify-center py-3">
            {submitting
              ? <><Loader size={14} className="animate-spin" /> Submitting...</>
              : <>Submit Intake ✓</>
            }
          </button>
        </div>

        <p className="text-[11px] text-slate-600 text-center leading-relaxed">
          By submitting you confirm this information is accurate to the best of your knowledge. Your provider will review it before your visit.
        </p>
      </div>
    </Shell>
  )

  return null
}
