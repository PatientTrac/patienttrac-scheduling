// src/lib/recordRequests.ts
// Data access for the Record Request module. Reads cr.* directly via
// supabase.schema('cr') (cr is in this project's PostgREST exposed schemas;
// same pattern Companion uses). RLS enforces org isolation; role gating is
// applied in the UI per Forge RBAC.

import { supabase } from './supabase'; // CLAUDE CODE: confirm the client export path
import type {
  RecordRequest,
  RecordRequestStatus,
  StatusHistoryRow,
} from '../types/recordRequest';

const cr = () => supabase.schema('cr');

export async function listRecordRequests(filters?: {
  status?: RecordRequestStatus;
  patientId?: number;
}): Promise<RecordRequest[]> {
  let q = cr().from('records_requests').select('*').order('created_at', { ascending: false });
  if (filters?.status) q = q.eq('status', filters.status);
  if (filters?.patientId) q = q.eq('patient_id', filters.patientId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as RecordRequest[];
}

export async function getRecordRequest(requestId: string): Promise<RecordRequest> {
  const { data, error } = await cr()
    .from('records_requests')
    .select('*')
    .eq('request_id', requestId)
    .single();
  if (error) throw error;
  return data as RecordRequest;
}

export async function createRecordRequest(
  payload: Partial<RecordRequest> & { org_id: string; requestor_type: string; request_type: string },
): Promise<RecordRequest> {
  // 30-day HIPAA clock from intake unless caller sets due_at.
  const due =
    payload.due_at ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await cr()
    .from('records_requests')
    .insert({ status: 'received', due_at: due, ...payload })
    .select('*')
    .single();
  if (error) throw error;
  return data as RecordRequest;
}

export async function updateRecordRequest(
  requestId: string,
  patch: Partial<RecordRequest>,
): Promise<RecordRequest> {
  const { data, error } = await cr()
    .from('records_requests')
    .update(patch)
    .eq('request_id', requestId)
    .select('*')
    .single();
  if (error) throw error;
  return data as RecordRequest;
}

// Records a workflow transition AND moves the request status in one logical step.
export async function transitionRequest(args: {
  request: RecordRequest;
  toStatus: RecordRequestStatus;
  action: string;
  changedBy: string;
  note?: string;
  amount?: number;
  currency?: string;
  patch?: Partial<RecordRequest>;
}): Promise<RecordRequest> {
  const { request, toStatus, action, changedBy, note, amount, currency, patch } = args;

  await cr().from('record_request_status_history').insert({
    request_id: request.request_id,
    org_id: request.org_id,
    from_status: request.status,
    to_status: toStatus,
    action,
    amount: amount ?? null,
    currency: currency ?? request.currency ?? null,
    note: note ?? null,
    changed_by: changedBy,
  });

  return updateRecordRequest(request.request_id, { status: toStatus, ...(patch ?? {}) });
}

export async function getStatusHistory(requestId: string): Promise<StatusHistoryRow[]> {
  const { data, error } = await cr()
    .from('record_request_status_history')
    .select('*')
    .eq('request_id', requestId)
    .order('changed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StatusHistoryRow[];
}

// ROI gate: a third-party / non-patient request needs a signed, unexpired ROI
// before fee-setting or release. Patient-directed access does not require ROI.
export function roiSatisfied(r: RecordRequest): boolean {
  if (r.is_patient_directed || r.requestor_type === 'patient') return true;
  if (!r.has_signed_roi) return false;
  if (r.roi_expiry_date && new Date(r.roi_expiry_date) < new Date()) return false;
  return true;
}
