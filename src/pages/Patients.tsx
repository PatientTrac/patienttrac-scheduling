import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, UserPlus, Filter, Download } from 'lucide-react'
import { supabase, type PatientRow } from '@/lib/supabase'
import { formatDate, calculateAge, cn } from '@/lib/utils'

async function fetchPatients() {
  const { data, error } = await supabase
    .schema('cr')
    .from('patient')
    .select('*')
    .order('last_name', { ascending: true })
    .limit(100)
  if (error) throw error
  return data as PatientRow[]
}

export function Patients() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data: patients = [], isLoading, error } = useQuery({
    queryKey: ['patients'],
    queryFn: fetchPatients,
  })

  const filtered = patients.filter((p) =>
    `${p.first_name} ${p.last_name} ${p.email ?? ''} ${p.phone_mobile ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="section-heading mb-1">Patient Registry</div>
          <h1 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Patients</h1>
        </div>
        <button onClick={() => navigate('/patients/new')} className="btn-primary">
          <UserPlus size={14} />
          Register Patient
        </button>
      </div>

      {/* Toolbar */}
      <div className="hud-panel px-4 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="hud-input pl-8 text-xs"
          />
        </div>
        <button className="btn-ghost">
          <Filter size={13} />
          Filter
        </button>
        <button className="btn-ghost">
          <Download size={13} />
          Export
        </button>
        <div className="ml-auto font-mono text-xs text-slate-600">
          {filtered.length} patients
        </div>
      </div>

      {/* Table */}
      <div className="hud-panel overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="w-4 h-4 border border-gold-500/40 border-t-gold-500 rounded-full animate-spin" />
              <span className="font-mono text-xs">Loading patients...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="font-mono text-xs text-red-400 mb-1">Failed to load patients</div>
              <div className="font-mono text-[10px] text-slate-600">{String(error)}</div>
            </div>
          </div>
        )}
        {!isLoading && !error && (
          <table className="hud-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>DOB / Age</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Registered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-600 font-mono text-xs">
                    {search ? 'No patients match your search.' : 'No patients registered yet.'}
                  </td>
                </tr>
              )}
              {filtered.map((patient) => (
                <tr key={patient.patient_id} onClick={() => navigate(`/patients/${patient.patient_id}`)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-sm bg-navy-700 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="font-mono text-[10px] text-gold-400">
                          {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-body text-sm text-slate-200">
                          {patient.last_name}, {patient.first_name}
                        </div>
                        <div className="font-mono text-[10px] text-slate-600">
                          #{patient.patient_id.slice(0, 8).toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="font-body text-sm">{formatDate(patient.date_of_birth)}</div>
                    <div className="font-mono text-[10px] text-slate-600">
                      Age {calculateAge(patient.date_of_birth)}
                    </div>
                  </td>
                  <td>
                    <div className="text-sm">{patient.email ?? '—'}</div>
                    <div className="font-mono text-[10px] text-slate-600">{patient.phone_mobile ?? '—'}</div>
                  </td>
                  <td>
                    <span className={cn(
                      'badge',
                      patient.status === 'active' ? 'badge-active' :
                      patient.status === 'inactive' ? 'badge-inactive' : 'badge-urgent'
                    )}>
                      {patient.status}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-slate-500">
                      {formatDate(patient.created_at)}
                    </span>
                  </td>
                  <td>
                    <button className="font-mono text-[10px] text-slate-600 hover:text-gold-400 transition-colors">
                      VIEW →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
