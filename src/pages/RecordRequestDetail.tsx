// src/pages/RecordRequestDetail.tsx
// Fulfillment workflow: verify authorization -> set/approve fee -> invoice/payment -> release.
// Release writes a PHI disclosure event to saas.phi_audit_log (see HANDOFF for the
// recommended RPC; UI calls it on release).
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRecordRequest, getStatusHistory, transitionRequest, updateRecordRequest, roiSatisfied,
  logPhiDisclosure,
} from '../lib/recordRequests';
import { estimateFee, fmtMoney } from '../lib/recordRequestFees';
import type { RecordRequest } from '../types/recordRequest';

import { useAuth } from '../lib/auth';

const card = 'rounded border border-slate-800 bg-[#0a1526]/60 p-4';
const btn = 'px-4 py-2 rounded text-sm font-semibold';

export default function RecordRequestDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { member } = useAuth();
  const userId = member?.id ?? '';

  const { data: req } = useQuery({ queryKey: ['record-request', id], queryFn: () => getRecordRequest(id) });
  const { data: history = [] } = useQuery({ queryKey: ['record-request-history', id], queryFn: () => getStatusHistory(id) });

  const [feeInput, setFeeInput] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [denyReason, setDenyReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (!req) return <div className="p-6 text-slate-400">Loading…</div>;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['record-request', id] });
    qc.invalidateQueries({ queryKey: ['record-request-history', id] });
  };

  const roiOk = roiSatisfied(req);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); refresh(); } finally { setBusy(false); }
  }

  async function recomputeEstimate() {
    const e = await estimateFee({
      orgId: req.org_id,
      requestorType: req.requestor_type,
      deliveryMethod: req.delivery_method,
      recordFormat: req.record_format ?? 'electronic',
      pageCount: req.page_count ?? 0,
      isPatientDirected: !!req.is_patient_directed,
      certification: !!req.certification_requested,
      affidavit: !!req.affidavit_requested,
      rush: !!req.rush_requested,
    });
    if (e.fee != null) setFeeInput(String(e.fee));
    await updateRecordRequest(id, {
      estimated_fee: e.fee, fee_schedule_id: e.schedule_id, fee_rule_id: e.rule_id, currency: e.currency,
    });
    refresh();
  }

  async function setFinalFee(overridden: boolean) {
    const amt = parseFloat(feeInput);
    if (Number.isNaN(amt)) return;
    await act(() =>
      transitionRequest({
        request: req as RecordRequest,
        toStatus: amt > 0 ? 'awaiting_payment' : 'approved',
        action: overridden ? 'fee_overridden' : 'fee_set',
        changedBy: userId,
        amount: amt,
        note: overridden ? overrideReason : undefined,
        patch: {
          final_fee: amt,
          fee_overridden: overridden,
          fee_override_reason: overridden ? overrideReason : null,
          fee_set_by: userId,
          fee_set_at: new Date().toISOString(),
          payment_status: amt > 0 ? 'pending' : 'not_required',
        },
      }),
    );
  }

  return (
    <div className="p-6 max-w-4xl text-slate-100">
      <button onClick={() => nav('/record-requests')} className="text-slate-400 text-sm mb-3">← Queue</button>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-[Rajdhani] tracking-wide text-[#c9a96e]">
          {req.requestor_name || req.requestor_org || 'Record Request'}
        </h1>
        <span className="px-3 py-1 rounded border border-[#00d4ff]/40 text-[#00d4ff] text-sm">
          {(req.status || 'pending').replace(/_/g, ' ')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className={card}>
          <h2 className="text-sm font-[DM_Mono] text-slate-400 mb-2">Request</h2>
          <p>Patient: {req.patient_id ?? '—'}</p>
          <p>Type: {(req.requestor_category || req.requestor_type).replace(/_/g, ' ')}</p>
          <p>Records: {req.request_type.replace(/_/g, ' ')}</p>
          <p>Format / Delivery: {req.record_format} · {req.delivery_method}</p>
          <p>Pages: {req.page_count ?? '—'}</p>
          <p>Due: {req.due_at ? new Date(req.due_at).toLocaleDateString() : '—'}</p>
          {req.is_patient_directed && <p className="text-cyan-300 text-sm mt-1">Patient-directed — fee limits apply.</p>}
        </div>

        <div className={card}>
          <h2 className="text-sm font-[DM_Mono] text-slate-400 mb-2">Authorization</h2>
          <p>Signed ROI: {req.has_signed_roi ? 'Yes' : 'No'}</p>
          <p>Expiry: {req.roi_expiry_date || '—'}</p>
          <p className={roiOk ? 'text-emerald-300 mt-2' : 'text-rose-300 mt-2'}>
            {roiOk ? 'Authorization satisfied.' : 'Signed, unexpired authorization required before release.'}
          </p>
        </div>
      </div>

      {/* Fee */}
      <div className={`${card} mt-4`}>
        <h2 className="text-sm font-[DM_Mono] text-slate-400 mb-3">Fee</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span>Estimated: {fmtMoney(req.estimated_fee, req.currency || 'USD')}</span>
          <span>Final: {fmtMoney(req.final_fee, req.currency || 'USD')}</span>
          <button onClick={() => act(recomputeEstimate)} disabled={busy} className={`${btn} border border-[#00d4ff]/50 text-[#00d4ff]`}>
            Recompute Estimate
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <input className="bg-[#0a1526] border border-slate-700 rounded px-3 py-2 w-32" placeholder="Amount" value={feeInput} onChange={(e) => setFeeInput(e.target.value)} />
          <button onClick={() => setFinalFee(false)} disabled={busy} className={`${btn} bg-[#c9a96e] text-[#060e1c]`}>Set Fee</button>
          <input className="bg-[#0a1526] border border-slate-700 rounded px-3 py-2 flex-1 min-w-48" placeholder="Override reason (if exceeding estimate)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          <button onClick={() => setFinalFee(true)} disabled={busy || !overrideReason} className={`${btn} border border-amber-400/50 text-amber-300`}>Override</button>
        </div>
        <div className="mt-2">
          <button
            onClick={() => act(() => transitionRequest({
              request: req as RecordRequest, toStatus: 'approved', action: 'fee_waived', changedBy: userId,
              patch: { fee_waived: true, payment_status: 'waived', final_fee: 0 },
            }))}
            disabled={busy}
            className="text-sm text-slate-400 underline"
          >
            Waive fee
          </button>
        </div>
      </div>

      {/* Workflow actions */}
      <div className={`${card} mt-4`}>
        <h2 className="text-sm font-[DM_Mono] text-slate-400 mb-3">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => act(() => transitionRequest({ request: req as RecordRequest, toStatus: 'authorization_pending', action: 'authorization_verified', changedBy: userId, patch: { has_signed_roi: true } }))}
            className={`${btn} border border-slate-600 text-slate-200`}
          >Verify Authorization</button>

          <button
            disabled={busy}
            onClick={() => act(() => transitionRequest({ request: req as RecordRequest, toStatus: 'awaiting_payment', action: 'invoiced', changedBy: userId, patch: { payment_status: 'invoiced' } }))}
            className={`${btn} border border-slate-600 text-slate-200`}
          >Create Invoice</button>

          <button
            disabled={busy}
            onClick={() => act(() => transitionRequest({ request: req as RecordRequest, toStatus: 'ready_to_release', action: 'payment_recorded', changedBy: userId, amount: req.final_fee ?? 0, patch: { payment_status: 'paid' } }))}
            className={`${btn} border border-emerald-500/50 text-emerald-300`}
          >Record Payment</button>

          <button
            disabled={busy || !roiOk}
            title={!roiOk ? 'Authorization required' : undefined}
            onClick={() => act(async () => {
              await logPhiDisclosure(req as RecordRequest);
              await transitionRequest({
                request: req as RecordRequest, toStatus: 'released', action: 'released', changedBy: userId,
                patch: { released_by: userId, released_at: new Date().toISOString(), delivered_at: new Date().toISOString() },
              });
            })}
            className={`${btn} bg-emerald-600 text-white disabled:opacity-40`}
          >Release Records</button>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <input className="bg-[#0a1526] border border-slate-700 rounded px-3 py-2 flex-1" placeholder="Denial reason" value={denyReason} onChange={(e) => setDenyReason(e.target.value)} />
          <button
            disabled={busy || !denyReason}
            onClick={() => act(() => transitionRequest({ request: req as RecordRequest, toStatus: 'denied', action: 'denied', changedBy: userId, note: denyReason, patch: { denial_reason: denyReason } }))}
            className={`${btn} border border-rose-500/50 text-rose-300`}
          >Deny</button>
        </div>
      </div>

      {/* History */}
      <div className={`${card} mt-4`}>
        <h2 className="text-sm font-[DM_Mono] text-slate-400 mb-2">Activity History</h2>
        <ul className="text-sm space-y-1">
          {history.map((h) => (
            <li key={h.history_id} className="flex justify-between border-b border-slate-800/60 py-1">
              <span>{(h.action || '').replace(/_/g, ' ')} {h.amount != null ? `· ${fmtMoney(h.amount, h.currency || 'USD')}` : ''} {h.note ? `· ${h.note}` : ''}</span>
              <span className="text-slate-500">{new Date(h.changed_at).toLocaleString()}</span>
            </li>
          ))}
          {history.length === 0 && <li className="text-slate-500">No activity yet.</li>}
        </ul>
      </div>
    </div>
  );
}
