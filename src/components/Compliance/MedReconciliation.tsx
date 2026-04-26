// MedReconciliation.tsx — PatientTrac Medication Reconciliation Workflow
// ONC §170.315(b)(2) | Care Transition Med Review + Attestation
// React 18 · TypeScript · Tailwind · TanStack Query v5 · Supabase JS v2

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

type MedAction =
  | "continue" | "change_dose" | "change_frequency"
  | "change_route" | "discontinue" | "hold" | "add" | "not_reviewed";

type ReconStatus = "in_progress" | "pending_attestation" | "attested" | "superseded";

type TriggerType =
  | "admission" | "discharge" | "transfer"
  | "outpatient_visit" | "referral" | "medication_review";

interface ReconItem {
  item_id: string;
  medication_id: number | null;
  drug_name: string;
  rxnorm_cui: string | null;
  rxcui_name: string | null;
  dose: string | null;
  dose_unit: string | null;
  route: string | null;
  frequency: string | null;
  start_date: string | null;
  action: MedAction;
  action_reason: string | null;
  new_dose: string | null;
  new_dose_unit: string | null;
  new_route: string | null;
  new_frequency: string | null;
  discrepancy_noted: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  is_high_alert: boolean;
}

interface Recon {
  recon_id: string;
  patient_id: number;
  encounter_id: number | null;
  trigger_type: TriggerType;
  status: ReconStatus;
  sources_reviewed: string[];
  meds_reviewed: number;
  meds_continued: number;
  meds_changed: number;
  meds_discontinued: number;
  meds_added: number;
  attested_by: string | null;
  attested_at: string | null;
  created_at: string;
}

