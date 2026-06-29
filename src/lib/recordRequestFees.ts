// src/lib/recordRequestFees.ts
// Fee estimation (RPC) + admin CRUD for fee schedules / rules.

import { supabase } from './supabase'; // CLAUDE CODE: confirm the client export path
import type {
  FeeEstimate,
  FeeRule,
  FeeSchedule,
  RecordFormat,
  RequestorType,
  DeliveryMethod,
} from '../types/recordRequest';

const cr = () => supabase.schema('cr');

export interface EstimateArgs {
  orgId: string;
  requestorType: RequestorType;
  deliveryMethod?: DeliveryMethod | null;
  recordFormat?: RecordFormat;
  pageCount?: number;
  jurisdiction?: string | null;
  isPatientDirected?: boolean;
  certification?: boolean;
  affidavit?: boolean;
  rush?: boolean;
}

export async function estimateFee(a: EstimateArgs): Promise<FeeEstimate> {
  const { data, error } = await supabase.schema('cr').rpc('estimate_record_request_fee', {
    p_org_id: a.orgId,
    p_requestor_type: a.requestorType,
    p_delivery_method: a.deliveryMethod ?? null,
    p_record_format: a.recordFormat ?? 'electronic',
    p_page_count: a.pageCount ?? 0,
    p_jurisdiction: a.jurisdiction ?? null,
    p_is_patient_directed: a.isPatientDirected ?? false,
    p_certification: a.certification ?? false,
    p_affidavit: a.affidavit ?? false,
    p_rush: a.rush ?? false,
  });
  if (error) throw error;
  return data as FeeEstimate;
}

// ---- Fee schedule admin (gate to admin / super_admin in the UI) ----

export async function listFeeSchedules(orgId: string): Promise<FeeSchedule[]> {
  const { data, error } = await cr()
    .from('record_request_fee_schedules')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FeeSchedule[];
}

export async function upsertFeeSchedule(s: Partial<FeeSchedule> & { org_id: string; name: string }) {
  const { data, error } = await cr()
    .from('record_request_fee_schedules')
    .upsert(s)
    .select('*')
    .single();
  if (error) throw error;
  return data as FeeSchedule;
}

export async function listFeeRules(scheduleId: string): Promise<FeeRule[]> {
  const { data, error } = await cr()
    .from('record_request_fee_rules')
    .select('*')
    .eq('record_request_fee_schedule_id', scheduleId);
  if (error) throw error;
  return (data ?? []) as FeeRule[];
}

export async function upsertFeeRule(r: Partial<FeeRule> & { record_request_fee_schedule_id: string }) {
  const { data, error } = await cr()
    .from('record_request_fee_rules')
    .upsert(r)
    .select('*')
    .single();
  if (error) throw error;
  return data as FeeRule;
}

export async function deleteFeeRule(ruleId: string) {
  const { error } = await cr()
    .from('record_request_fee_rules')
    .delete()
    .eq('record_request_fee_rule_id', ruleId);
  if (error) throw error;
}

export function fmtMoney(amount: number | null | undefined, currency = 'USD') {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
