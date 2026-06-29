// src/pages/NewRecordRequest.tsx
// Intake form for a new record request. Captures requestor, patient, scope,
// ROI/authorization, delivery, and live fee estimate before submission.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRecordRequest } from '../lib/recordRequests';
import { estimateFee, fmtMoney } from '../lib/recordRequestFees';
import type {
  DeliveryMethod, FeeEstimate, RecordFormat, RequestorCategory, RequestorType,
} from '../types/recordRequest';

import { useAuth } from '../lib/auth';

const CATEGORY_TO_TYPE: Record<RequestorCategory, RequestorType> = {
  patient_client: 'patient',
  healthcare_provider: 'healthcare_provider',
  family_friend: 'family_friend',
  attorney_legal: 'attorney_legal',
  disability_insurance: 'disability_insurance',
  other: 'other',
  internal: 'provider_internal',
};

const CATEGORIES: { value: RequestorCategory; label: string }[] = [
  { value: 'patient_client', label: 'Patient / Client' },
  { value: 'healthcare_provider', label: 'Healthcare Provider' },
  { value: 'family_friend', label: 'Family / Friend' },
  { value: 'attorney_legal', label: 'Attorney / Legal Representative' },
  { value: 'disability_insurance', label: 'Disability or Insurance Representative' },
  { value: 'other', label: 'Other' },
];

const input = 'w-full bg-[#0a1526] border border-slate-700 rounded px-3 py-2 text-slate-100';
const label = 'block text-xs font-[DM_Mono] text-slate-400 mb-1';