interface MedReconciliationProps {
  patientId: number;
  patientName: string;
  encounterId?: number | null;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, { label: string; icon: string }> = {
  admission:        { label: "Admission",         icon: "🏥" },
  discharge:        { label: "Discharge",          icon: "🚪" },
  transfer:         { label: "Transfer",           icon: "🔄" },
  outpatient_visit: { label: "Outpatient Visit",  icon: "🏢" },
  referral:         { label: "Referral",           icon: "↗" },
  medication_review:{ label: "Med Review",         icon: "💊" },
};

const ACTION_CONFIG: Record<MedAction, { label: string; color: string; border: string; bg: string; needsReason: boolean }> = {
  not_reviewed: { label: "Not Reviewed", color: "text-slate-400",  border: "border-slate-700",  bg: "bg-slate-800/40", needsReason: false },
  continue:     { label: "Continue",     color: "text-emerald-300", border: "border-emerald-700/60", bg: "bg-emerald-900/20", needsReason: false },
  change_dose:  { label: "Change Dose",  color: "text-amber-300",  border: "border-amber-700/60",  bg: "bg-amber-900/20", needsReason: true },
  change_frequency: { label: "Change Freq", color: "text-amber-300", border: "border-amber-700/60", bg: "bg-amber-900/20", needsReason: true },
  change_route: { label: "Change Route", color: "text-amber-300",  border: "border-amber-700/60",  bg: "bg-amber-900/20", needsReason: true },
  discontinue:  { label: "Discontinue",  color: "text-red-300",    border: "border-red-700/60",    bg: "bg-red-900/20", needsReason: true },
  hold:         { label: "Hold",         color: "text-orange-300", border: "border-orange-700/60", bg: "bg-orange-900/20", needsReason: true },
  add:          { label: "Added",        color: "text-cyan-300",   border: "border-cyan-700/60",   bg: "bg-cyan-900/20", needsReason: false },
};

const SOURCES = [
  { value: "patient_report",   label: "Patient Report" },
  { value: "pharmacy_fill",    label: "Pharmacy Fill History" },
  { value: "prior_ccda",       label: "Prior C-CDA" },
  { value: "referral_notes",   label: "Referral Notes" },
  { value: "emar",             label: "eMAR" },
  { value: "prescription_db",  label: "Prescription Database" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function progressPct(items: ReconItem[]): number {
  if (!items.length) return 0;
  return Math.round((items.filter(i => i.action !== "not_reviewed").length / items.length) * 100);
}

// ─── Item Row ─────────────────────────────────────────────────────────────────

function MedItemRow({
  item,
  onSave,
  isSaving,
  disabled,
}: {
  item: ReconItem;
  onSave: (data: Partial<ReconItem> & { item_id: string }) => void;
  isSaving: boolean;
  disabled: boolean;
}) {
  const [action, setAction] = useState<MedAction>(item.action);
  const [reason, setReason] = useState(item.action_reason ?? "");
  const [newDose, setNewDose] = useState(item.new_dose ?? "");
  const [newFreq, setNewFreq] = useState(item.new_frequency ?? "");
  const [newRoute, setNewRoute] = useState(item.new_route ?? "");
  const [discrepancy, setDiscrepancy] = useState(item.discrepancy_noted);
  const [discrepancyType, setDiscrepancyType] = useState("");
  const [discrepancyDesc, setDiscrepancyDesc] = useState("");
  const [expanded, setExpanded] = useState(item.action === "not_reviewed");

  const cfg = ACTION_CONFIG[action];
  const needsReason = cfg.needsReason;
  const isChange = ["change_dose", "change_frequency", "change_route"].includes(action);
  const isDirty = action !== item.action || reason !== (item.action_reason ?? "");

  const handleSave = () => {
    onSave({
      item_id: item.item_id,
      action,
      action_reason: reason || null,
      new_dose: newDose || null,
      new_dose_unit: item.dose_unit,
      new_route: newRoute || null,
      new_frequency: newFreq || null,
      discrepancy_noted: discrepancy,
      discrepancy_type: discrepancyType || undefined,
      discrepancy_description: discrepancyDesc || undefined,
    } as Partial<ReconItem> & { item_id: string });
    setExpanded(false);
  };

  return (
    <div className={`rounded border transition-all ${cfg.border} ${cfg.bg}`}>
      {/* ── Summary row ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => !disabled && setExpanded(e => !e)}
      >
        {/* High-alert indicator */}
        {item.is_high_alert && (
          <span title="ISMP High-Alert Medication" className="text-xs text-red-400 font-mono">⚠</span>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-100 truncate">
              {item.rxcui_name ?? item.drug_name}
            </span>
            {item.rxnorm_cui && (
              <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">
                RxNorm {item.rxnorm_cui}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
            {item.dose && <span>{item.dose} {item.dose_unit}</span>}
            {item.route && <span>· {item.route}</span>}
            {item.frequency && <span>· {item.frequency}</span>}
            {item.start_date && <span>· since {fmtDate(item.start_date)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {discrepancy && (
            <span className="text-[10px] font-mono bg-red-900/40 text-red-300 border border-red-700/40 px-1.5 py-0.5 rounded">
              ⚠ Discrepancy
            </span>
          )}
          <span className={`text-xs font-semibold font-mono px-2 py-0.5 rounded border ${cfg.color} ${cfg.border} ${cfg.bg}`}>
            {cfg.label}
          </span>
          {!disabled && (
            <svg
              className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          )}
        </div>
      </div>

      {/* ── Expanded editor ── */}
      {expanded && !disabled && (
        <div className="border-t border-slate-700/50 px-4 py-4 space-y-3">
          {/* Action selector */}
          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">
              Clinician Action
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(ACTION_CONFIG) as MedAction[])
                .filter(a => a !== "add" && a !== "not_reviewed")
                .map(a => (
                  <button
                    key={a}
                    onClick={() => setAction(a)}
                    className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${
                      action === a
                        ? `${ACTION_CONFIG[a].color} ${ACTION_CONFIG[a].border} ${ACTION_CONFIG[a].bg}`
                        : "text-slate-400 border-slate-700/50 hover:border-slate-600 hover:text-slate-300"
                    }`}
                  >
                    {ACTION_CONFIG[a].label}
                  </button>
                ))}
            </div>
          </div>

          {/* Change fields */}
          {isChange && (
            <div className="grid grid-cols-3 gap-2">
              {(action === "change_dose" || action !== "change_route") && (
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">New Dose</label>
                  <input
                    value={newDose}
                    onChange={e => setNewDose(e.target.value)}
                    placeholder={item.dose ?? "e.g. 10"}
                    className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-600/60 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#c9a96e]/60 font-mono"
                  />
                </div>
              )}
              {(action === "change_frequency" || action !== "change_route") && (
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">New Frequency</label>
                  <input
                    value={newFreq}
                    onChange={e => setNewFreq(e.target.value)}
                    placeholder={item.frequency ?? "e.g. BID"}
                    className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-600/60 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#c9a96e]/60 font-mono"
                  />
                </div>
              )}
              {action === "change_route" && (
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">New Route</label>
                  <input
                    value={newRoute}
                    onChange={e => setNewRoute(e.target.value)}
                    placeholder={item.route ?? "e.g. Oral"}
                    className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-600/60 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#c9a96e]/60 font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          {needsReason && (
            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1 uppercase tracking-wider">
                Reason <span className="text-red-400">*</span>
              </label>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={
                  action === "discontinue" ? "e.g. Completed course, no longer indicated"
                  : action === "hold" ? "e.g. Pre-procedure, hold until cleared"
                  : "e.g. Dose adjusted per renal function"
                }
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600/60 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#c9a96e]/60"
              />
            </div>
          )}

          {/* Discrepancy */}
          <div className="flex items-start gap-3 pt-1">
            <input
              type="checkbox"
              id={`disc-${item.item_id}`}
              checked={discrepancy}
              onChange={e => setDiscrepancy(e.target.checked)}
              className="mt-0.5 accent-red-400"
            />
            <label htmlFor={`disc-${item.item_id}`} className="text-xs text-slate-400 cursor-pointer">
              Discrepancy noted
            </label>
          </div>
          {discrepancy && (
            <div className="grid grid-cols-2 gap-2 pl-6">
              <select
                value={discrepancyType}
                onChange={e => setDiscrepancyType(e.target.value)}
                className="px-2.5 py-1.5 rounded bg-slate-800 border border-red-700/40 text-xs text-slate-200 focus:outline-none"
              >
                <option value="">Type…</option>
                <option value="omission">Omission</option>
                <option value="duplication">Duplication</option>
                <option value="dose_error">Dose Error</option>
                <option value="wrong_drug">Wrong Drug</option>
                <option value="other">Other</option>
              </select>
              <input
                value={discrepancyDesc}
                onChange={e => setDiscrepancyDesc(e.target.value)}
                placeholder="Description…"
                className="px-2.5 py-1.5 rounded bg-slate-800 border border-red-700/40 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
              />
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={isSaving || (needsReason && !reason.trim())}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#c9a96e] hover:bg-[#d4b97e] text-[#060e1c] text-xs font-bold font-['Rajdhani',sans-serif] tracking-wide uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isSaving ? (
                <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving…</>
              ) : "Save Decision"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Medication Panel ─────────────────────────────────────────────────────

function AddMedPanel({ reconId, patientId, orgId, onAdded, supabase }: {
  reconId: string; patientId: number; orgId: string;
  onAdded: () => void;
  supabase: ReturnType<typeof createClient>;
}) {
  const [show, setShow] = useState(false);
  const [drugName, setDrugName] = useState("");
  const [dose, setDose] = useState("");
  const [doseUnit, setDoseUnit] = useState("mg");
  const [route, setRoute] = useState("");
  const [frequency, setFrequency] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!drugName.trim()) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${supabase.supabaseUrl}/functions/v1/med-reconciliation?action=add-med`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ recon_id: reconId, patient_id: patientId, drug_name: drugName, dose, dose_unit: doseUnit, route, frequency, action_reason: reason }),
      });
      setShow(false);
      setDrugName(""); setDose(""); setRoute(""); setFrequency(""); setReason("");
      onAdded();
    } finally { setSaving(false); }
  };

  if (!show) return (
    <button
      onClick={() => setShow(true)}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded border border-dashed border-cyan-700/40 text-[#00d4ff] text-xs font-medium hover:bg-cyan-900/10 transition-all"
    >
      + Add Undocumented Medication
    </button>
  );

  return (
    <div className="rounded border border-cyan-700/40 bg-cyan-900/10 p-4 space-y-3">
      <div className="text-xs font-semibold text-[#00d4ff] font-['Rajdhani',sans-serif] uppercase tracking-wider">
        Add Medication Found During Reconciliation
      </div>
      <input value={drugName} onChange={e => setDrugName(e.target.value)} placeholder="Drug name *" className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600/60 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00d4ff]/60"/>
      <div className="grid grid-cols-3 gap-2">
        <input value={dose} onChange={e => setDose(e.target.value)} placeholder="Dose" className="px-2.5 py-1.5 rounded bg-slate-800 border border-slate-600/60 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00d4ff]/60 font-mono"/>
        <select value={doseUnit} onChange={e => setDoseUnit(e.target.value)} className="px-2.5 py-1.5 rounded bg-slate-800 border border-slate-600/60 text-sm text-slate-200 focus:outline-none">
          {["mg","mcg","g","mL","units","IU","mEq","%"].map(u => <option key={u}>{u}</option>)}
        </select>
        <input value={route} onChange={e => setRoute(e.target.value)} placeholder="Route" className="px-2.5 py-1.5 rounded bg-slate-800 border border-slate-600/60 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00d4ff]/60"/>
      </div>
      <input value={frequency} onChange={e => setFrequency(e.target.value)} placeholder="Frequency (e.g. QD, BID)" className="w-full px-3 py-1.5 rounded bg-slate-800 border border-slate-600/60 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00d4ff]/60 font-mono"/>
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Source / reason for adding" className="w-full px-3 py-1.5 rounded bg-slate-800 border border-slate-600/60 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00d4ff]/60"/>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setShow(false)} className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200 transition-all">Cancel</button>
        <button onClick={handleAdd} disabled={!drugName.trim() || saving} className="px-4 py-1.5 rounded bg-[#00d4ff]/10 border border-[#00d4ff]/40 text-[#00d4ff] text-xs font-semibold hover:bg-[#00d4ff]/20 disabled:opacity-40 transition-all">
          {saving ? "Adding…" : "Add Medication"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MedReconciliation({
  patientId, patientName, encounterId = null, supabaseUrl, supabaseAnonKey,
}: MedReconciliationProps) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const queryClient = useQueryClient();

  const [activeReconId, setActiveReconId] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<TriggerType>("outpatient_visit");
  const [sources, setSources] = useState<string[]>(["patient_report"]);
  const [attestNote, setAttestNote] = useState("");
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const fnBase = `${supabaseUrl}/functions/v1/med-reconciliation`;

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` };
  }, [supabase]);

  // ── Active reconciliation ──────────────────────────────────────────────────
  const { data: reconData, isLoading: reconLoading } = useQuery({
    queryKey: ["med-recon", activeReconId],
    enabled: !!activeReconId,
    queryFn: async () => {
      const headers = await getHeaders();
      const res = await fetch(`${fnBase}?action=load&recon_id=${activeReconId}`, { headers });
      return res.json();
    },
    refetchInterval: false,
  });

  // ── History ────────────────────────────────────────────────────────────────
  const { data: historyData } = useQuery({
    queryKey: ["med-recon-history", patientId],
    queryFn: async () => {
      const headers = await getHeaders();
      const res = await fetch(`${fnBase}?action=history&patient_id=${patientId}`, { headers });
      return res.json();
    },
  });

  // ── Create reconciliation ──────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const headers = await getHeaders();
      const res = await fetch(`${fnBase}?action=create`, {
        method: "POST", headers,
        body: JSON.stringify({ patient_id: patientId, encounter_id: encounterId, trigger_type: triggerType, sources_reviewed: sources }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setActiveReconId(data.recon_id);
        setShowCreatePanel(false);
        queryClient.invalidateQueries({ queryKey: ["med-recon-history", patientId] });
      }
    },
  });

  // ── Save item ──────────────────────────────────────────────────────────────
  const saveItemMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const headers = await getHeaders();
      const res = await fetch(`${fnBase}?action=save-item`, {
        method: "POST", headers,
        body: JSON.stringify({ ...payload, recon_id: activeReconId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["med-recon", activeReconId] });
      setSavingItemId(null);
    },
  });

  // ── Attest ─────────────────────────────────────────────────────────────────
  const attestMutation = useMutation({
    mutationFn: async () => {
      const headers = await getHeaders();
      const res = await fetch(`${fnBase}?action=attest`, {
        method: "POST", headers,
        body: JSON.stringify({ recon_id: activeReconId, attestation_note: attestNote }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["med-recon", activeReconId] });
        queryClient.invalidateQueries({ queryKey: ["med-recon-history", patientId] });
      }
    },
  });

  const recon: Recon | null = reconData?.recon ?? null;
  const items: ReconItem[] = reconData?.items ?? [];
  const history = historyData?.history ?? [];
  const pct = progressPct(items);
  const unreviewedCount = items.filter(i => i.action === "not_reviewed").length;
  const isAttested = recon?.status === "attested";

  const toggleSource = (v: string) =>
    setSources(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]);

  return (
    <div className="min-h-screen bg-[#060e1c] text-white font-['DM_Sans',sans-serif] p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded bg-[#c9a96e]/10 border border-[#c9a96e]/30 flex items-center justify-center text-[#c9a96e]">💊</div>
            <div>
              <h1 className="text-lg font-semibold font-['Rajdhani',sans-serif] tracking-wide">Medication Reconciliation</h1>
              <p className="text-xs text-slate-400 font-mono">ONC §170.315(b)(2) · Care Transition Workflow</p>
            </div>
          </div>
          <div className="pl-11 flex items-center gap-2 text-xs">
            <span className="text-slate-400">Patient:</span>
            <span className="text-[#00d4ff] font-semibold">{patientName}</span>
            {encounterId && <><span className="text-slate-600">·</span><span className="text-slate-500 font-mono">Enc #{encounterId}</span></>}
          </div>
        </div>
        {!activeReconId && (
          <button
            onClick={() => setShowCreatePanel(true)}
            className="flex items-center gap-2 px-4 py-2 rounded bg-[#c9a96e] hover:bg-[#d4b97e] text-[#060e1c] text-sm font-bold font-['Rajdhani',sans-serif] tracking-wide uppercase transition-all"
          >
            + New Reconciliation
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* ── Left sidebar: create + history ─────────────────────────────────── */}
        <div className="space-y-4">
          {/* Create panel */}
          {showCreatePanel && (
            <div className="rounded-lg border border-[#c9a96e]/30 bg-slate-900/60 p-4 space-y-4">
              <h3 className="text-xs font-semibold text-[#c9a96e] font-['Rajdhani',sans-serif] uppercase tracking-wider">
                Start Reconciliation
              </h3>

              <div>
                <label className="block text-[10px] text-slate-400 font-mono mb-1.5 uppercase">Trigger</label>
                <div className="space-y-1">
                  {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setTriggerType(t)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-left transition-all ${
                        triggerType === t
                          ? "bg-[#c9a96e]/10 border border-[#c9a96e]/40 text-[#c9a96e]"
                          : "border border-transparent hover:border-slate-600/60 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span>{TRIGGER_LABELS[t].icon}</span>
                      <span>{TRIGGER_LABELS[t].label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-mono mb-1.5 uppercase">Sources Reviewed</label>
                <div className="space-y-1">
                  {SOURCES.map(s => (
                    <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={sources.includes(s.value)} onChange={() => toggleSource(s.value)} className="accent-[#c9a96e]"/>
                      <span className="text-xs text-slate-300">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowCreatePanel(false)} className="flex-1 py-1.5 rounded text-xs text-slate-400 border border-slate-700/50 hover:text-slate-200 transition-all">Cancel</button>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 rounded bg-[#c9a96e] text-[#060e1c] text-xs font-bold font-['Rajdhani',sans-serif] uppercase tracking-wide hover:bg-[#d4b97e] disabled:opacity-50 transition-all"
                >
                  {createMutation.isPending ? "Starting…" : "Start"}
                </button>
              </div>
            </div>
          )}

          {/* History list */}
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
            <h3 className="text-xs font-semibold text-slate-400 font-mono uppercase tracking-wider mb-3">
              History ({history.length})
            </h3>
            {!history.length ? (
              <p className="text-xs text-slate-500 text-center py-4">No reconciliations on record</p>
            ) : (
              <div className="space-y-2">
                {history.map((h: Recon) => (
                  <button
                    key={h.recon_id}
                    onClick={() => { setActiveReconId(h.recon_id); setShowCreatePanel(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded border transition-all ${
                      activeReconId === h.recon_id
                        ? "border-[#c9a96e]/50 bg-[#c9a96e]/5 "
                        : "border-slate-700/40 hover:border-slate-600/60 bg-slate-800/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-200">
                        {TRIGGER_LABELS[h.trigger_type]?.icon} {TRIGGER_LABELS[h.trigger_type]?.label}
                      </span>
                      <span className={`text-[10px] font-mono font-semibold ${
                        h.status === "attested" ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {h.status === "attested" ? "✓" : "●"} {h.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {fmtDate(h.created_at)}
                      {h.meds_reviewed > 0 && ` · ${h.meds_reviewed} reviewed`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Main reconciliation workspace ───────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          {!activeReconId ? (
            <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 flex flex-col items-center justify-center py-20">
              <div className="text-5xl mb-4 opacity-20">💊</div>
              <p className="text-slate-400 text-sm">No reconciliation selected</p>
              <p className="text-slate-500 text-xs mt-1">Start a new reconciliation or select one from history</p>
              <button
                onClick={() => setShowCreatePanel(true)}
                className="mt-4 px-4 py-2 rounded border border-[#c9a96e]/40 text-[#c9a96e] text-xs font-medium hover:bg-[#c9a96e]/5 transition-all"
              >
                + New Reconciliation
              </button>
            </div>
          ) : reconLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Loading medications…
            </div>
          ) : (
            <>
              {/* Status bar */}
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-200 font-['Rajdhani',sans-serif]">
                      {TRIGGER_LABELS[recon?.trigger_type ?? "outpatient_visit"]?.icon}{" "}
                      {TRIGGER_LABELS[recon?.trigger_type ?? "outpatient_visit"]?.label} Reconciliation
                    </span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border font-semibold ${
                      isAttested
                        ? "text-emerald-300 border-emerald-700/50 bg-emerald-900/20"
                        : "text-amber-300 border-amber-700/50 bg-amber-900/20"
                    }`}>
                      {isAttested ? "✓ Attested" : "In Progress"}
                    </span>
                  </div>
                  {isAttested && (
                    <span className="text-[10px] font-mono text-slate-500">
                      Attested {fmtDate(recon?.attested_at ?? null)}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#c9a96e] to-[#00d4ff] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-400 flex-shrink-0">
                    {items.filter(i => i.action !== "not_reviewed").length}/{items.length} reviewed ({pct}%)
                  </span>
                </div>

                {/* Summary chips */}
                {recon && recon.meds_reviewed > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {recon.meds_continued > 0 && <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-300 border border-emerald-700/30">✓ {recon.meds_continued} continued</span>}
                    {recon.meds_changed > 0 && <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/30 text-amber-300 border border-amber-700/30">~ {recon.meds_changed} changed</span>}
                    {recon.meds_discontinued > 0 && <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-700/30">✕ {recon.meds_discontinued} discontinued</span>}
                    {recon.meds_added > 0 && <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-900/30 text-cyan-300 border border-cyan-700/30">+ {recon.meds_added} added</span>}
                  </div>
                )}
              </div>

              {/* Medication list */}
              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">No active medications on file</div>
                ) : (
                  items.map(item => (
                    <MedItemRow
                      key={item.item_id}
                      item={item}
                      disabled={isAttested}
                      isSaving={savingItemId === item.item_id}
                      onSave={(data) => {
                        setSavingItemId(item.item_id);
                        saveItemMutation.mutate(data as Record<string, unknown>);
                      }}
                    />
                  ))
                )}

                {!isAttested && (
                  <AddMedPanel
                    reconId={activeReconId}
                    patientId={patientId}
                    orgId=""
                    supabase={supabase}
                    onAdded={() => queryClient.invalidateQueries({ queryKey: ["med-recon", activeReconId] })}
                  />
                )}
              </div>

              {/* Attestation panel */}
              {!isAttested && (
                <div className={`rounded-lg border p-4 transition-all ${
                  unreviewedCount === 0
                    ? "border-emerald-700/40 bg-emerald-900/10"
                    : "border-slate-700/40 bg-slate-800/20 opacity-60"
                }`}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold font-['Rajdhani',sans-serif] uppercase tracking-wide text-slate-200 mb-1">
                        Provider Attestation
                      </h3>
                      {unreviewedCount > 0 ? (
                        <p className="text-xs text-slate-400">
                          {unreviewedCount} medication{unreviewedCount > 1 ? "s" : ""} still require review before attestation.
                        </p>
                      ) : (
                        <>
                          <p className="text-xs text-slate-400 mb-2">All medications reviewed. Add a note and attest to complete reconciliation.</p>
                          <input
                            value={attestNote}
                            onChange={e => setAttestNote(e.target.value)}
                            placeholder="Optional attestation note (e.g. reconciled with pharmacy fill history)"
                            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600/60 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-600/60"
                          />
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => attestMutation.mutate()}
                      disabled={unreviewedCount > 0 || attestMutation.isPending}
                      className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold font-['Rajdhani',sans-serif] tracking-wide uppercase disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      {attestMutation.isPending ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      ) : "✓"}
                      {attestMutation.isPending ? "Attesting…" : "Attest & Complete"}
                    </button>
                  </div>
                  {attestMutation.isError && (
                    <div className="mt-2 text-xs text-red-300 font-mono">
                      ✗ {(attestMutation.error as Error).message}
                    </div>
                  )}
                  {attestMutation.data?.error && (
                    <div className="mt-2 text-xs text-red-300 font-mono">✗ {attestMutation.data.error}</div>
                  )}
                </div>
              )}

              {isAttested && (
                <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 p-4 text-center">
                  <div className="text-emerald-400 font-semibold font-['Rajdhani',sans-serif] uppercase tracking-wide text-sm mb-1">
                    ✓ Reconciliation Attested
                  </div>
                  <p className="text-xs text-slate-400">
                    Completed {fmtDate(recon?.attested_at ?? null)} · This record is locked for audit purposes.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
