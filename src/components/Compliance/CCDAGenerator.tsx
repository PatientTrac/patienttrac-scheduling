// CCDAGenerator.tsx — PatientTrac C-CDA Generation Panel
// ONC §170.315(b)(1) | (a)(8) | (g)(6)
// Stack: React 18, TypeScript, Tailwind, TanStack Query v5, Supabase JS v2

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CCDADocument {
  ccda_id: string;
  patient_id: number;
  encounter_id: number | null;
  document_type: string;
  document_title: string;
  status: "pending" | "generating" | "complete" | "failed" | "superseded";
  version_number: number;
  xml_size_bytes: number | null;
  generation_ms: number | null;
  exchange_method: string;
  recipient_name: string | null;
  created_at: string;
  sections?: Array<{ name: string; entry_count: number }>;
}

interface GenerateParams {
  patient_id: number;
  encounter_id?: number | null;
  document_type: string;
  recipient_npi?: string;
  recipient_name?: string;
  exchange_method: string;
}

interface CCDAGeneratorProps {
  patientId: number;
  patientName: string;
  encounterId?: number | null;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// ─── Document type options ────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: "CCD",              label: "Continuity of Care (CCD)",     loinc: "34133-9",  icon: "⚕" },
  { value: "ConsultationNote", label: "Consultation Note",            loinc: "11488-4",  icon: "💬" },
  { value: "DischargeSummary", label: "Discharge Summary",            loinc: "18842-5",  icon: "🏥" },
  { value: "HistoryPhysical",  label: "History & Physical",           loinc: "34117-2",  icon: "📋" },
  { value: "ProgressNote",     label: "Progress Note",                loinc: "11506-3",  icon: "📝" },
  { value: "ReferralNote",     label: "Referral Note",                loinc: "57133-1",  icon: "↗" },
  { value: "TransferSummary",  label: "Transfer Summary",             loinc: "18761-7",  icon: "🔄" },
];

const EXCHANGE_METHODS = [
  { value: "download",  label: "Direct Download",         icon: "⬇" },
  { value: "portal",    label: "Patient Portal",          icon: "🔗" },
  { value: "direct",    label: "Direct Messaging (HISP)", icon: "✉" },
  { value: "fhir",      label: "FHIR $document",          icon: "⚡" },
];

