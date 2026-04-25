// §170.315(b)(10) — EHI Export Page
// Route: /ehi-export
// Available to: admin, super_admin, provider (for their patients)
// Penalty: $1M per violation under 21st Century Cures Act

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  downloadPatientEHI,
  downloadPatientFHIRBundle,
  getOrgExportManifest,
  verifyAuditChain,
  type EHIExportResult,
  type ChainVerifyResult,
} from '../lib/audit'

export default function EHIExport() {
  const [selectedPatient, setSelectedPatient] = useState<string>('')
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<EHIExportResult | null>(null)
  const [chainResult, setChainResult] = useState<ChainVerifyResult | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [orgManifest, setOrgManifest] = useState<Record<string, unknown> | null>(null)

  const DEV_ORG = '00000000-0000-0000-0000-000000000001'

  // Load patients for picker
  const { data: patients } = useQuery({
    queryKey: ['patients-ehi'],
    queryFn: async () => {
      const { data } = await supabase
        .from('patient')
        .select('patient_id, first_name, last_name, date_of_birth')
        .order('last_name')
        .limit(100)
      return data || []
    },
  })

  const selectedPatientName = patients?.find(
    p => String(p.patient_id) === selectedPatient
  )
  const fullName = selectedPatientName
    ? `${selectedPatientName.first_name} ${selectedPatientName.last_name}`
    : ''

  const handleExportNDJSON = async () => {
    if (!selectedPatient || !fullName) return
    setExporting(true)
    setExportResult(null)
    try {
      const result = await downloadPatientEHI(selectedPatient, DEV_ORG, fullName)
      setExportResult(result)
    } catch (e) {
      console.error(e)
    } finally {
      setExporting(false)
    }
  }

  const handleExportBundle = async () => {
    if (!selectedPatient || !fullName) return
    setExporting(true)
    setExportResult(null)
    try {
      const result = await downloadPatientFHIRBundle(selectedPatient, DEV_ORG, fullName)
      setExportResult(result)
    } catch (e) {
      console.error(e)
    } finally {
      setExporting(false)
    }
  }

  const handleOrgManifest = async () => {
    setExporting(true)
    try {
      const result = await getOrgExportManifest(DEV_ORG)
      setOrgManifest(result)
    } catch (e) {
      console.error(e)
    } finally {
      setExporting(false)
    }
  }

  const handleVerifyChain = async () => {
    setVerifying(true)
    setChainResult(null)
    try {
      const result = await verifyAuditChain(DEV_ORG)
      setChainResult(result)
    } catch (e) {
      console.error(e)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fadeIn">

      {/* Header */}
      <div>
        <div className="hud-title text-xl mb-1" style={{ color: '#c9a96e' }}>
          EHI Export — Electronic Health Information
        </div>
        <div className="hud-label">
          §170.315(b)(10) · 21st Century Cures Act · Penalty: $1M per violation
        </div>
      </div>

      {/* Compliance notice */}
      <div className="p-4 rounded" style={{ background: 'rgba(255,59,59,0.06)', border: '1px solid rgba(255,59,59,0.3)' }}>
        <div className="flex items-start gap-3">
          <span className="text-lg flex-shrink-0">⚖️</span>
          <div className="text-sm leading-relaxed" style={{ color: 'rgba(200,215,235,0.85)' }}>
            <strong style={{ color: '#ff3b3b' }}>Information Blocking Prohibition</strong> — Under 45 CFR §171, 
            failure to provide patients or providers timely access to Electronic Health Information (EHI) 
            constitutes information blocking. Penalties up to $1,000,000 per violation. 
            EHI export must be fulfilled within <strong>4 business hours</strong> of request.
          </div>
        </div>
      </div>

      {/* Single patient export */}
      <div className="hud-card p-5 space-y-4">
        <div className="hud-label text-sm" style={{ color: '#00d4ff' }}>
          Single Patient Export — USCDI v3 All Data Elements
        </div>

        <div>
          <div className="hud-label mb-2">Select Patient</div>
          <select
            className="select-hud w-full rounded px-3 py-2 text-sm"
            value={selectedPatient}
            onChange={e => { setSelectedPatient(e.target.value); setExportResult(null) }}
          >
            <option value="">— Select patient —</option>
            {(patients || []).map(p => (
              <option key={p.patient_id} value={String(p.patient_id)}>
                {p.last_name}, {p.first_name} · DOB: {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : '—'}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded text-sm space-y-1" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
            <div className="font-semibold" style={{ fontFamily: 'Rajdhani', color: '#00d4ff' }}>FHIR NDJSON</div>
            <div className="opacity-60 text-xs">Machine-readable · Inferno-testable · §g(10) format</div>
            <div className="text-xs opacity-50">Patient, Encounter, Condition, MedicationRequest, AllergyIntolerance, Observation, Practitioner</div>
          </div>
          <div className="p-3 rounded text-sm space-y-1" style={{ background: 'rgba(201,169,110,0.05)', border: '1px solid rgba(201,169,110,0.15)' }}>
            <div className="font-semibold" style={{ fontFamily: 'Rajdhani', color: '#c9a96e' }}>FHIR Bundle JSON</div>
            <div className="opacity-60 text-xs">Single-file · Human-readable · Portable</div>
            <div className="text-xs opacity-50">All resources in one searchable FHIR Bundle collection</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleExportNDJSON}
            disabled={!selectedPatient || exporting}
            className="btn-cyan flex-1 py-2.5 rounded text-sm disabled:opacity-40"
          >
            {exporting ? '⏳ Exporting...' : '⬇ Download FHIR NDJSON'}
          </button>
          <button
            onClick={handleExportBundle}
            disabled={!selectedPatient || exporting}
            className="btn-primary flex-1 py-2.5 rounded text-sm disabled:opacity-40"
          >
            {exporting ? '⏳ Exporting...' : '⬇ Download FHIR Bundle'}
          </button>
        </div>

        {/* Export result */}
        {exportResult?.success && (
          <div className="p-4 rounded space-y-2" style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.25)' }}>
            <div className="flex items-center gap-2">
              <span style={{ color: '#00ff88' }}>✓</span>
              <span className="text-sm font-semibold" style={{ color: '#00ff88' }}>
                Export complete — {exportResult.total_resources} FHIR resources
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(exportResult.resource_counts || {}).map(([type, count]) => (
                <div key={type} className="text-center p-2 rounded" style={{ background: 'rgba(0,212,255,0.08)' }}>
                  <div className="text-lg font-mono font-bold" style={{ color: '#00d4ff' }}>{count}</div>
                  <div className="text-xs opacity-60">{type}</div>
                </div>
              ))}
            </div>
            <div className="text-xs opacity-50">{exportResult.compliance_note}</div>
          </div>
        )}
      </div>

      {/* Org-wide export */}
      <div className="hud-card p-5 space-y-4">
        <div className="hud-label text-sm" style={{ color: '#00d4ff' }}>
          Whole-System Export Manifest — All Patients
        </div>
        <p className="text-sm opacity-60 leading-relaxed">
          Generates a manifest of all patients in your organization with individual export URLs. 
          Required for practice transitions, migrations, and ONC audit requests.
        </p>
        <button
          onClick={handleOrgManifest}
          disabled={exporting}
          className="btn-cyan px-6 py-2.5 rounded text-sm disabled:opacity-40"
        >
          {exporting ? '⏳ Building manifest...' : '📋 Generate Org Export Manifest'}
        </button>
        {orgManifest && (
          <div className="p-3 rounded text-sm font-mono" style={{ background: 'rgba(6,14,28,0.8)', border: '1px solid rgba(0,212,255,0.15)', overflowX: 'auto' }}>
            <div className="opacity-70 mb-1 text-xs">Org manifest — {(orgManifest as Record<string,unknown>).patient_count as number} patients</div>
            <pre className="text-xs opacity-60" style={{ maxHeight: 200, overflow: 'auto' }}>
              {JSON.stringify(orgManifest, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Hash chain verification */}
      <div className="hud-card p-5 space-y-4">
        <div className="hud-label text-sm" style={{ color: '#00d4ff' }}>
          §170.315(d)(2) Audit Chain Integrity Verification
        </div>
        <p className="text-sm opacity-60 leading-relaxed">
          Verifies the SHA-256 hash chain across all audit log entries. A broken chain indicates 
          potential tampering — immediately reportable to your HIPAA Security Officer.
        </p>
        <button
          onClick={handleVerifyChain}
          disabled={verifying}
          className="btn-cyan px-6 py-2.5 rounded text-sm disabled:opacity-40"
        >
          {verifying ? '🔍 Verifying...' : '🔐 Verify Audit Chain Integrity'}
        </button>
        {chainResult && (
          <div className="p-4 rounded" style={{
            background: chainResult.chain_intact ? 'rgba(0,255,136,0.06)' : 'rgba(255,59,59,0.08)',
            border: `1px solid ${chainResult.chain_intact ? 'rgba(0,255,136,0.3)' : 'rgba(255,59,59,0.4)'}`,
          }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: '1.2rem' }}>{chainResult.chain_intact ? '✅' : '🚨'}</span>
              <span className="font-semibold" style={{
                fontFamily: 'Rajdhani',
                color: chainResult.chain_intact ? '#00ff88' : '#ff3b3b',
              }}>
                {chainResult.chain_intact ? 'Chain Intact — No Tampering Detected' : 'CHAIN BREACH DETECTED'}
              </span>
            </div>
            <div className="text-sm opacity-70">{chainResult.message}</div>
            <div className="text-xs opacity-50 mt-1">{chainResult.records_verified} records verified</div>
          </div>
        )}
      </div>
    </div>
  )
}
