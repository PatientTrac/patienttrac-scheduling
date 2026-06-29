// src/pages/admin/RecordRequestFeeSchedules.tsx
// Admin-only configuration of record-request fee schedules + rules.
// CLAUDE CODE: gate this route to admin / super_admin (Forge RBAC). RLS only
// enforces org isolation, not role — the role check belongs here + in the router.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listFeeSchedules, upsertFeeSchedule, listFeeRules, upsertFeeRule, deleteFeeRule, fmtMoney,
} from '../../lib/recordRequestFees';
import type { FeeRule } from '../../types/recordRequest';

import { useAuth } from '../../lib/auth';

const input = 'bg-[#0a1526] border border-slate-700 rounded px-2 py-1 text-slate-100 text-sm w-full';
const label = 'block text-[10px] font-[DM_Mono] text-slate-500 mb-0.5';

export default function RecordRequestFeeSchedules() {
  const { orgId, role } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<FeeRule>>({});

  const isAdmin = role === 'admin' || role === 'super_admin';

  const { data: schedules = [] } = useQuery({
    queryKey: ['rr-fee-schedules', orgId],
    queryFn: () => listFeeSchedules(orgId),
  });
  const { data: rules = [] } = useQuery({
    queryKey: ['rr-fee-rules', selected],
    queryFn: () => (selected ? listFeeRules(selected) : Promise.resolve([])),
    enabled: !!selected,
  });

  if (!isAdmin) {
    return <div className="p-6 text-rose-300">Fee schedules are editable by administrators only.</div>;
  }

  async function newSchedule() {
    const name = prompt('Schedule name (e.g. "Default" or "Texas")');
    if (!name) return;
    const jurisdiction = prompt('Jurisdiction code (optional, e.g. TX). Leave blank for org default.') || null;
    await upsertFeeSchedule({ org_id: orgId, name, jurisdiction, active: true });
    qc.invalidateQueries({ queryKey: ['rr-fee-schedules', orgId] });
  }

  async function saveRule() {
    if (!selected) return;
    await upsertFeeRule({ ...draft, record_request_fee_schedule_id: selected });
    setDraft({});
    qc.invalidateQueries({ queryKey: ['rr-fee-rules', selected] });
  }

  const num = (k: keyof FeeRule) => (draft[k] as number | undefined) ?? '';
  const setNum = (k: keyof FeeRule, v: string) =>
    setDraft((d) => ({ ...d, [k]: v === '' ? null : parseFloat(v) }));

  return (
    <div className="p-6 text-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-[Rajdhani] tracking-wide text-[#c9a96e]">Record Request Fee Schedules</h1>
        <button onClick={newSchedule} className="px-4 py-2 rounded bg-[#c9a96e] text-[#060e1c] font-semibold">+ Schedule</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded border border-slate-800 p-3">
          <h2 className="text-sm font-[DM_Mono] text-slate-400 mb-2">Schedules</h2>
          <ul className="space-y-1">
            {schedules.map((s) => (
              <li key={s.record_request_fee_schedule_id}>
                <button
                  onClick={() => setSelected(s.record_request_fee_schedule_id)}
                  className={`w-full text-left px-2 py-1 rounded text-sm ${selected === s.record_request_fee_schedule_id ? 'bg-[#00d4ff]/10 text-[#00d4ff]' : 'text-slate-300'}`}
                >
                  {s.name}{s.jurisdiction ? ` · ${s.jurisdiction}` : ''} {s.active ? '' : '(inactive)'}
                </button>
              </li>
            ))}
            {schedules.length === 0 && <li className="text-slate-500 text-sm">No schedules.</li>}
          </ul>
        </div>

        <div className="col-span-2 rounded border border-slate-800 p-3">
          <h2 className="text-sm font-[DM_Mono] text-slate-400 mb-2">Rules</h2>
          {!selected ? (
            <p className="text-slate-500 text-sm">Select a schedule.</p>
          ) : (
            <>
              <table className="w-full text-xs mb-4">
                <thead className="text-slate-500">
                  <tr><th className="text-left">Type</th><th>Flat</th><th>Base</th><th>/Page</th><th>Max</th><th>Pt Cap</th><th></th></tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.record_request_fee_rule_id} className="border-t border-slate-800">
                      <td className="py-1">{r.requestor_type || 'any'} · {r.record_format || 'any'}</td>
                      <td className="text-center">{fmtMoney(r.flat_fee, r.currency || 'USD')}</td>
                      <td className="text-center">{fmtMoney(r.base_fee, r.currency || 'USD')}</td>
                      <td className="text-center">{fmtMoney(r.per_page_fee, r.currency || 'USD')}</td>
                      <td className="text-center">{fmtMoney(r.maximum_fee, r.currency || 'USD')}</td>
                      <td className="text-center">{fmtMoney(r.patient_directed_cap, r.currency || 'USD')}</td>
                      <td className="text-right">
                        <button onClick={async () => { await deleteFeeRule(r.record_request_fee_rule_id); qc.invalidateQueries({ queryKey: ['rr-fee-rules', selected] }); }} className="text-rose-400">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="text-xs font-[DM_Mono] text-slate-500 mb-2">Add Rule</h3>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className={label}>Requestor Type</label>
                  <select className={input} value={(draft.requestor_type as string) ?? ''} onChange={(e) => setDraft((d) => ({ ...d, requestor_type: (e.target.value || null) as FeeRule['requestor_type'] }))}>
                    <option value="">any</option>
                    <option value="patient">patient</option>
                    <option value="healthcare_provider">healthcare_provider</option>
                    <option value="attorney_legal">attorney_legal</option>
                    <option value="disability_insurance">disability_insurance</option>
                    <option value="third_party">third_party</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Format</label>
                  <select className={input} value={(draft.record_format as string) ?? ''} onChange={(e) => setDraft((d) => ({ ...d, record_format: (e.target.value || null) as FeeRule['record_format'] }))}>
                    <option value="">any</option>
                    <option value="electronic">electronic</option>
                    <option value="paper">paper</option>
                  </select>
                </div>
                <div><label className={label}>Flat Fee</label><input className={input} value={num('flat_fee')} onChange={(e) => setNum('flat_fee', e.target.value)} /></div>
                <div><label className={label}>Base Fee</label><input className={input} value={num('base_fee')} onChange={(e) => setNum('base_fee', e.target.value)} /></div>
                <div><label className={label}>Per Page</label><input className={input} value={num('per_page_fee')} onChange={(e) => setNum('per_page_fee', e.target.value)} /></div>
                <div><label className={label}>Page Threshold</label><input className={input} value={num('page_threshold')} onChange={(e) => setNum('page_threshold', e.target.value)} /></div>
                <div><label className={label}>Postage</label><input className={input} value={num('postage_fee')} onChange={(e) => setNum('postage_fee', e.target.value)} /></div>
                <div><label className={label}>Supplies</label><input className={input} value={num('supplies_fee')} onChange={(e) => setNum('supplies_fee', e.target.value)} /></div>
                <div><label className={label}>Certification</label><input className={input} value={num('certification_fee')} onChange={(e) => setNum('certification_fee', e.target.value)} /></div>
                <div><label className={label}>Affidavit</label><input className={input} value={num('affidavit_fee')} onChange={(e) => setNum('affidavit_fee', e.target.value)} /></div>
                <div><label className={label}>Rush</label><input className={input} value={num('rush_fee')} onChange={(e) => setNum('rush_fee', e.target.value)} /></div>
                <div><label className={label}>Minimum</label><input className={input} value={num('minimum_fee')} onChange={(e) => setNum('minimum_fee', e.target.value)} /></div>
                <div><label className={label}>Maximum (ceiling)</label><input className={input} value={num('maximum_fee')} onChange={(e) => setNum('maximum_fee', e.target.value)} /></div>
                <div><label className={label}>Patient-Directed Cap</label><input className={input} value={num('patient_directed_cap')} onChange={(e) => setNum('patient_directed_cap', e.target.value)} /></div>
                <div>
                  <label className={label}>Currency</label>
                  <input className={input} value={(draft.currency as string) ?? 'USD'} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))} />
                </div>
              </div>
              <button onClick={saveRule} className="mt-3 px-4 py-2 rounded bg-[#c9a96e] text-[#060e1c] font-semibold text-sm">Save Rule</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
