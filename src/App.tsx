import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth'

// Main app
import { AppShell }    from '@/components/layout/AppShell'
import { Dashboard }   from '@/pages/Dashboard'
import { Patients }    from '@/pages/Patients'
import { PatientDetail } from '@/pages/PatientDetail'
import { NewPatient }  from '@/pages/NewPatient'
import { NewProvider } from '@/pages/NewProvider'
import { NewFacility } from '@/pages/NewFacility'
import { Schedule }    from '@/pages/Schedule'
import { Billing }     from '@/pages/Billing'
import { Insurance }   from '@/pages/Insurance'
import { Encounters }  from '@/pages/Encounters'
import { Settings }    from '@/pages/Settings'

// Admin portal
import { AdminLogin }       from '@/admin/pages/AdminLogin'
import { AdminShell }       from '@/admin/components/AdminShell'
import { AdminOverview }    from '@/admin/pages/AdminOverview'
import { UserManagement }   from '@/admin/pages/UserManagement'
import { AppointmentTypes } from '@/admin/pages/AppointmentTypes'
import { AdminFacilities, AdminRoles, AdminAudit, AdminSettings } from '@/admin/pages/AdminStubs'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* ── Main scheduling app ── */}
            <Route path="/" element={<AppShell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"           element={<Dashboard />} />
              <Route path="patients"            element={<Patients />} />
              <Route path="patients/new"        element={<NewPatient />} />
              <Route path="patients/:patientId" element={<PatientDetail />} />
              <Route path="providers/new"       element={<NewProvider />} />
              <Route path="facilities/new"      element={<NewFacility />} />
              <Route path="schedule"            element={<Schedule />} />
              <Route path="encounters"          element={<Encounters />} />
              <Route path="billing"             element={<Billing />} />
              <Route path="insurance"           element={<Insurance />} />
              <Route path="settings"            element={<Settings />} />
            </Route>

            {/* ── Admin portal ── */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminShell />}>
              <Route index           element={<AdminOverview />} />
              <Route path="users"      element={<UserManagement />} />
              <Route path="facilities" element={<AdminFacilities />} />
              <Route path="appt-types" element={<AppointmentTypes />} />
              <Route path="roles"      element={<AdminRoles />} />
              <Route path="audit"      element={<AdminAudit />} />
              <Route path="settings"   element={<AdminSettings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
