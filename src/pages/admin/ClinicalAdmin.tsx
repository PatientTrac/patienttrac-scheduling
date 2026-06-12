// ============================================================================
// Clinical admin pages — platform parity with the Revela/Surgery/OR admin
// panel: consent templates, e-sign sending, provider roster, proposal
// builder, facility branding. Thin wrappers around the shared components.
// ============================================================================

import { useAuth } from '../../lib/auth'
import ConsentTemplates from '../../components/admin/ConsentTemplates'
import ConsentSender from '../../components/admin/ConsentSender'
import ProvidersTab from '../../components/admin/ProvidersTab'
import ProposalBuilder from '../../components/admin/ProposalBuilder'
import FacilitySettings from '../../components/admin/FacilitySettings'

function Gate({ children }: { children: (orgId: string) => React.ReactNode }) {
  const { orgId } = useAuth()
  if (!orgId) return <div style={{ padding: 24, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading organization…</div>
  return <>{children(orgId)}</>
}

export function AdminConsentTemplates() {
  return <Gate>{orgId => <ConsentTemplates orgId={orgId} />}</Gate>
}

export function AdminSendConsent() {
  return <Gate>{orgId => <ConsentSender orgId={orgId} />}</Gate>
}

export function AdminProviders() {
  return <Gate>{orgId => <ProvidersTab orgId={orgId} />}</Gate>
}

export function AdminProposals() {
  return <Gate>{orgId => <ProposalBuilder orgId={orgId} />}</Gate>
}

export function AdminFacilityBranding() {
  return <Gate>{orgId => <FacilitySettings orgId={orgId} />}</Gate>
}
