import { Building2, Shield, FileText, Settings } from 'lucide-react'
import { ModuleStub } from '@/components/ui/ModuleStub'
export function AdminFacilities() {
  return <ModuleStub icon={Building2} title="Facility Management" description="Super Admin only · Add/edit facilities · NPI · Tax ID · Multi-site configuration" sprint="Super Admin" />
}
export function AdminRoles() {
  return <ModuleStub icon={Shield} title="Roles & Access" description="Fine-grained permission management · Role assignment · Facility-scoped access" sprint="Sprint 5" />
}
export function AdminAudit() {
  return <ModuleStub icon={FileText} title="HIPAA Audit Log" description="All admin actions logged · Login/logout · MFA events · Data access trail" sprint="Sprint 5" />
}
export function AdminSettings() {
  return <ModuleStub icon={Settings} title="System Settings" description="Org config · Supabase Auth · TOTP setup · Email templates · Module entitlements" sprint="Sprint 5" />
}
