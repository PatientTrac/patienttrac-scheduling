import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addDays, addWeeks, subWeeks, startOfWeek, isSameDay, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Loader } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7am–7pm
const SLOT_HEIGHT = 64 // px per hour

const NOSHOW_BADGE: Record<string, { label: string; cls: string }> = {
  low:      { label: '▸ Low',      cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  medium:   { label: '▲ Med',      cls: 'bg-amber-500/20   text-amber-400   border-amber-500/30' },
  high:     { label: '⚠ High',     cls: 'bg-orange-500/20  text-orange-400  border-orange-500/30' },
  critical: { label: '🔴 Critical', cls: 'bg-red-500/20     text-red-400     border-red-500/30' },
}

const STATUS_COLORS: Record<string, string> = {
  scheduled:  'bg-blue-500/20  border-blue-500/40  text-blue-300',
  confirmed:  'bg-gold-500/20  border-gold-500/40  text-gold-300',
  checked_in: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  completed:  'bg-slate-500/15 border-slate-500/30 text-slate-400',
  cancelled:  'bg-red-500/10   border-red-500/20   text-red-400 opacity-50',
  no_show:    'bg-red-500/10   border-red-500/20   text-red-400 opacity-40',
}

export function Schedule() {
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate]     = useState(new Date())
  const [view, setView]                   = useState<'week'|'day'>('week')
  const [filterProvider, setFilterProvider] = useState<number | null>(null)
  const [showNewAppt, setShowNewAppt]     = useState(false)
  const [newApptSlot, setNewApptSlot]     = useState<{ date: string; time: string; providerId: number } | null>(null)
  const [dragAppt, setDragAppt]           = useState<any | null>(null)
  const [dragOver, setDragOver]           = useState<{ date: string; time: string } | null>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays  = Array.from({ length: view === 'week' ? 5 : 1 }, (_, i) =>
    view === 'week' ? addDays(weekStart, i) : currentDate
  )

  // Fetch providers
  const { data: providers = [] } = useQuery({
    queryKey: ['providers', ORG_ID],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('providers')
        .select('provider_id, first_name, last_name, credential, specialty, facility_id')
        .eq('org_id', ORG_ID).eq('is_active', true).order('last_name')
      return data ?? []
    },
  })

  // Fetch appointment types
  const { data: apptTypes = [] } = useQuery({
    queryKey: ['appt-types-cal', ORG_ID],
    queryFn: async () => {
      const { data } = await supabase.schema('saas').from('appointment_types')
        .select('appt_type_id, name, code, duration_mins, color, primary_cpt_code')
        .eq('org_id', ORG_ID).eq('is_active', true).order('name')
      return data ?? []
    },
  })

  // Fetch appointments for visible range
  const startDate = format(weekDays[0], 'yyyy-MM-dd')
  const endDate   = format(weekDays[weekDays.length - 1], 'yyyy-MM-dd')

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments-cal', startDate, endDate, filterProvider],
    queryFn: async () => {
      let q = supabase.schema('cr').from('appointments')
        .select(`
          appointment_id, patient_id, provider_id, facility_id,
          appointment_date, appointment_time, appointment_type,
          appt_type_id, status, duration_mins, reason,
          patient:patient_id(first_name, last_name, cell_phone),
          provider:provider_id(first_name, last_name, credential, specialty)
        `)
        .eq('org_id', ORG_ID)
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .not('status', 'in', '("cancelled")')
      if (filterProvider) q = q.eq('provider_id', filterProvider)
      const { data } = await q.order('appointment_time')
      return data ?? []
    },
  })

  // Fetch no-show risk scores for visible appointments
  const { data: noshowScores = [] } = useQuery({
    queryKey: ['noshow-scores', startDate, endDate],
    queryFn: async () => {
      const apptIds = appointments.map((a: any) => a.appointment_id)
      if (!apptIds.length) return []
      const { data } = await supabase.schema('cr').from('noshow_risk_scores')
        .select('appointment_id, risk_score, risk_label, risk_factors, recommendation')
        .in('appointment_id', apptIds)
        .order('scored_at', { ascending: false })
      // Dedupe by appointment_id — keep most recent
      const seen = new Set<number>()
      return (data ?? []).filter((r: any) => {
        if (seen.has(r.appointment_id)) return false
        seen.add(r.appointment_id); return true
      })
    },
    enabled: appointments.length > 0,
  })

  const riskByAppt = Object.fromEntries(noshowScores.map((s: any) => [s.appointment_id, s]))

  // Move appointment (drag & drop)
  const moveMutation = useMutation({
    mutationFn: async ({ id, date, time }: { id: number; date: string; time: string }) => {
      const { error } = await supabase.schema('cr').from('appointments')
        .update({ appointment_date: date, appointment_time: time, update_date: new Date().toISOString() })
        .eq('appointment_id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments-cal'] }),
  })

  // New appointment
  const newApptMutation = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.schema('cr').from('appointments').insert({
        ...form, org_id: ORG_ID, insert_date: new Date().toISOString(), update_date: new Date().toISOString()
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-cal'] })
      setShowNewAppt(false)
      setNewApptSlot(null)
    },
  })

  function getApptTop(time: string): number {
    const [h, m] = time.split(':').map(Number)
    return ((h - 7) + m / 60) * SLOT_HEIGHT
  }

  function getApptHeight(mins: number): number {
    return Math.max((mins / 60) * SLOT_HEIGHT, 28)
  }

  function timeFromY(y: number): string {
    const totalMins = Math.round((y / SLOT_HEIGHT) * 60 / 15) * 15
    const h = Math.floor(totalMins / 60) + 7
    const m = totalMins % 60
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`
  }

  function handleSlotClick(date: Date, hour: number, providerId?: number) {
    if (!showNewAppt) {
      setNewApptSlot({
        date: format(date, 'yyyy-MM-dd'),
        time: `${hour.toString().padStart(2,'0')}:00`,
        providerId: providerId ?? providers[0]?.provider_id,
      })
      setShowNewAppt(true)
    }
  }

  function handleDragStart(e: React.DragEvent, appt: any) {
    setDragAppt(appt)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e: React.DragEvent, date: string, rect: DOMRect) {
    e.preventDefault()
    if (!dragAppt) return
    const y = e.clientY - rect.top
    const time = timeFromY(y)
    moveMutation.mutate({ id: dragAppt.appointment_id, date, time })
    setDragAppt(null)
    setDragOver(null)
  }

  const displayProviders = filterProvider
    ? providers.filter((p: any) => p.provider_id === filterProvider)
    : providers

  return (
    <div className="flex flex-col h-full space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <div className="section-heading mb-0.5">Appointment Calendar</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Schedule</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-gold-500/20 rounded-sm overflow-hidden">
            {(['week','day'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors',
                  view === v ? 'bg-gold-500/15 text-gold-300' : 'text-slate-500 hover:text-gold-400')}>
                {v}
              </button>
            ))}
          </div>
          {/* Provider filter */}
          <select
            value={filterProvider ?? ''}
            onChange={e => setFilterProvider(e.target.value ? parseInt(e.target.value) : null)}
            className="hud-input text-xs w-44"
          >
            <option value="">All Providers</option>
            {providers.map((p: any) => (
              <option key={p.provider_id} value={p.provider_id}>
                Dr. {p.last_name} — {p.specialty}
              </option>
            ))}
          </select>
          {/* Week nav */}
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentDate(d => view === 'week' ? subWeeks(d, 1) : addDays(d, -1))}
              className="p-1.5 text-slate-500 hover:text-gold-400 transition-colors border border-gold-500/15 rounded-sm">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-xs font-mono text-slate-400 hover:text-gold-400 border border-gold-500/15 rounded-sm transition-colors">
              Today
            </button>
            <button onClick={() => setCurrentDate(d => view === 'week' ? addWeeks(d, 1) : addDays(d, 1))}
              className="p-1.5 text-slate-500 hover:text-gold-400 transition-colors border border-gold-500/15 rounded-sm">
              <ChevronRight size={14} />
            </button>
          </div>
          <button onClick={() => setShowNewAppt(true)} className="btn-primary text-xs py-1.5">
            <Plus size={13} />
            New Appointment
          </button>
        </div>
      </div>

      {/* Date header */}
      <div className="font-display text-sm text-gold-300 flex-shrink-0">
        {view === 'week'
          ? `${format(weekDays[0], 'MMMM d')} – ${format(weekDays[weekDays.length-1], 'MMMM d, yyyy')}`
          : format(currentDate, 'EEEE, MMMM d, yyyy')
        }
      </div>

      {/* Calendar grid */}
      <div className="hud-panel flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Day column headers */}
        <div className="flex border-b border-gold-500/10 flex-shrink-0"
          style={{ paddingLeft: '52px' }}>
          {weekDays.map(day => {
            const isToday = isSameDay(day, new Date())
            const dayAppts = appointments.filter((a: any) =>
              a.appointment_date === format(day, 'yyyy-MM-dd')
            )
            return (
              <div key={day.toISOString()}
                className={cn('flex-1 py-2.5 px-2 text-center border-r border-gold-500/10 last:border-r-0', isToday && 'bg-gold-500/5')}>
                <div className="font-mono text-[10px] text-slate-600 uppercase tracking-wider">{format(day,'EEE')}</div>
                <div className={cn('font-display font-bold text-xl mt-0.5', isToday ? 'text-gold-400' : 'text-slate-300')}>
                  {format(day,'d')}
                </div>
                {dayAppts.length > 0 && (
                  <div className="font-mono text-[9px] text-slate-600 mt-0.5">{dayAppts.length} appt{dayAppts.length > 1 ? 's' : ''}</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Scrollable time grid */}
        <div className="flex-1 overflow-y-auto" ref={calendarRef}>
          <div className="flex" style={{ minHeight: `${SLOT_HEIGHT * HOURS.length}px` }}>
            {/* Time gutter */}
            <div className="w-13 flex-shrink-0 relative" style={{ width: '52px' }}>
              {HOURS.map(h => (
                <div key={h} style={{ position: 'absolute', top: `${(h-7)*SLOT_HEIGHT}px`, width: '100%' }}
                  className="pr-2 text-right">
                  <span className="font-mono text-[10px] text-slate-600">
                    {h > 12 ? `${h-12}PM` : h === 12 ? '12PM' : `${h}AM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const isToday = isSameDay(day, new Date())
              const dayAppts = appointments.filter((a: any) => a.appointment_date === dateStr)

              return (
                <div key={dateStr}
                  className={cn('flex-1 border-r border-gold-500/5 last:border-r-0 relative',
                    isToday && 'bg-gold-500/3',
                    dragOver?.date === dateStr && 'bg-gold-500/8')}
                  style={{ minHeight: `${SLOT_HEIGHT * HOURS.length}px` }}
                  onDragOver={e => { e.preventDefault(); setDragOver({ date: dateStr, time: '' }) }}
                  onDrop={e => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    handleDrop(e, dateStr, rect)
                  }}
                >
                  {/* Hour grid lines */}
                  {HOURS.map(h => (
                    <div key={h}
                      style={{ position: 'absolute', top: `${(h-7)*SLOT_HEIGHT}px`, width: '100%', height: `${SLOT_HEIGHT}px` }}
                      className="border-t border-gold-500/5 hover:bg-gold-500/3 transition-colors cursor-pointer group"
                      onClick={() => handleSlotClick(day, h, filterProvider ?? undefined)}
                    >
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus size={12} className="text-gold-500/40" />
                      </div>
                      {/* 30-min line */}
                      <div className="absolute border-t border-gold-500/3 w-full" style={{ top: '50%' }} />
                    </div>
                  ))}

                  {/* Current time indicator */}
                  {isToday && (() => {
                    const now = new Date()
                    const top = ((now.getHours() - 7) + now.getMinutes()/60) * SLOT_HEIGHT
                    if (top < 0 || top > SLOT_HEIGHT * HOURS.length) return null
                    return (
                      <div style={{ position: 'absolute', top: `${top}px`, left: 0, right: 0, zIndex: 20 }}
                        className="flex items-center pointer-events-none">
                        <div className="w-2 h-2 rounded-full bg-gold-500 flex-shrink-0 -ml-1" />
                        <div className="flex-1 border-t border-gold-500 opacity-60" />
                      </div>
                    )
                  })()}

                  {/* Appointments */}
                  {dayAppts.map((appt: any) => {
                    if (!appt.appointment_time) return null
                    const top    = getApptTop(appt.appointment_time)
                    const height = getApptHeight(appt.duration_mins ?? 30)
                    const colors = STATUS_COLORS[appt.status] ?? STATUS_COLORS.scheduled
                    const apptType = apptTypes.find((t: any) => t.appt_type_id === appt.appt_type_id)

                    const risk = riskByAppt[appt.appointment_id]
                    const rb = risk ? NOSHOW_BADGE[risk.risk_label] : null
                    return (
                      <div key={appt.appointment_id}
                        draggable
                        onDragStart={e => handleDragStart(e, appt)}
                        title={risk ? `No-show risk: ${risk.risk_label} (${risk.risk_score}/10)\n${risk.recommendation}` : undefined}
                        style={{
                          position: 'absolute',
                          top: `${top}px`,
                          height: `${height}px`,
                          left: '2px', right: '2px',
                          zIndex: 10,
                          borderLeftColor: apptType?.color ?? '#c9a96e',
                        }}
                        className={cn('rounded-sm border border-l-2 px-1.5 py-1 cursor-grab active:cursor-grabbing overflow-hidden transition-all hover:z-20', colors)}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-body text-[11px] font-medium leading-tight truncate flex-1">
                            {appt.patient?.last_name}, {appt.patient?.first_name}
                          </div>
                          {rb && (
                            <span className={cn('flex-shrink-0 font-mono text-[8px] px-1 py-0.5 rounded border leading-none', rb.cls)}>
                              {rb.label}
                            </span>
                          )}
                        </div>
                        {height > 36 && (
                          <div className="font-mono text-[9px] opacity-70 truncate">{appt.appointment_type}</div>
                        )}
                        {height > 50 && (
                          <div className="font-mono text-[9px] opacity-50">{appt.appointment_time}</div>
                        )}
                        {height > 64 && risk?.recommendation && (
                          <div className="font-mono text-[8px] opacity-50 truncate mt-0.5 italic">{risk.recommendation}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="hud-panel px-4 py-2 flex items-center gap-4 flex-shrink-0">
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full border', colors.split(' ').slice(0,2).join(' '))} />
            <span className="font-mono text-[10px] text-slate-600 capitalize">{status.replace('_',' ')}</span>
          </div>
        ))}
        <div className="ml-auto font-mono text-[10px] text-slate-600">
          Drag appointments to reschedule · Click a slot to book
        </div>
      </div>

      {/* New Appointment Modal */}
      {showNewAppt && (
        <NewAppointmentModal
          slot={newApptSlot}
          providers={providers}
          apptTypes={apptTypes}
          onSave={data => newApptMutation.mutate(data)}
          onClose={() => { setShowNewAppt(false); setNewApptSlot(null) }}
          saving={newApptMutation.isPending}
        />
      )}
    </div>
  )
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function NewAppointmentModal({ slot, providers, apptTypes, onSave, onClose, saving }: any) {
  const [form, setForm] = useState({
    patient_id:       '',
    provider_id:      slot?.providerId ?? providers[0]?.provider_id ?? '',
    facility_id:      providers[0]?.facility_id ?? '',
    appointment_date: slot?.date ?? format(new Date(), 'yyyy-MM-dd'),
    appointment_time: slot?.time ?? '09:00',
    appt_type_id:     '',
    appointment_type: '',
    duration_mins:    30,
    status:           'scheduled',
    reason:           '',
  })

  // Smart schedule state
  const [aiSuggestions, setAiSuggestions]   = useState<any>(null)
  const [aiLoading, setAiLoading]           = useState(false)
  const [aiError, setAiError]               = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-search'],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('patient')
        .select('patient_id, first_name, last_name, birth')
        .eq('org_id', ORG_ID).eq('status', 'active').order('last_name').limit(100)
      return data ?? []
    },
  })

  function selectApptType(id: string) {
    const t = apptTypes.find((a: any) => a.appt_type_id === id)
    if (t) setForm(f => ({ ...f, appt_type_id: id, appointment_type: t.name, duration_mins: t.duration_mins }))
  }

  function selectProvider(id: string) {
    const p = providers.find((p: any) => p.provider_id === parseInt(id))
    setForm(f => ({ ...f, provider_id: parseInt(id), facility_id: p?.facility_id ?? '' }))
    // Reset AI suggestions when provider changes
    setAiSuggestions(null)
    setShowSuggestions(false)
  }

  // Call smart-schedule edge function
  async function fetchAiSuggestions() {
    if (!form.patient_id || !form.provider_id || !form.appt_type_id) {
      setAiError('Select patient, provider, and appointment type first')
      return
    }
    setAiLoading(true)
    setAiError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/smart-schedule`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          patient_id:     parseInt(form.patient_id),
          provider_id:    form.provider_id,
          appt_type_id:   form.appt_type_id,
          preferred_date: form.appointment_date,
          org_id:         ORG_ID,
        }),
      })
      const data = await res.json()
      setAiSuggestions(data)
      setShowSuggestions(true)
    } catch (e) {
      setAiError('Unable to load suggestions')
    } finally {
      setAiLoading(false)
    }
  }

  // Apply a suggested slot
  function applySlot(slot: any) {
    setForm(f => ({ ...f, appointment_date: slot.date, appointment_time: slot.time }))
    setShowSuggestions(false)
  }

  const canSuggest = !!form.patient_id && !!form.provider_id && !!form.appt_type_id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80">
      <div className="hud-panel w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gold-500/10 flex items-center justify-between">
          <div className="section-heading">New Appointment</div>
          <button onClick={onClose} className="btn-ghost text-xs">✕</button>
        </div>

        <div className="p-5 space-y-3">
          {/* Patient */}
          <div>
            <label className="data-label block mb-1.5">Patient *</label>
            <select value={form.patient_id}
              onChange={e => { setForm(f => ({...f, patient_id: e.target.value})); setAiSuggestions(null) }}
              className="hud-input">
              <option value="">Select patient...</option>
              {patients.map((p: any) => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.last_name}, {p.first_name}
                </option>
              ))}
            </select>
          </div>

          {/* Provider */}
          <div>
            <label className="data-label block mb-1.5">Provider *</label>
            <select value={form.provider_id} onChange={e => selectProvider(e.target.value)} className="hud-input">
              {providers.map((p: any) => (
                <option key={p.provider_id} value={p.provider_id}>
                  {p.first_name} {p.last_name}, {p.credential} — {p.specialty}
                </option>
              ))}
            </select>
          </div>

          {/* Appointment type */}
          <div>
            <label className="data-label block mb-1.5">Appointment Type *</label>
            <select value={form.appt_type_id}
              onChange={e => { selectApptType(e.target.value); setAiSuggestions(null) }}
              className="hud-input">
              <option value="">Select type...</option>
              {apptTypes.map((t: any) => (
                <option key={t.appt_type_id} value={t.appt_type_id}>
                  {t.name} ({t.duration_mins}min{t.primary_cpt_code ? ` · CPT ${t.primary_cpt_code}` : ''})
                </option>
              ))}
            </select>
          </div>

          {/* ── AI Smart Schedule ── */}
          <div className="hud-panel border-blue-500/20 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-sm">✦</span>
                <span className="font-mono text-xs text-blue-300">Smart Schedule</span>
                <span className="font-mono text-[10px] text-slate-600">AI-powered slot suggestions</span>
              </div>
              <button
                onClick={fetchAiSuggestions}
                disabled={!canSuggest || aiLoading}
                className={cn(
                  'btn-secondary text-xs py-1 px-3 transition-colors',
                  canSuggest ? 'text-blue-400 border-blue-500/30 hover:border-blue-500/50' : 'opacity-40'
                )}>
                {aiLoading
                  ? <><Loader size={11} className="animate-spin" /> Analyzing...</>
                  : '✦ Suggest slots'
                }
              </button>
            </div>

            {aiError && (
              <div className="font-mono text-[10px] text-amber-400">{aiError}</div>
            )}

            {/* Suggested slots */}
            {showSuggestions && aiSuggestions?.suggested_slots?.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="data-label">Recommended slots (ranked by score)</div>
                {aiSuggestions.suggested_slots.map((s: any, i: number) => (
                  <button key={i} onClick={() => applySlot(s)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-2 rounded-sm border text-left transition-colors',
                      i === 0
                        ? 'border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/15'
                        : 'border-gold-500/15 hover:border-gold-500/25 hover:bg-gold-500/5'
                    )}>
                    <div className="flex-shrink-0 text-center">
                      <div className={cn('font-display font-bold text-lg leading-none',
                        i === 0 ? 'text-blue-400' : 'text-gold-400')}>{s.score}</div>
                      <div className="font-mono text-[8px] text-slate-600">score</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-200 font-medium">
                          {new Date(s.date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
                        </span>
                        <span className="font-mono text-xs text-gold-400">{s.time}</span>
                        {i === 0 && <span className="badge bg-blue-500/20 text-blue-400 border-blue-500/30 text-[9px]">Best</span>}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 mt-0.5 leading-snug">{s.reason}</div>
                    </div>
                    <div className="font-mono text-[10px] text-blue-400 flex-shrink-0">← Use</div>
                  </button>
                ))}
              </div>
            )}

            {/* Conflicts */}
            {showSuggestions && aiSuggestions?.conflicts?.length > 0 && (
              <div className="px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-sm">
                <div className="data-label text-amber-400 mb-1">Conflicts detected</div>
                {aiSuggestions.conflicts.map((c: string, i: number) => (
                  <div key={i} className="font-mono text-[10px] text-amber-300">⚠ {c}</div>
                ))}
              </div>
            )}

            {/* Insurance notes */}
            {showSuggestions && aiSuggestions?.insurance_notes && (
              <div className="font-mono text-[10px] text-slate-500 flex items-start gap-1.5">
                <span className="text-gold-500/60 flex-shrink-0">♦</span>
                {aiSuggestions.insurance_notes}
              </div>
            )}

            {/* No-show recommendation */}
            {showSuggestions && aiSuggestions?.noshow_recommendation && (
              <div className="font-mono text-[10px] text-orange-400 flex items-start gap-1.5">
                <span className="flex-shrink-0">⚠</span>
                {aiSuggestions.noshow_recommendation}
              </div>
            )}

            {!canSuggest && (
              <div className="font-mono text-[10px] text-slate-600">
                Select patient, provider, and type to enable AI suggestions
              </div>
            )}
          </div>

          {/* Date + Time — manual override */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="data-label block mb-1.5">Date *</label>
              <input type="date" value={form.appointment_date}
                onChange={e => setForm(f => ({...f, appointment_date: e.target.value}))}
                className="hud-input" />
            </div>
            <div>
              <label className="data-label block mb-1.5">Time *</label>
              <input type="time" value={form.appointment_time}
                onChange={e => setForm(f => ({...f, appointment_time: e.target.value}))}
                className="hud-input" />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="data-label block mb-1.5">Reason / Chief Complaint</label>
            <input value={form.reason}
              onChange={e => setForm(f => ({...f, reason: e.target.value}))}
              className="hud-input" placeholder="Reason for visit" />
          </div>

          {/* What happens on save */}
          <div className="px-3 py-2 bg-navy-700/30 rounded-sm space-y-0.5">
            <div className="data-label mb-1">On save, automatically:</div>
            {[
              '✦  Score no-show risk (Claude AI)',
              '✉  Send confirmation email (Resend)',
              '💬  Send confirmation SMS (Twilio)',
              '⏰  Send intake link 48h before visit',
              '🔔  Send 24h + 2h reminder',
            ].map(item => (
              <div key={item} className="font-mono text-[10px] text-slate-500">{item}</div>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gold-500/10 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.patient_id || !form.appt_type_id}
            className="btn-primary text-xs">
            {saving
              ? <><Loader size={12} className="animate-spin" /> Booking...</>
              : 'Book Appointment'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
