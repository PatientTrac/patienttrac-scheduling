-- Migration 024: patient-scoped SELECT policy on cr.lab_results
-- Additive to the existing org-scoped lab_results_select policy.
-- Multiple permissive SELECT policies are OR'd — staff (org-scoped) are unaffected.
-- Resolves via cr.current_patient_id() → cr.patient_account (auth_user_id = auth.uid()).
-- Idempotent — safe to re-run.
-- NOTE: already applied to prod out-of-band; this file is for version control only.

DROP POLICY IF EXISTS lab_results_patient_select ON cr.lab_results;
CREATE POLICY lab_results_patient_select ON cr.lab_results
  FOR SELECT
  USING (patient_id = cr.current_patient_id());
