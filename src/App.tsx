import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import { auditLogin } from './lib/audit'

// ── Layouts ───────────────────────────────────────────────────
import { AppShell } from './components/layout/AppShell'
import { AdminShell } from './components/layout/AdminShell'

// ── Main App Pages ────────────────────────────────────────────
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import NewPatient from './pages/NewPatient'
import PatientDetail from './pages/PatientDetail'
import Schedule from './pages/Schedule'
import CheckIn from './pages/CheckIn'
import Encounters from './pages/Encounters'
import Billing from './pages/Billing'
import Insurance from './pages/Insurance'
import Settings from './pages/Settings'
import NewProvider from './pages/NewProvider'
import NewFacility from './pages/NewFacility'
import Intake from './pages/Intake'

// ── Admin Pages ───────────────────────────────────────────────
import AdminLogin from './pages/admin/AdminLogin'
import MfaSetup from './pages/admin/MfaSetup'
import AdminOverview from './pages/admin/AdminOverview'
import UserManagement from './pages/admin/UserManagement'
import AdminFacilities from './pages/admin/AdminFacilities'
import AppointmentTypes from './pages/admin/AppointmentTypes'
import AdminRoles from './pages/admin/AdminRoles'
import AdminSettings from './pages/admin/AdminSettings'

// ── §170.315(d)(3) Audit Report ───────────────────────────────
import AuditReport from './components/admin/AuditReport'

// ── §170.315(b)(10) EHI Export page ──────────────────────────
import EHIExport from './pages/EHIExport'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
})

export default function App() {
  // §170.315(d)(2) — wire login audit to Supabase auth events
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        auditLogin(session.user.email || '', true, true) // mfa_used=true (TOTP enforced)
      }
      if (event === 'SIGNED_OUT') {
        // log_access with event_type logout handled by auth listener in main.tsx
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>

          {/* ── Patient-facing (no auth) ── */}
          <Route path="/intake" element={<Intake />} />

          {/* ── Main clinical app ── */}
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="patients" element={<Patients />} />
            <Route path="patients/new" element={<NewPatient />} />
            <Route path="patients/:patientId" element={<PatientDetail />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="schedule/checkin/:id" element={<CheckIn />} />
            <Route path="encounters" element={<Encounters />} />
            <Route path="billing" element={<Billing />} />
            <Route path="insurance" element={<Insurance />} />
            <Route path="settings" element={<Settings />} />
            <Route path="providers/new" element={<NewProvider />} />
            <Route path="facilities/new" element={<NewFacility />} />
            {/* §170.315(b)(10) EHI Export */}
            <Route path="ehi-export" element={<EHIExport />} />
          </Route>

          {/* ── Admin portal ── */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/mfa-setup" element={<MfaSetup />} />
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="facilities" element={<AdminFacilities />} />
            <Route path="appt-types" element={<AppointmentTypes />} />
            <Route path="roles" element={<AdminRoles />} />
            {/* §170.315(d)(3) Audit Report — replaces stub */}
            <Route path="audit" element={<AuditReport />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