const SECTION_LOINC_MAP: Record<string, string> = {
  "Allergies":       "48765-2",
  "Medications":     "10160-0",
  "Problems":        "11450-4",
  "Vital Signs":     "8716-3",
  "Results":         "30954-2",
  "Social History":  "29762-2",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete:    "bg-emerald-900/40 text-emerald-300 border-emerald-700/50",
    failed:      "bg-red-900/40 text-red-300 border-red-700/50",
    generating:  "bg-amber-900/40 text-amber-300 border-amber-700/50 animate-pulse",
    pending:     "bg-slate-800/60 text-slate-400 border-slate-600/50",
    superseded:  "bg-slate-800/40 text-slate-500 border-slate-700/30",
  };
  const labels: Record<string, string> = {
    complete: "Complete", failed: "Failed",
    generating: "Generating…", pending: "Pending", superseded: "Superseded",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono font-semibold uppercase tracking-wider ${styles[status] ?? ""}`}>
      {status === "generating" && (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      )}
      {labels[status] ?? status}
    </span>
  );
}

// ─── Section Coverage Bar ─────────────────────────────────────────────────────

function SectionBar({ sections }: { sections: Array<{ name: string; entry_count: number }> }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {sections.map((s) => (
        <span
          key={s.name}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
            s.entry_count > 0
              ? "bg-cyan-900/30 text-cyan-300 border-cyan-700/40"
              : "bg-slate-800/40 text-slate-500 border-slate-700/30"
          }`}
          title={`LOINC ${SECTION_LOINC_MAP[s.name] ?? ""}`}
        >
          {s.entry_count > 0 ? "✓" : "○"} {s.name}
          {s.entry_count > 0 && <span className="opacity-60">({s.entry_count})</span>}
        </span>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CCDAGenerator({
  patientId,
  patientName,
  encounterId = null,
  supabaseUrl,
  supabaseAnonKey,
}: CCDAGeneratorProps) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const queryClient = useQueryClient();

  const [docType, setDocType] = useState("CCD");
  const [exchangeMethod, setExchangeMethod] = useState("download");
  const [recipientNpi, setRecipientNpi] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [lastXml, setLastXml] = useState<string | null>(null);
  const [showXmlPreview, setShowXmlPreview] = useState(false);

  // ── Fetch document history ─────────────────────────────────────────────────
  const { data: documents, isLoading: docsLoading } = useQuery<CCDADocument[]>({
    queryKey: ["ccda-documents", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("cr")
        .from("ccda_documents")
        .select(`
          ccda_id, patient_id, encounter_id, document_type, document_title,
          status, version_number, xml_size_bytes, generation_ms,
          exchange_method, recipient_name, created_at
        `)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  // ── Generate mutation ──────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async (params: GenerateParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-ccda`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(params),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Generation failed");
      }
      return result;
    },
    onSuccess: (data) => {
      setLastXml(data.xml_content);
      queryClient.invalidateQueries({ queryKey: ["ccda-documents", patientId] });
    },
  });

  // ── Download handler ───────────────────────────────────────────────────────
  const handleDownload = useCallback((xml: string, docType: string, patientName: string) => {
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = patientName.replace(/[^a-z0-9]/gi, "_");
    a.href = url;
    a.download = `CCDA_${docType}_${safeName}_${new Date().toISOString().split("T")[0]}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const selectedDocType = DOC_TYPES.find(d => d.value === docType);
  const needsRecipient = exchangeMethod === "direct" || exchangeMethod === "fhir";

  return (
    <div className="min-h-screen bg-[#060e1c] text-white font-['DM_Sans',sans-serif] p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded bg-[#c9a96e]/10 border border-[#c9a96e]/30 flex items-center justify-center">
            <span className="text-[#c9a96e] text-sm">⚕</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold font-['Rajdhani',sans-serif] tracking-wide text-white">
              C-CDA Document Generator
            </h1>
            <p className="text-xs text-slate-400 font-mono">ONC §170.315(b)(1) · USCDI v3 · HL7 CDA R2.1</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pl-11">
          <span className="text-xs text-slate-400">Patient:</span>
          <span className="text-sm font-semibold text-[#00d4ff]">{patientName}</span>
          <span className="text-slate-600">·</span>
          <span className="text-xs font-mono text-slate-500">ID {patientId}</span>
          {encounterId && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-xs font-mono text-slate-500">Enc #{encounterId}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── Generation Form ────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-4 font-['Rajdhani',sans-serif] tracking-wide uppercase">
              Generate Document
            </h2>

            {/* Document Type */}
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-2 font-mono">Document Type</label>
              <div className="space-y-1">
                {DOC_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setDocType(t.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-left transition-all ${
                      docType === t.value
                        ? "bg-[#c9a96e]/10 border border-[#c9a96e]/40 text-[#c9a96e]"
                        : "border border-transparent hover:border-slate-600/60 hover:bg-slate-800/60 text-slate-300"
                    }`}
                  >
                    <span className="text-base">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium leading-tight">{t.label}</div>
                      <div className="text-[10px] font-mono opacity-50">LOINC {t.loinc}</div>
                    </div>
                    {docType === t.value && (
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Exchange Method */}
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-2 font-mono">Exchange Method</label>
              <div className="grid grid-cols-2 gap-1.5">
                {EXCHANGE_METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setExchangeMethod(m.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-all ${
                      exchangeMethod === m.value
                        ? "bg-[#00d4ff]/10 border border-[#00d4ff]/40 text-[#00d4ff]"
                        : "border border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient fields (for Direct / FHIR) */}
            {needsRecipient && (
              <div className="mb-4 space-y-2 p-3 rounded border border-slate-700/50 bg-slate-800/30">
                <label className="block text-xs text-slate-400 font-mono">Recipient Details</label>
                <input
                  type="text"
                  placeholder="Recipient Name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-800/80 border border-slate-600/60 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00d4ff]/60"
                />
                <input
                  type="text"
                  placeholder="Recipient NPI (optional)"
                  value={recipientNpi}
                  onChange={(e) => setRecipientNpi(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-800/80 border border-slate-600/60 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00d4ff]/60 font-mono"
                />
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={() => generateMutation.mutate({
                patient_id: patientId,
                encounter_id: encounterId ?? null,
                document_type: docType,
                recipient_npi: recipientNpi || undefined,
                recipient_name: recipientName || undefined,
                exchange_method: exchangeMethod,
              })}
              disabled={generateMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded bg-[#c9a96e] hover:bg-[#d4b97e] text-[#060e1c] font-bold text-sm font-['Rajdhani',sans-serif] tracking-wide uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generateMutation.isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Generating C-CDA…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Generate {selectedDocType?.label}
                </>
              )}
            </button>

            {/* Error */}
            {generateMutation.isError && (
              <div className="mt-3 p-3 rounded border border-red-700/50 bg-red-900/20 text-red-300 text-xs font-mono">
                ✗ {(generateMutation.error as Error).message}
              </div>
            )}

            {/* Success + download */}
            {generateMutation.isSuccess && lastXml && (
              <div className="mt-3 p-3 rounded border border-emerald-700/40 bg-emerald-900/20 space-y-2">
                <div className="text-emerald-300 text-xs font-mono font-semibold">✓ C-CDA generated successfully</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(lastXml, docType, patientName)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-emerald-800/60 hover:bg-emerald-700/60 text-emerald-200 text-xs font-medium transition-all"
                  >
                    <span>⬇</span> Download XML
                  </button>
                  <button
                    onClick={() => setShowXmlPreview(!showXmlPreview)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 text-xs font-medium transition-all"
                  >
                    {showXmlPreview ? "Hide" : "Preview"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ONC Criteria Coverage */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-4">
            <h3 className="text-xs font-semibold text-slate-400 mb-3 font-mono uppercase tracking-wider">ONC Criteria Coverage</h3>
            <div className="space-y-2">
              {[
                { crit: "§170.315(b)(1)", desc: "C-CDA Generation", status: "active" },
                { crit: "§170.315(a)(8)", desc: "Clinical Care Summary", status: "active" },
                { crit: "§170.315(g)(6)",  desc: "CCDS Export", status: "active" },
              ].map((c) => (
                <div key={c.crit} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"/>
                  <span className="text-[10px] font-mono text-slate-400">{c.crit}</span>
                  <span className="text-[10px] text-slate-500">{c.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Document History ────────────────────────────────────────────────── */}
        <div className="lg:col-span-3">
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-200 font-['Rajdhani',sans-serif] tracking-wide uppercase">
                Document History
              </h2>
              <span className="text-xs font-mono text-slate-500">
                {documents?.length ?? 0} document{documents?.length !== 1 ? "s" : ""}
              </span>
            </div>

            {docsLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Loading documents…
              </div>
            ) : !documents?.length ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3 opacity-30">📄</div>
                <p className="text-slate-400 text-sm">No C-CDA documents generated yet</p>
                <p className="text-slate-500 text-xs mt-1">Generate your first document using the form</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.ccda_id}
                    className={`rounded border p-4 transition-all ${
                      doc.status === "complete"
                        ? "border-slate-700/60 bg-slate-800/30 hover:border-slate-600/60"
                        : doc.status === "failed"
                        ? "border-red-800/40 bg-red-950/20"
                        : "border-slate-700/40 bg-slate-800/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-200 truncate">
                            {DOC_TYPES.find(d => d.value === doc.document_type)?.icon}{" "}
                            {DOC_TYPES.find(d => d.value === doc.document_type)?.label ?? doc.document_type}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">v{doc.version_number}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                          <span>{fmtDate(doc.created_at)}</span>
                          {doc.xml_size_bytes && <span>· {fmtBytes(doc.xml_size_bytes)}</span>}
                          {doc.generation_ms && <span>· {fmtMs(doc.generation_ms)}</span>}
                          {doc.encounter_id && <span>· Enc #{doc.encounter_id}</span>}
                        </div>
                      </div>
                      <StatusBadge status={doc.status} />
                    </div>

                    {doc.sections && <SectionBar sections={doc.sections} />}

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                        {(() => {
                          const em = EXCHANGE_METHODS.find(e => e.value === doc.exchange_method);
                          return em ? <span>{em.icon} {em.label}</span> : null;
                        })()}
                        {doc.recipient_name && <span>→ {doc.recipient_name}</span>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            // Re-fetch XML for this document
                            supabase.schema("cr").from("ccda_documents")
                              .select("xml_content")
                              .eq("ccda_id", doc.ccda_id)
                              .single()
                              .then(({ data }) => {
                                if (data?.xml_content) {
                                  handleDownload(data.xml_content, doc.document_type, patientName);
                                }
                              });
                          }}
                          disabled={doc.status !== "complete"}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          ⬇ XML
                        </button>
                        <button
                          disabled={doc.status !== "complete"}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono bg-[#00d4ff]/5 hover:bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          ↗ Send
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── XML Preview Modal ─────────────────────────────────────────────────── */}
      {showXmlPreview && lastXml && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[80vh] flex flex-col rounded-lg border border-slate-600/60 bg-[#0a1628] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#c9a96e] font-semibold">C-CDA XML Preview</span>
                <span className="text-[10px] font-mono text-slate-500">HL7 CDA R2.1 · USCDI v3</span>
              </div>
              <button
                onClick={() => setShowXmlPreview(false)}
                className="text-slate-400 hover:text-white transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-5 text-[10px] font-mono text-slate-300 leading-relaxed">
              <code>{lastXml.substring(0, 8000)}{lastXml.length > 8000 ? "\n\n… [truncated for preview — download for full document]" : ""}</code>
            </pre>
            <div className="px-5 py-3 border-t border-slate-700/50 flex justify-end">
              <button
                onClick={() => handleDownload(lastXml, docType, patientName)}
                className="flex items-center gap-2 px-4 py-2 rounded bg-[#c9a96e] hover:bg-[#d4b97e] text-[#060e1c] text-xs font-bold font-['Rajdhani',sans-serif] tracking-wide uppercase transition-all"
              >
                ⬇ Download Full XML
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
