import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export type Database = {
  cr: {
    Tables: {
      patient: { Row: PatientRow; Insert: PatientInsert; Update: PatientUpdate }
      encounter: { Row: EncounterRow; Insert: EncounterInsert; Update: EncounterUpdate }
      appointments: { Row: AppointmentRow; Insert: AppointmentInsert; Update: AppointmentUpdate }
      patient_insurance: { Row: PatientInsuranceRow }
      patient_invoice: { Row: PatientInvoiceRow }
      patient_payments: { Row: PatientPaymentRow }
      providers: { Row: ProviderRow }
      facilities: { Row: FacilityRow }
    }
  }
}

// Patient
export interface PatientRow {
  patient_id: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string | null
  email: string | null
  phone_mobile: string | null
  phone_home: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  ssn_last4: string | null
  photo_url: string | null
  status: 'active' | 'inactive' | 'deceased'
  created_at: string
  updated_at: string
}
export type PatientInsert = Omit<PatientRow, 'patient_id' | 'created_at' | 'updated_at'>
export type PatientUpdate = Partial<PatientInsert>

// Encounter
export interface EncounterRow {
  encounter_id: string
  patient_id: string
  appointment_id: string | null
  provider_id: string | null
  facility_id: string | null
  encounter_date: string
  encounter_type: string
  chief_complaint: string | null
  status: 'open' | 'closed' | 'billed' | 'cancelled'
  created_at: string
  updated_at: string
}
export type EncounterInsert = Omit<EncounterRow, 'encounter_id' | 'created_at' | 'updated_at'>
export type EncounterUpdate = Partial<EncounterInsert>

// Appointment
export interface AppointmentRow {
  appointment_id: string
  patient_id: string
  provider_id: string
  facility_id: string | null
  appointment_date: string
  start_time: string
  end_time: string
  appointment_type: string
  status: 'scheduled' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null
  created_at: string
  updated_at: string
}
export type AppointmentInsert = Omit<AppointmentRow, 'appointment_id' | 'created_at' | 'updated_at'>
export type AppointmentUpdate = Partial<AppointmentInsert>

// Insurance
export interface PatientInsuranceRow {
  insurance_id: string
  patient_id: string
  insurance_type: 'primary' | 'secondary' | 'tertiary'
  payer_name: string
  plan_name: string | null
  member_id: string
  group_number: string | null
  subscriber_name: string | null
  subscriber_dob: string | null
  relationship_to_subscriber: string | null
  effective_date: string | null
  termination_date: string | null
  copay_amount: number | null
  deductible_amount: number | null
  eligibility_verified_at: string | null
  created_at: string
}

// Invoice
export interface PatientInvoiceRow {
  invoice_id: string
  patient_id: string
  encounter_id: string | null
  invoice_date: string
  due_date: string | null
  total_charges: number
  insurance_paid: number
  patient_balance: number
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'collections'
  created_at: string
}

// Payment
export interface PatientPaymentRow {
  payment_id: string
  patient_id: string
  invoice_id: string | null
  payment_date: string
  amount: number
  payment_method: 'cash' | 'check' | 'credit_card' | 'ach' | 'insurance'
  reference_number: string | null
  created_at: string
}

// Provider
export interface ProviderRow {
  provider_id: string
  first_name: string
  last_name: string
  credential: string | null
  specialty: string | null
  npi: string | null
  facility_id: string | null
  status: 'active' | 'inactive'
}

// Facility
export interface FacilityRow {
  facility_id: string
  facility_name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  npi: string | null
}
