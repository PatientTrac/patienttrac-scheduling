-- 024_record_request_module  — APPLIED to mskormozwekezjmtcylv on handoff date.
-- Reference copy. Extends cr.records_requests + adds fee schedule/rules + status history.
-- See HANDOFF.md for full description. (DDL identical to what was applied via Supabase MCP.)

ALTER TABLE cr.records_requests
  ADD COLUMN IF NOT EXISTS requestor_category   text,
  ADD COLUMN IF NOT EXISTS is_patient_directed  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS record_format        text,
  ADD COLUMN IF NOT EXISTS page_count           integer,
  ADD COLUMN IF NOT EXISTS certification_requested boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS affidavit_requested  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rush_requested       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_schedule_id      uuid,
  ADD COLUMN IF NOT EXISTS fee_rule_id          uuid,
  ADD COLUMN IF NOT EXISTS estimated_fee        numeric,
  ADD COLUMN IF NOT EXISTS final_fee            numeric,
  ADD COLUMN IF NOT EXISTS currency             text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS fee_overridden       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_override_reason  text,
  ADD COLUMN IF NOT EXISTS fee_set_by           uuid,
  ADD COLUMN IF NOT EXISTS fee_set_at           timestamptz,
  ADD COLUMN IF NOT EXISTS fee_waived           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_waiver_reason    text,
  ADD COLUMN IF NOT EXISTS payment_status       text DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS invoice_id           integer,
  ADD COLUMN IF NOT EXISTS due_at               timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_number      text,
  ADD COLUMN IF NOT EXISTS released_by          uuid,
  ADD COLUMN IF NOT EXISTS released_at          timestamptz;

-- requestor_type expanded; requestor_category / status / payment_status CHECKs added
-- (see HANDOFF for full allowed-value lists). Fee schedule + rules + status history
-- tables created mirroring cr.or_fee_schedules / cr.or_fee_rules, with org-scoped RLS
-- and cr.touch_updated_at() triggers. Indexes on (org_id,status),(patient_id),(due_at),
-- fee_rules(schedule_id), status_history(request_id).
--
-- Full authoritative DDL was applied via Supabase MCP apply_migration. If you need to
-- re-run from scratch in a fresh branch, request the complete script from the schema owner.
