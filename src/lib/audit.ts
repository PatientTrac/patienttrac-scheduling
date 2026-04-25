// PatientTrac Shared Audit + EHI Library
// Drop into: src/lib/audit.ts  (all three apps)
// Covers: §170.315(d)(2) Full PHI Audit Logging
//         §170.315(b)(10) EHI Export
//         §170.315(d)(3) Audit Report

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ||
  'https://mskormozwekezjmtcylv.supabase.co'

const INTERCEPTOR = `${SUPABASE_URL}/functions/v1/phi-audit-interceptor`
const EHI_EXPORT  = `${SUPABASE_URL}/functions/v1/ehi-export`
const AUDIT_LOG   = `${SUPABASE_URL}/functions/v1/phi-audit-log`

// ── Session context (set once on app load) ───────────────────
let _ctx: AuditContext | null = null

export interface AuditContext {
  org_id: string
  user_id?: string
  user_email?: string
  user_role?: string
  session_id?: string
  app_source: 'scheduling' | 'mind' | 'revela' | 'profiler'
}

export function initAudit(ctx: AuditContext) {
  _ctx = ctx
}

function getCtx(): AuditContext {
  if (!_ctx) throw new Error('Audit not initialized — call initAudit() on app load')
  return _ctx
}

async function post(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ── §170.315(d)(2) PHI Access Logging ───────────────────────

/** Call when any patient record is viewed */
export async function auditView(
  table: string,
  recordId: string | number,
  patientId?: string | number,
  encounterId?: string | number
) {
  const ctx = getCtx()
  return post(INTERCEPTOR, {
    action: 'log_access',
    ...ctx,
    table_name: table,
    record_id: String(recordId),
    patient_id: patientId ? String(patientId) : undefined,
    encounter_id: encounterId ? String(encounterId) : undefined,
    ip_address: await getIP(),
  })
}

/** Call when any PHI record is created or updated */
export async function auditWrite(
  table: string,
  recordId: string | number,
  fieldsChanged: string[],
  patientId?: string | number,
  encounterId?: string | number
) {
  const ctx = getCtx()
  return post(INTERCEPTOR, {
    action: 'log_write',
    ...ctx,
    table_name: table,
    record_id: String(recordId),
    fields_changed: fieldsChanged,
    patient_id: patientId ? String(patientId) : undefined,
    encounter_id: encounterId ? String(encounterId) : undefined,
    ip_address: await getIP(),
  })
}

/** Call when any PHI record is deleted */
export async function auditDelete(
  table: string,
  recordId: string | number,
  patientId?: string | number
) {
  const ctx = getCtx()
  return post(INTERCEPTOR, {
    action: 'log_delete',
    ...ctx,
    table_name: table,
    record_id: String(recordId),
    patient_id: patientId ? String(patientId) : undefined,
    ip_address: await getIP(),
  })
}

/** Call when any PHI is exported/downloaded */
export async function auditExport(
  table: string,
  recordId: string | number,
  exportFormat: string,
  destination: string,
  patientId?: string | number
) {
  const ctx = getCtx()
  return post(INTERCEPTOR, {
    action: 'log_export',
    ...ctx,
    table_name: table,
    record_id: String(recordId),
    export_format: exportFormat,
    destination,
    patient_id: patientId ? String(patientId) : undefined,
    ip_address: await getIP(),
  })
}

/** Call when a clinical note is signed */
export async function auditNoteSigned(
  table: string,
  recordId: string | number,
  patientId?: string | number,
  encounterId?: string | number
) {
  const ctx = getCtx()
  return post(INTERCEPTOR, {
    action: 'log_note_signed',
    ...ctx,
    table_name: table,
    record_id: String(recordId),
    patient_id: patientId ? String(patientId) : undefined,
    encounter_id: encounterId ? String(encounterId) : undefined,
  })
}

/** Call on every login attempt */
export async function auditLogin(
  userEmail: string,
  success: boolean,
  mfaUsed = false,
  failureReason?: string
) {
  const ctx = getCtx()
  return post(INTERCEPTOR, {
    action: 'log_login',
    ...ctx,
    user_email: userEmail,
    success,
    mfa_used: mfaUsed,
    failure_reason: failureReason,
    ip_address: await getIP(),
  })
}

/** Call on MFA attempt */
export async function auditMFA(success: boolean, method = 'totp') {
  const ctx = getCtx()
  return post(INTERCEPTOR, {
    action: 'log_mfa',
    ...ctx,
    success,
    method,
    ip_address: await getIP(),
  })
}

/** Call when records are released to third party */
export async function auditRecordsReleased(opts: {
  recordType: string
  destination: string
  deliveryMethod: string
  requestorType: string
  patientId?: string | number
}) {
  const ctx = getCtx()
  return post(INTERCEPTOR, {
    action: 'log_records_released',
    ...ctx,
    record_type: opts.recordType,
    destination: opts.destination,
    delivery_method: opts.deliveryMethod,
    requestor_type: opts.requestorType,
    patient_id: opts.patientId ? String(opts.patientId) : undefined,
  })
}

/** §170.315(d)(6) — Emergency break-glass access */
export async function auditEmergencyAccess(
  reason: string,
  emergencyType: 'patient_emergency' | 'system_outage' | 'authorized_override',
  patientId?: string | number
) {
  const ctx = getCtx()
  return post(INTERCEPTOR, {
    action: 'log_emergency',
    ...ctx,
    reason,
    emergency_type: emergencyType,
    patient_id: patientId ? String(patientId) : undefined,
    ip_address: await getIP(),
  })
}

// ── §170.315(b)(10) EHI Export ───────────────────────────────

/** Export full patient record as FHIR NDJSON — §170.315(b)(10) */
export async function exportPatientEHI(
  patientId: string | number,
  orgId: string,
  format: 'fhir_ndjson' | 'fhir_bundle' = 'fhir_ndjson'
): Promise<EHIExportResult> {
  const ctx = getCtx()
  const result = await post(EHI_EXPORT, {
    action: 'export_patient',
    patient_id: String(patientId),
    org_id: orgId,
    format,
    initiated_by: ctx.user_email || ctx.app_source,
  })
  return result as EHIExportResult
}

/** Download patient EHI as a zip of NDJSON files */
export async function downloadPatientEHI(
  patientId: string | number,
  orgId: string,
  patientName: string
) {
  const result = await exportPatientEHI(patientId, orgId, 'fhir_ndjson')
  if (!result.success || !result.files) throw new Error(result.error || 'Export failed')

  // Audit the download
  await auditExport('patient', String(patientId), 'fhir_ndjson', 'download', patientId)

  // Build combined NDJSON string
  const allLines: string[] = []
  for (const [type, ndjson] of Object.entries(result.files)) {
    allLines.push(`// === ${type} ===`)
    allLines.push(ndjson)
  }

  const blob = new Blob([allLines.join('\n')], { type: 'application/fhir+ndjson' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${patientName.replace(/\s+/g, '-')}-health-record-${new Date().toISOString().split('T')[0]}.ndjson`
  a.click()
  URL.revokeObjectURL(url)

  return result
}

/** Export as FHIR Bundle JSON and download */
export async function downloadPatientFHIRBundle(
  patientId: string | number,
  orgId: string,
  patientName: string
) {
  const result = await exportPatientEHI(patientId, orgId, 'fhir_bundle')
  if (!result.success || !result.bundle) throw new Error(result.error || 'Export failed')

  await auditExport('patient', String(patientId), 'fhir_bundle', 'download', patientId)

  const blob = new Blob([JSON.stringify(result.bundle, null, 2)], { type: 'application/fhir+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${patientName.replace(/\s+/g, '-')}-fhir-bundle-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)

  return result
}

/** Get org-wide export manifest — for whole-system EHI export */
export async function getOrgExportManifest(orgId: string) {
  return post(EHI_EXPORT, { action: 'export_org', org_id: orgId })
}

// ── §170.315(d)(3) Audit Report ──────────────────────────────

export async function getAuditLog(opts: {
  orgId: string
  eventType?: string
  userEmail?: string
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}) {
  return post(EHI_EXPORT, {
    action: 'get_audit_log',
    org_id: opts.orgId,
    event_type: opts.eventType,
    user_email: opts.userEmail,
    from_date: opts.fromDate,
    to_date: opts.toDate,
    limit: opts.limit || 100,
    offset: opts.offset || 0,
  })
}

/** Verify hash chain integrity — detect tampering */
export async function verifyAuditChain(orgId: string): Promise<ChainVerifyResult> {
  const result = await post(EHI_EXPORT, { action: 'verify_chain', org_id: orgId })
  return result as ChainVerifyResult
}

// ── Helpers ───────────────────────────────────────────────────

async function getIP(): Promise<string | undefined> {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    const { ip } = await res.json()
    return ip
  } catch { return undefined }
}

// ── Types ────────────────────────────────────────────────────

export interface EHIExportResult {
  success: boolean
  format: string
  patient_id?: string
  patient_name?: string
  exported_at?: string
  total_resources?: number
  resource_counts?: Record<string, number>
  files?: Record<string, string>   // type → NDJSON string
  bundle?: Record<string, unknown> // FHIR Bundle
  error?: string
}

export interface ChainVerifyResult {
  success: boolean
  chain_intact: boolean
  records_verified: number
  broken_at: number | null
  message: string
}
