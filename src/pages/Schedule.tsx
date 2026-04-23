import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'

const hours = Array.from({ length: 12 }, (_, i) => i + 7) // 7am - 6pm

export function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="space-y-5 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="section-heading mb-1">Appointment Calendar</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Schedule</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(d => addDays(d, -7))}
              className="p-1.5 text-slate-500 hover:text-gold-400 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-display text-sm text-slate-300 px-2 min-w-36 text-center">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 4), 'MMM d, yyyy')}
            </span>
            <button
              onClick={() => setCurrentDate(d => addDays(d, 7))}
              className="p-1.5 text-slate-500 hover:text-gold-400 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="btn-ghost text-xs"
          >
            Today
          </button>
          <button className="btn-primary text-xs py-1.5">
            <Plus size={13} />
            New Appointment
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="hud-panel flex-1 overflow-hidden flex flex-col">
        {/* Day headers */}
        <div className="grid border-b border-gold-500/10" style={{ gridTemplateColumns: '60px repeat(5, 1fr)' }}>
          <div className="py-3 px-2 border-r border-gold-500/10" />
          {weekDays.map((day) => {
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            return (
              <div key={day.toISOString()} className={`py-3 px-3 text-center border-r border-gold-500/10 last:border-r-0 ${isToday ? 'bg-gold-500/5' : ''}`}>
                <div className="font-mono text-[10px] text-slate-600 uppercase tracking-wider">
                  {format(day, 'EEE')}
                </div>
                <div className={`font-display font-bold text-lg mt-0.5 ${isToday ? 'text-gold-400' : 'text-slate-300'}`}>
                  {format(day, 'd')}
                </div>
              </div>
            )
          })}
        </div>

        {/* Time slots */}
        <div className="flex-1 overflow-y-auto">
          {hours.map((hour) => (
            <div
              key={hour}
              className="grid border-b border-gold-500/5 hover:bg-gold-500/1 transition-colors"
              style={{ gridTemplateColumns: '60px repeat(5, 1fr)', minHeight: '56px' }}
            >
              <div className="px-2 py-1.5 border-r border-gold-500/10 flex-shrink-0">
                <span className="font-mono text-[10px] text-slate-600">
                  {hour > 12 ? `${hour - 12}PM` : hour === 12 ? '12PM' : `${hour}AM`}
                </span>
              </div>
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className="border-r border-gold-500/5 last:border-r-0 px-1 py-1 cursor-pointer hover:bg-gold-500/3 transition-colors"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="hud-panel px-4 py-2 flex items-center gap-3">
        <CalendarDays size={12} className="text-gold-500/50" />
        <span className="font-mono text-[10px] text-slate-600">
          Drag-and-drop scheduling · Multi-provider view · Full calendar coming Sprint 2
        </span>
      </div>
    </div>
  )
}
