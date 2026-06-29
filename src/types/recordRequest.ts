// src/types/recordRequest.ts
// Types for the Forge Record Request module (cr.records_requests + fee schedule).
// Schema applied in migration 024 / 024b against Supabase mskormozwekezjmtcylv.

export type RequestorType =
  | 'provider_internal'
  | 'patient'
  | 'personal_representative'
  | 'healthcare_provider'
  | 'attorney_legal'
  | 'disability_insurance'
  | 'family_friend'
  | 'third_party'
  | 'other';

// The 6 public-facing buckets (+ internal) the intake form presents.
export type RequestorCategory =
  | 'patient_client'
  | 'healthcare_provider'
  | 'family_friend'
  | 'attorney_legal'
  | 'disability_insurance'
  | 'other'
  | 'internal';

export type RecordRequestStatus =
  | 'received'
  | 'pending'
  | 'under_review'
  | 'authorization_pending'
  | 'fee_pending'
  | 'awaiting_payment'
  | 'approved'
  | 'ready_to_release'
  | 'released'
  | 'denied'
  | 'cancelled';

export type PaymentStatus =
  | 'not_required'
  | 'pending'
  | 'invoiced'
  | 'paid'
  | 'waived';

export type RecordFormat = 'paper' | 'electronic';
export type DeliveryMethod = 'secure_email' | 'fax' | 'mail' | 'portal' | 'pickup';
export type Urgency = 'routine' | 'rush' | 'stat';

export interface RecordRequest {
  request_id: string;
  org_id: string;
  patient_id: number | null;
  encounter_id: string | null; // NOTE: uuid on this table (deviates from cr integer convention; see HANDOFF)
  provider_id: string | null;  // NOTE: uuid on this table
  requestor_type: RequestorType;
  requestor_category: RequestorCategory | null;
  requestor_name: string | null;
  requestor_org: string | null;
  requestor_email: string | null;
  requestor_phone: string | null;
  requestor_fax: string | null;
  requestor_address: string | null;
  has_signed_roi: boolean | null;
  roi_signed_date: string | null;
  roi_expiry_date: string | null;
  agreement_type: string | null;
  agreement_doc_url: string | null;
  request_type: string;
  date_range_start: string | null;
  date_range_end: string | null;
  specific_notes: string | null;
  urgency: Urgency | null;
  status: RecordRequestStatus | null;
  denial_reason: string | null;
  delivery_method: DeliveryMethod | null;
  delivered_at: string | null;
  delivered_to: string | null;
  // fee / payment
  is_patient_directed: boolean | null;
  record_format: RecordFormat | null;
  page_count: number | null;
  certification_requested: boolean | null;
  affidavit_requested: boolean | null;
  rush_requested: boolean | null;
  fee_schedule_id: string | null;
  fee_rule_id: string | null;
  estimated_fee: number | null;
  final_fee: number | null;
  currency: string | null;
  fee_overridden: boolean | null;
  fee_override_reason: string | null;
  fee_set_by: string | null;
  fee_set_at: string | null;
  fee_waived: boolean | null;
  fee_waiver_reason: string | null;
  payment_status: PaymentStatus | null;
  invoice_id: number | null;
  due_at: string | null;
  tracking_number: string | null;
  released_by: string | null;
  released_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  fulfilled_by: string | null;
}

export interface FeeSchedule {
  record_request_fee_schedule_id: string;
  org_id: string;
  location_id: number | null;
  jurisdiction: string | null;
  name: string;
  effective_start_date: string | null;
  effective_end_date: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeeRule {
  record_request_fee_rule_id: string;
  record_request_fee_schedule_id: string;
  requestor_type: RequestorType | null;
  delivery_method: DeliveryMethod | null;
  record_format: RecordFormat | null;
  flat_fee: number | null;
  base_fee: number | null;
  per_page_fee: number | null;
  page_threshold: number | null;
  per_page_fee_after: number | null;
  postage_fee: number | null;
  supplies_fee: number | null;
  certification_fee: number | null;
  affidavit_fee: number | null;
  rush_fee: number | null;
  minimum_fee: number | null;
  maximum_fee: number | null;
  patient_directed_cap: number | null;
  currency: string | null;
  compliance_note: string | null;
  metadata: Record<string, unknown> | null;
}

export interface FeeEstimate {
  fee: number | null;
  currency: string;
  schedule_id: string | null;
  rule_id: string | null;
  capped: boolean;
  cap_reason?: string | null;
  right_of_access?: boolean;
  is_patient_directed?: boolean;
  no_schedule?: boolean;
  no_rule?: boolean;
  breakdown?: Record<string, number>;
  compliance_note?: string | null;
}

export interface StatusHistoryRow {
  history_id: string;
  request_id: string;
  org_id: string;
  from_status: string | null;
  to_status: string | null;
  action: string | null;
  amount: number | null;
  currency: string | null;
  note: string | null;
  changed_by: string | null;
  changed_at: string;
}

// HHS guardrail reference (display only — enforcement is in the estimator).
export const HHS_ELECTRONIC_FLAT_FEE_USD = 6.5;