export default function NewRecordRequest() {
  const nav = useNavigate();
  const { orgId } = useAuth();

  const [category, setCategory] = useState<RequestorCategory>('patient_client');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [patientId, setPatientId] = useState<string>('');
  const [requestType, setRequestType] = useState('complete_record');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [purpose, setPurpose] = useState('');
  const [delivery, setDelivery] = useState<DeliveryMethod>('secure_email');
  const [format, setFormat] = useState<RecordFormat>('electronic');
  const [pages, setPages] = useState('');
  const [hasRoi, setHasRoi] = useState(false);
  const [roiExpiry, setRoiExpiry] = useState('');
  const [patientDirected, setPatientDirected] = useState(true);
  const [certification, setCertification] = useState(false);
  const [affidavit, setAffidavit] = useState(false);
  const [rush, setRush] = useState(false);
  const [estimate, setEstimate] = useState<FeeEstimate | null>(null);
  const [busy, setBusy] = useState(false);

  const requestorType = useMemo(() => CATEGORY_TO_TYPE[category], [category]);
  const isPatientLike = category === 'patient_client';

  async function runEstimate() {
    const e = await estimateFee({
      orgId,
      requestorType,
      deliveryMethod: delivery,
      recordFormat: format,
      pageCount: pages ? parseInt(pages, 10) : 0,
      isPatientDirected: isPatientLike ? true : patientDirected,
      certification,
      affidavit,
      rush,
    });
    setEstimate(e);
  }

  async function submit() {
    setBusy(true);
    try {
      const r = await createRecordRequest({
        org_id: orgId,
        requestor_type: requestorType,
        requestor_category: category,
        requestor_name: name || null,
        requestor_org: org || null,
        requestor_email: email || null,
        requestor_phone: phone || null,
        patient_id: patientId ? parseInt(patientId, 10) : null,
        request_type: requestType,
        date_range_start: start || null,
        date_range_end: end || null,
        specific_notes: purpose || null,
        delivery_method: delivery,
        record_format: format,
        page_count: pages ? parseInt(pages, 10) : null,
        has_signed_roi: hasRoi,
        roi_expiry_date: roiExpiry || null,
        is_patient_directed: isPatientLike ? true : patientDirected,
        certification_requested: certification,
        affidavit_requested: affidavit,
        rush_requested: rush,
        urgency: rush ? 'rush' : 'routine',
        estimated_fee: estimate?.fee ?? null,
        fee_schedule_id: estimate?.schedule_id ?? null,
        fee_rule_id: estimate?.rule_id ?? null,
        currency: estimate?.currency ?? 'USD',
      });
      nav(`/record-requests/${r.request_id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl text-slate-100">
      <h1 className="text-2xl font-[Rajdhani] tracking-wide text-[#c9a96e] mb-6">New Record Request</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={label}>Requestor Type</label>
          <select className={input} value={category} onChange={(e) => setCategory(e.target.value as RequestorCategory)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div><label className={label}>Requestor Name</label><input className={input} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className={label}>Requestor Org</label><input className={input} value={org} onChange={(e) => setOrg(e.target.value)} /></div>
        <div><label className={label}>Email</label><input className={input} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className={label}>Phone</label><input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>

        <div><label className={label}>Patient ID</label><input className={input} value={patientId} onChange={(e) => setPatientId(e.target.value)} /></div>
        <div>
          <label className={label}>Records Requested</label>
          <select className={input} value={requestType} onChange={(e) => setRequestType(e.target.value)}>
            <option value="complete_record">Complete Record</option>
            <option value="visit_notes">Visit Notes</option>
            <option value="labs">Labs / Results</option>
            <option value="imaging">Imaging</option>
            <option value="billing">Billing Records</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div><label className={label}>Date Range Start</label><input type="date" className={input} value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div><label className={label}>Date Range End</label><input type="date" className={input} value={end} onChange={(e) => setEnd(e.target.value)} /></div>

        <div className="col-span-2"><label className={label}>Purpose of Disclosure</label><textarea className={input} rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>

        <div>
          <label className={label}>Delivery Method</label>
          <select className={input} value={delivery} onChange={(e) => setDelivery(e.target.value as DeliveryMethod)}>
            <option value="secure_email">Secure Email</option>
            <option value="fax">Fax</option>
            <option value="mail">Mail</option>
            <option value="portal">Patient Portal</option>
            <option value="pickup">Pickup</option>
          </select>
        </div>
        <div>
          <label className={label}>Format</label>
          <select className={input} value={format} onChange={(e) => setFormat(e.target.value as RecordFormat)}>
            <option value="electronic">Electronic</option>
            <option value="paper">Paper</option>
          </select>
        </div>
        <div><label className={label}>Estimated Pages</label><input className={input} value={pages} onChange={(e) => setPages(e.target.value)} /></div>

        <div className="col-span-2 flex flex-wrap gap-4 mt-2 text-sm">
          {!isPatientLike && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={patientDirected} onChange={(e) => setPatientDirected(e.target.checked)} />
              Patient-directed (fee limits apply)
            </label>
          )}
          <label className="flex items-center gap-2"><input type="checkbox" checked={hasRoi} onChange={(e) => setHasRoi(e.target.checked)} /> Signed authorization on file</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={certification} onChange={(e) => setCertification(e.target.checked)} /> Certification</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={affidavit} onChange={(e) => setAffidavit(e.target.checked)} /> Affidavit</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={rush} onChange={(e) => setRush(e.target.checked)} /> Rush</label>
        </div>
        {hasRoi && (
          <div><label className={label}>Authorization Expiry</label><input type="date" className={input} value={roiExpiry} onChange={(e) => setRoiExpiry(e.target.value)} /></div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button onClick={runEstimate} className="px-4 py-2 rounded border border-[#00d4ff]/50 text-[#00d4ff] hover:bg-[#00d4ff]/10">
          Estimate Fee
        </button>
        {estimate && (
          <div className="text-sm">
            {estimate.no_schedule || estimate.fee == null ? (
              <span className="text-amber-300">No fee schedule — set manually after intake.</span>
            ) : (
              <span className="text-emerald-300">
                Estimated: <strong>{fmtMoney(estimate.fee, estimate.currency)}</strong>
                {estimate.capped && <span className="ml-2 text-amber-300">(capped to allowed limit)</span>}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button disabled={busy} onClick={submit} className="px-5 py-2 rounded bg-[#c9a96e] text-[#060e1c] font-semibold hover:brightness-110 disabled:opacity-50">
          {busy ? 'Saving…' : 'Create Request'}
        </button>
        <button onClick={() => nav('/record-requests')} className="px-5 py-2 rounded border border-slate-700 text-slate-300">Cancel</button>
      </div>
    </div>
  );
}
