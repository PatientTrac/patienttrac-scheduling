import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from '@/pages/Dashboard'
import { Patients } from '@/pages/Patients'
import { PatientDetail } from '@/pages/PatientDetail'
import { NewPatient } from '@/pages/NewPatient'
import { NewProvider } from '@/pages/NewProvider'
import { NewFacility } from '@/pages/NewFacility'
import { Schedule } from '@/pages/Schedule'
import { Billing } from '@/pages/Billing'
import { Insurance } from '@/pages/Insurance'
import { Encounters } from '@/pages/Encounters'
import { Settings } from '@/pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"               element={<Dashboard />} />
            <Route path="patients"                element={<Patients />} />
            <Route path="patients/new"            element={<NewPatient />} />
            <Route path="patients/:patientId"     element={<PatientDetail />} />
            <Route path="providers/new"           element={<NewProvider />} />
            <Route path="facilities/new"          element={<NewFacility />} />
            <Route path="schedule"                element={<Schedule />} />
            <Route path="encounters"              element={<Encounters />} />
            <Route path="billing"                 element={<Billing />} />
            <Route path="insurance"               element={<Insurance />} />
            <Route path="settings"                element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
