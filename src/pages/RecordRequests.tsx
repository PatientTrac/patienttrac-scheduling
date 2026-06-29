// src/pages/RecordRequests.tsx
// Request queue. HUD list with status + due-date surfacing.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listRecordRequests } from '../lib/recordRequests';
import { fmtMoney } from '../lib/recordRequestFees';
import type { RecordRequestStatus } from '../types/recordRequest';

const STATUS_TABS: (RecordRequestStatus | 'all')[] = [
  'all', 'received', 'under_review', 'authorization_pending',
  'awaiting_payment', 'ready_to_release', 'released', 'denied',
];

const statusColor: Record<string, string> = {
  received: 'text-cyan-300 border-cyan-400/40',
  under_review: 'text-amber-300 border-amber-400/40',
  authorization_pending: 'text-amber-300 border-amber-400/40',
  fee_pending: 'text-amber-300 border-amber-400/40',
  awaiting_payment: 'text-orange-300 border-orange-400/40',
  approved: 'text-emerald-300 border-emerald-400/40',
  ready_to_release: 'text-emerald-300 border-emerald-400/40',
  released: 'text-emerald-400 border-emerald-500/40',
  denied: 'text-rose-300 border-rose-400/40',
  cancelled: 'text-slate-400 border-slate-500/40',
  pending: 'text-cyan-300 border-cyan-400/40',
};

function overdue(due: string | null): boolean {
  return !!due && new Date(due) < new Date();
}

export default function RecordRequests() {
  const [tab, setTab] = useState<RecordRequestStatus | 'all'>('all');
  const { data = [], isLoading } = useQuery({
    queryKey: ['record-requests', tab],
    queryFn: () => listRecordRequests(tab === 'all' ? undefined : { status: tab }),
  });

  return (
    <div className="p-6 text-slate-100">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-[Rajdhani] tracking-wide text-[#c9a96e]">Record Requests</h1>
        <Link
          to="/record-requests/new"
          className="px-4 py-2 rounded bg-[#c9a96e] text-[#060e1c] font-semibold hover:brightness-110"
        >
          + New Request
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-3 py-1 rounded text-sm border ${
              tab === s ? 'bg-[#00d4ff]/10 border-[#00d4ff]/50 text-[#00d4ff]' : 'border-slate-700 text-slate-400'
            }`}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-slate-400">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-[#0a1526] text-slate-400 font-[DM_Mono]">
              <tr>
                <th className="text-left px-3 py-2">Requestor</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Patient</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Fee</th>
                <th className="text-left px-3 py-2">Due</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.request_id} className="border-t border-slate-800 hover:bg-[#0a1526]/60">
                  <td className="px-3 py-2">
                    <Link to={`/record-requests/${r.request_id}`} className="text-[#00d4ff] hover:underline">
                      {r.requestor_name || r.requestor_org || '—'}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{(r.requestor_category || r.requestor_type || '').replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2 text-slate-300">{r.patient_id ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded border text-xs ${statusColor[r.status || 'pending']}`}>
                      {(r.status || 'pending').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {fmtMoney(r.final_fee ?? r.estimated_fee, r.currency || 'USD')}
                  </td>
                  <td className={`px-3 py-2 ${overdue(r.due_at) && r.status !== 'released' ? 'text-rose-400 font-semibold' : 'text-slate-400'}`}>
                    {r.due_at ? new Date(r.due_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No requests.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
