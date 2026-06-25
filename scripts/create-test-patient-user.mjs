/**
 * Creates a Supabase Auth user for the test patient (patient 16 — "TEST — Self Chart")
 * and inserts the cr.patient_account mapping so Companion's self-chart resolves under
 * a patient session.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/create-test-patient-user.mjs
 *
 * The service role key is only for this script — never committed, never in a client bundle.
 * Get it from the Supabase dashboard → Project Settings → API → service_role key.
 *
 * cr.patient_account.auth_user_id is NOT NULL, so the auth user is created first.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const PATIENT_ID = 16
const ORG_ID     = '77f1c9da-194c-4a73-ab59-49a318242840'
const EMAIL      = 'selfchart.test@patienttrac.com'
const PASSWORD   = 'TestPatient16!'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Step 1 — Create auth user
console.log(`Creating auth user: ${EMAIL}`)
const { data: created, error: authErr } = await admin.auth.admin.createUser({
  email:         EMAIL,
  password:      PASSWORD,
  email_confirm: true,  // immediately loginable, no email flow needed for test fixture
})

if (authErr) {
  // If user already exists, fetch it instead of failing
  if (authErr.message?.includes('already been registered')) {
    console.warn('User already exists — fetching existing UID...')
    const { data: list, error: listErr } = await admin.auth.admin.listUsers()
    if (listErr) { console.error('Failed to list users:', listErr.message); process.exit(1) }
    const existing = list.users.find(u => u.email === EMAIL)
    if (!existing) { console.error('Could not locate existing user.'); process.exit(1) }
    console.log(`Existing auth user UID: ${existing.id}`)
    await insertMapping(existing.id)
  } else {
    console.error('Failed to create auth user:', authErr.message)
    process.exit(1)
  }
} else {
  const uid = created.user.id
  console.log(`Auth user created. UID: ${uid}`)
  await insertMapping(uid)
}

async function insertMapping(authUserId) {
  // Step 2 — Insert patient_account row (upsert so re-runs are safe)
  console.log(`Inserting cr.patient_account mapping for patient ${PATIENT_ID}...`)
  const { error: insertErr } = await admin
    .schema('cr')
    .from('patient_account')
    .upsert(
      { patient_id: PATIENT_ID, org_id: ORG_ID, auth_user_id: authUserId, email: EMAIL, status: 'active' },
      { onConflict: 'auth_user_id' }
    )

  if (insertErr) {
    console.error('Failed to insert patient_account row:', insertErr.message)
    process.exit(1)
  }

  console.log('\nDone.')
  console.log(`  patient_id:   ${PATIENT_ID}`)
  console.log(`  auth_user_id: ${authUserId}`)
  console.log(`  email:        ${EMAIL}`)
  console.log(`  password:     ${PASSWORD}`)
  console.log('\nLog into Companion as this user to verify the self-chart populates.')
  console.log('Lab trends (CEA 4.2→4.33) confirm lab_results_patient_select RLS is working.')
}
