import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, FileText, AlertTriangle, CheckCircle, Clock, Send, XCircle,
         Search, Loader, TrendingUp, Activity, ShieldCheck, FileEdit, GitBranch, Sparkles, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import { useAuth } from '../lib/auth'

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'

type BillingTab = 'superbills'|'ai'|'edi'|'era'|'rejections'|'aging'|'preauth'|'appeals'|'secondary'

const SB_STATUS_COLORS: Record<string,string> = {
  draft:'bg-slate-500/15 text-slate-400 border-slate-500/25',
  ready:'bg-blue-500/15 text-blue-400 border-blue-500/25',
  submitted:'bg-amber-500/15 text-amber-400 border-amber-500/25',
  paid:'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  denied:'bg-red-500/15 text-red-400 border-red-500/25',
  partial:'bg-purple-500/15 text-purple-400 border-purple-500/25',
}
const AGING_COLORS: Record<string,string> = {
  '0-30':'text-emerald-400','31-60':'text-gold-400','61-90':'text-amber-400','91-120':'text-orange-400','120+':'text-red-400'
}
const REJ_COLORS: Record<string,string> = {
  open:'bg-red-500/15 text-red-400', in_review:'bg-amber-500/15 text-amber-400',
  appealing:'bg-orange-500/15 text-orange-400', resolved:'bg-emerald-500/15 text-emerald-400',
  written_off:'bg-slate-500/15 text-slate-400',
}
const AUTH_COLORS: Record<string,string> = {
  approved:'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  pending:'bg-amber-500/15 text-amber-400 border-amber-500/25',
  denied:'bg-red-500/15 text-red-400 border-red-500/25',
  expired:'bg-slate-500/15 text-slate-400 border-slate-500/25',
  under_review:'bg-blue-500/15 text-blue-400 border-blue-500/25',
  cancelled:'bg-slate-500/15 text-slate-400 border-slate-500/25',
}
const APPEAL_COLORS: Record<string,string> = {
  draft:'bg-slate-500/15 text-slate-400',
  submitted:'bg-amber-500/15 text-amber-400',
  under_review:'bg-blue-500/15 text-blue-400',
  upheld:'bg-red-500/15 text-red-400',
  overturned:'bg-emerald-500/15 text-emerald-400',
  withdrawn:'bg-slate-500/15 text-slate-400',
}

export function Billing() {
  const { orgId: ORG_ID, can } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<BillingTab>('superbills')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedSb, setSelectedSb] = useState<any>(null)
  const [showEdiModal, setShowEdiModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState<any>(null)
  const [showNewAuthModal, setShowNewAuthModal] = useState(false)
  const [generatingAppeal, setGeneratingAppeal] = useState<string|null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: superbills = [], isLoading: sbLoading } = useQuery({
    queryKey: ['superbills', ORG_ID],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('superbill')
        .select('*, patient:patient_id(first_name,last_name), provider:provider_id(first_name,last_name,specialty), encounter:encounter_id(encounter_date,chief_complaint)')
        .eq('org_id', ORG_ID).order('insert_date', { ascending: false })
      return data ?? []
    },
  })

  const { data: ediSubs = [] } = useQuery({
    queryKey: ['edi-submissions', ORG_ID],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('edi_submissions')
        .select('*, patient:patient_id(first_name,last_name)').eq('org_id', ORG_ID).order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: eraPayments = [] } = useQuery({
    queryKey: ['era-payments', ORG_ID],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('era_payments')
        .select('*, patient:patient_id(first_name,last_name)').eq('org_id', ORG_ID).order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: rejections = [] } = useQuery({
    queryKey: ['claim-rejections', ORG_ID],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('claim_rejections')
        .select('*, patient:patient_id(first_name,last_name)').eq('org_id', ORG_ID).order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: arAging = [] } = useQuery({
    queryKey: ['ar-aging', ORG_ID],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('ar_aging')
        .select('*').eq('org_id', ORG_ID).order('days_outstanding', { ascending: false })
      return data ?? []
    },
  })

  const { data: aiSuggestions = [] } = useQuery({
    queryKey: ['billing-ai', ORG_ID],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('billing_ai_suggestions')
        .select('*, encounter:encounter_id(chief_complaint,encounter_date), patient:patient_id(first_name,last_name)')
        .eq('org_id', ORG_ID).eq('status', 'pending').order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: priorAuths = [], isLoading: authLoading } = useQuery({
    queryKey: ['prior-auths', ORG_ID],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('prior_authorizations')
        .select('*, patient:patient_id(first_name,last_name), provider:provider_id(first_name,last_name)')
        .eq('org_id', ORG_ID).order('insert_date', { ascending: false })
      return data ?? []
    },
  })

  const { data: appeals = [], isLoading: appealsLoading } = useQuery({
    queryKey: ['claim-appeals', ORG_ID],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('claim_appeals')
        .select('*, patient:patient_id(first_name,last_name)')
        .eq('org_id', ORG_ID).order('insert_date', { ascending: false })
      return data ?? []
    },
  })

  const { data: secondaryClaims = [], isLoading: secondaryLoading } = useQuery({
    queryKey: ['secondary-claims', ORG_ID],
    queryFn: async () => {
      const { data } = await supabase.schema('cr').from('secondary_claims')
        .select('*, patient:patient_id(first_name,last_name)')
        .eq('org_id', ORG_ID).order('insert_date', { ascending: false })
      return data ?? []
    },
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateSbStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await supabase.schema('cr').from('superbill').update({ billing_status: status, update_date: new Date().toISOString() }).eq('superbill_id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['superbills'] }),
  })

  const submitEdi = useMutation({
    mutationFn: async (sb: any) => {
      // Server-side: generates the X12 837P and transmits via the org's
      // billing gateway (Optum/CHC) when credentials are configured;
      // otherwise stores the generated claim awaiting credentials.
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/submit-claim-837', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ superbill_id: sb.superbill_id }),
      })
      const out = await res.json()
      if (!res.ok) throw new Error(out.error ?? `Submission failed (${res.status})`)
      return out
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['superbills'] }); queryClient.invalidateQueries({ queryKey: ['edi-submissions'] }); setShowEdiModal(false) },
  })

  const [era835Msg, setEra835Msg] = useState('')
  const importEra = useMutation({
    mutationFn: async (x12: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/post-era-835', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ x12 }),
      })
      const out = await res.json()
      if (!res.ok) throw new Error(out.error ?? `Import failed (${res.status})`)
      return out
    },
    onSuccess: (out) => {
      setEra835Msg(`Posted ${out.posted}/${out.claims_in_file} claim payment(s) — ${out.payer} check ${out.check_number || 'n/a'}`)
      queryClient.invalidateQueries({ queryKey: ['era-payments'] })
      queryClient.invalidateQueries({ queryKey: ['superbills'] })
      queryClient.invalidateQueries({ queryKey: ['edi-submissions'] })
    },
    onError: (e: any) => setEra835Msg(`Import failed: ${e.message}`),
  })
  const importing835 = importEra.isPending

  const postEra = useMutation({
    mutationFn: async ({ submissionId, superbillId, patientId, amount, payer }: any) => {
      await supabase.schema('cr').from('era_payments').insert({
        submission_id: submissionId, superbill_id: superbillId, patient_id: patientId,
        org_id: ORG_ID, payer_name: payer, total_payment: amount, status: 'posted', posted_at: new Date().toISOString(),
      })
      await supabase.schema('cr').from('edi_submissions').update({ status: 'paid' }).eq('submission_id', submissionId)
      await supabase.schema('cr').from('superbill').update({ billing_status: 'paid', insurance_paid: amount }).eq('superbill_id', superbillId)
      // Auto-check for secondary insurance
      const { data: secIns } = await supabase.schema('cr').from('patient_insurance')
        .select('insurance_id, insurance_company').eq('patient_id', patientId).eq('is_secondary', true).eq('is_active', true).maybeSingle()
      if (secIns) {
        await supabase.schema('cr').from('secondary_claims').insert({
          org_id: ORG_ID, primary_sub_id: submissionId, superbill_id: superbillId,
          patient_id: patientId, claim_level: 'secondary',
          insurance_id: secIns.insurance_id, payer_name: secIns.insurance_company,
          primary_paid: amount, status: 'pending',
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edi-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['era-payments'] })
      queryClient.invalidateQueries({ queryKey: ['superbills'] })
      queryClient.invalidateQueries({ queryKey: ['secondary-claims'] })
      setShowPayModal(null)
    },
  })

  const updateRejection = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.schema('cr').from('claim_rejections')
        .update({ status, updated_at: new Date().toISOString(), ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) }).eq('rejection_id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['claim-rejections'] }),
  })

  const acceptAi = useMutation({
    mutationFn: async ({ id, encounterId, cptCodes, icdCodes }: any) => {
      await supabase.schema('cr').from('billing_ai_suggestions').update({ status: 'accepted', reviewed_at: new Date().toISOString() }).eq('suggestion_id', id)
      const sb = superbills.find((s: any) => s.encounter_id === encounterId)
      if (sb) await supabase.schema('cr').from('superbill').update({ cpt_codes: cptCodes, icd_codes: icdCodes, ai_reviewed: true, billing_status: 'ready' }).eq('superbill_id', (sb as any).superbill_id)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['billing-ai'] }); queryClient.invalidateQueries({ queryKey: ['superbills'] }) },
  })

  const updateAuthStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await supabase.schema('cr').from('prior_authorizations')
        .update({ status, update_date: new Date().toISOString(), ...(status==='approved'?{approval_date:new Date().toISOString()}:{}) }).eq('auth_id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prior-auths'] }),
  })

  const updateAppealStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await supabase.schema('cr').from('claim_appeals')
        .update({ status, update_date: new Date().toISOString(), ...(status==='submitted'?{submitted_date:new Date().toISOString().split('T')[0]}:{}) }).eq('appeal_id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['claim-appeals'] }),
  })

  const submitSecondary = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      await supabase.schema('cr').from('secondary_claims')
        .update({ status: 'submitted', submission_date: new Date().toISOString(), update_date: new Date().toISOString() }).eq('secondary_id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['secondary-claims'] }),
  })

  // ── AI Appeal Letter Generator ─────────────────────────────────────────
  const generateAppealLetter = async (rejection: any) => {
    setGeneratingAppeal(rejection.rejection_id)
    try {
      const p = rejection.patient as any
      const prompt = `You are a medical billing specialist generating a professional insurance appeal letter.

Patient: ${p?.first_name} ${p?.last_name}
Denial Reason: ${rejection.rejection_reason}
CARC Code: ${rejection.carc_code ?? 'Not specified'}
Denied Amount: $${rejection.denied_amount ?? '0'}
Rejection Type: ${rejection.rejection_type ?? 'administrative'}

Write a professional, concise insurance appeal letter that:
1. States the purpose clearly in the opening
2. Addresses the specific denial reason with clinical justification
3. References relevant medical necessity criteria
4. Requests reconsideration with supporting rationale
5. Closes professionally

Format as a complete letter. Be specific and persuasive.`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await response.json()
      const letter = data.content?.[0]?.text ?? ''

      // Save appeal with AI letter
      await supabase.schema('cr').from('claim_appeals').insert({
        org_id: ORG_ID,
        rejection_id: rejection.rejection_id,
        patient_id: rejection.patient_id,
        denial_code: rejection.carc_code,
        denial_reason: rejection.rejection_reason,
        appeal_letter: letter,
        ai_generated: true,
        ai_model: ANTHROPIC_MODEL,
        status: 'draft',
        denied_amount: rejection.denied_amount,
        deadline_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })
      queryClient.invalidateQueries({ queryKey: ['claim-appeals'] })
      setTab('appeals')
    } catch (err) {
      console.error('Appeal generation failed:', err)
    } finally {
      setGeneratingAppeal(null)
    }
  }

  // ── AI Prior Auth Predictor ───────────────────────────────────────────
  const predictAuthApproval = async (auth: any) => {
    try {
      const p = auth.patient as any
      const codes = (auth.procedure_codes ?? []).map((c: any) => c.cpt).join(', ')
      const prompt = `As a prior authorization specialist, analyze this request and respond ONLY with JSON:
{"approval_probability": <0-100>, "recommendation": "<2-3 sentences>", "risk_factors": ["<factor1>", "<factor2>"]}`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 300,
          messages: [{ role: 'user', content: `Patient: ${p?.first_name} ${p?.last_name}\nPayer: ${auth.payer_name}\nCPT codes: ${codes}\nDiagnosis: ${(auth.diagnosis_codes ?? []).join(', ')}\nUrgency: ${auth.urgency}\n\n${prompt}` }],
        }),
      })
      const data = await response.json()
      const text = data.content?.[0]?.text ?? '{}'
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      await supabase.schema('cr').from('prior_authorizations').update({
        ai_approval_prob: parsed.approval_probability,
        ai_recommendation: parsed.recommendation,
        ai_risk_factors: parsed.risk_factors ?? [],
        update_date: new Date().toISOString(),
      }).eq('auth_id', auth.auth_id)
      queryClient.invalidateQueries({ queryKey: ['prior-auths'] })
    } catch (err) { console.error('Auth prediction failed:', err) }
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalBilled   = superbills.reduce((s: number, sb: any) => s + parseFloat(sb.total_amount ?? 0), 0)
  const totalAr       = arAging.reduce((s: number, i: any) => s + parseFloat(i.amount_due ?? 0), 0)
  const totalPending  = ediSubs.filter((e: any) => e.status === 'submitted').length
  const openRej       = rejections.filter((r: any) => r.status === 'open').length
  const expiringAuths = priorAuths.filter((a: any) => {
    if (!a.expiration_date || a.status !== 'approved') return false
    const days = Math.ceil((new Date(a.expiration_date).getTime() - Date.now()) / 86400000)
    return days <= 14 && days >= 0
  }).length
  const pendingAuths  = priorAuths.filter((a: any) => a.status === 'pending').length
  const pendingSecondary = secondaryClaims.filter((s: any) => s.status === 'pending').length

  const TABS = [
    { id:'superbills' as BillingTab, label:'Superbills',   icon:FileText,    badge:superbills.filter((s:any)=>s.billing_status==='draft').length },
    { id:'ai'         as BillingTab, label:'AI Review',    icon:Activity,    badge:aiSuggestions.length },
    { id:'edi'        as BillingTab, label:'EDI Claims',   icon:Send,        badge:totalPending },
    { id:'era'        as BillingTab, label:'ERA / EOB',    icon:DollarSign },
    { id:'rejections' as BillingTab, label:'Rejections',   icon:XCircle,     badge:openRej },
    { id:'aging'      as BillingTab, label:'A/R Aging',    icon:TrendingUp },
    { id:'preauth'    as BillingTab, label:'Pre-Auth',     icon:ShieldCheck, badge:(expiringAuths + pendingAuths) || undefined },
    { id:'appeals'    as BillingTab, label:'Appeals',      icon:FileEdit,    badge:appeals.filter((a:any)=>a.status==='draft').length || undefined },
    { id:'secondary'  as BillingTab, label:'Secondary',   icon:GitBranch,   badge:pendingSecondary || undefined },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <div className="section-heading mb-1">Revenue Cycle</div>
          <h1 className="font-display font-bold text-2xl text-slate-100">Billing</h1>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label:'Total Billed',      value:formatCurrency(totalBilled), icon:DollarSign,    color:'text-gold-400' },
          { label:'Claims Pending',    value:totalPending,                icon:Clock,         color:'text-amber-400' },
          { label:'Open Rejections',   value:openRej,                     icon:AlertTriangle, color:'text-red-400' },
          { label:'AI Review Needed',  value:aiSuggestions.length,        icon:Activity,      color:'text-purple-400' },
          { label:'Total A/R',         value:formatCurrency(totalAr),     icon:TrendingUp,    color:'text-blue-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="hud-panel hud-bracket px-3 py-2.5">
            <div className="flex items-center justify-between mb-1"><div className="data-label text-[10px]">{label}</div><Icon size={12} className={color} /></div>
            <div className="font-display font-bold text-lg text-slate-100">{value}</div>
          </div>
        ))}
      </div>

      {/* Expiring Auth Alert */}
      {expiringAuths > 0 && (
        <div className="hud-panel px-4 py-2.5 border-amber-500/30 bg-amber-500/5 flex items-center gap-3 cursor-pointer" onClick={() => setTab('preauth')}>
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-300 font-mono">{expiringAuths} prior authorization{expiringAuths>1?'s':''} expiring within 14 days — action required</span>
        </div>
      )}

      {/* Secondary Claims Alert */}
      {pendingSecondary > 0 && (
        <div className="hud-panel px-4 py-2.5 border-blue-500/30 bg-blue-500/5 flex items-center gap-3 cursor-pointer" onClick={() => setTab('secondary')}>
          <GitBranch size={14} className="text-blue-400 flex-shrink-0" />
          <span className="text-xs text-blue-300 font-mono">{pendingSecondary} secondary claim{pendingSecondary>1?'s':''} ready for submission</span>
        </div>
      )}

      {/* Tabs */}
      <div className="hud-panel px-1 py-1 flex gap-0.5 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-mono transition-colors whitespace-nowrap flex-shrink-0',
              tab === id ? 'bg-gold-500/15 text-gold-300' : 'text-slate-500 hover:text-gold-400')}>
            <Icon size={12} />{label}
            {badge != null && badge > 0 && <span className={cn('ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold',
              id==='rejections'?'bg-red-500/20 text-red-400':
              id==='ai'?'bg-purple-500/20 text-purple-400':
              id==='preauth'?'bg-amber-500/20 text-amber-400':
              id==='appeals'?'bg-orange-500/20 text-orange-400':
              id==='secondary'?'bg-blue-500/20 text-blue-400':
              'bg-gold-500/20 text-gold-400')}>{badge}</span>}
          </button>
        ))}
      </div>

      {/* ── SUPERBILLS ── */}
      {tab === 'superbills' && (
        <div className="space-y-3">
          <div className="hud-panel px-4 py-2.5 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input value={search} onChange={e => setSearch(e.target.value)} className="hud-input pl-7 text-xs" placeholder="Search patient..." />
            </div>
            <div className="flex border border-gold-500/20 rounded-sm overflow-hidden">
              {['all','draft','ready','submitted','paid','denied'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn('px-2.5 py-1.5 text-[10px] font-mono uppercase transition-colors',
                    statusFilter===s?'bg-gold-500/15 text-gold-300':'text-slate-600 hover:text-gold-400')}>{s}</button>
              ))}
            </div>
          </div>
          {sbLoading ? <div className="flex justify-center py-12"><Loader size={16} className="animate-spin text-gold-500" /></div> : (
            <div className="space-y-2">
              {superbills.filter((sb: any) => {
                const p = sb.patient as any
                const nameMatch = !search || `${p?.first_name} ${p?.last_name}`.toLowerCase().includes(search.toLowerCase())
                const statusMatch = statusFilter==='all' || (sb.billing_status??'draft')===statusFilter
                return nameMatch && statusMatch
              }).map((sb: any) => {
                const p = sb.patient as any; const prov = sb.provider as any; const enc = sb.encounter as any
                const status = sb.billing_status ?? 'draft'
                const sc = SB_STATUS_COLORS[status] ?? SB_STATUS_COLORS.draft
                return (
                  <div key={sb.superbill_id} className="hud-panel px-4 py-3 hover:border-gold-500/25 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn('badge text-[9px] border', sc)}>{status}</span>
                          <span className="text-sm font-medium text-slate-200">{p?.last_name}, {p?.first_name}</span>
                          <span className="font-mono text-[10px] text-slate-600">SB-{sb.superbill_id}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                          {enc?.encounter_date && <span className="font-mono text-[10px] text-slate-500">{formatDate(enc.encounter_date)}</span>}
                          {prov && <span className="font-mono text-[10px] text-slate-500">{prov.first_name} {prov.last_name}</span>}
                          {(sb.cpt_codes ?? []).length > 0 && <span className="font-mono text-[10px] text-gold-400">CPT: {Array.isArray(sb.cpt_codes)?sb.cpt_codes.join(', '):sb.cpt_codes}</span>}
                        </div>
                        {enc?.chief_complaint && <div className="text-[11px] text-slate-500 mt-1 italic truncate">{enc.chief_complaint}</div>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-display font-bold text-lg text-gold-400">{formatCurrency(parseFloat(sb.total_amount ?? 0))}</div>
                        <div className="flex gap-2 mt-1.5 justify-end">
                          {status==='draft' && <button onClick={() => updateSbStatus.mutate({id:sb.superbill_id,status:'ready'})} className="btn-secondary text-[10px] py-1 px-2">Mark Ready</button>}
                          {status==='ready' && <button onClick={() => { setSelectedSb(sb); setShowEdiModal(true) }} className="btn-primary text-[10px] py-1 px-2"><Send size={10}/> Submit EDI</button>}
                          {status==='submitted' && <button onClick={() => setShowPayModal(sb)} className="btn-primary text-[10px] py-1 px-2">Post ERA</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {superbills.length===0 && <div className="text-center py-12 text-slate-600 font-mono text-xs">No superbills found.</div>}
            </div>
          )}
        </div>
      )}

      {/* ── AI REVIEW ── */}
      {tab === 'ai' && (
        <div className="space-y-3">
          {aiSuggestions.length===0 ? (
            <div className="hud-panel px-4 py-12 text-center"><CheckCircle size={28} className="text-emerald-400 mx-auto mb-3"/><div className="font-mono text-xs text-slate-500">No pending AI billing suggestions.</div></div>
          ) : aiSuggestions.map((sug: any) => {
            const p = sug.patient as any; const enc = sug.encounter as any
            const dc = sug.denial_risk_score>=7?'text-red-400':sug.denial_risk_score>=4?'text-amber-400':'text-emerald-400'
            return (
              <div key={sug.suggestion_id} className="hud-panel p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge bg-purple-500/15 text-purple-400 border-purple-500/25 text-[9px]">AI Suggestion</span>
                      <span className="text-sm font-medium text-slate-200">{p?.last_name}, {p?.first_name}</span>
                    </div>
                    {enc?.chief_complaint && <div className="text-xs text-slate-500 italic">{enc.chief_complaint}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="data-label mb-0.5">Denial Risk</div>
                    <div className={cn('font-display font-bold text-xl', dc)}>{sug.denial_risk_score}/10</div>
                    <div className={cn('font-mono text-[10px] capitalize', dc)}>{sug.denial_risk_label}</div>
                  </div>
                </div>
                <div>
                  <div className="data-label mb-1.5">Suggested CPT</div>
                  <div className="space-y-1">
                    {(sug.suggested_cpt_codes??[]).map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-1.5 bg-navy-700/50 rounded-sm">
                        <span className="font-mono text-xs text-gold-400 w-14 flex-shrink-0">{c.code}</span>
                        <span className="text-xs text-slate-300 flex-1">{c.description}</span>
                        <span className="font-mono text-[10px] text-emerald-400">{Math.round((c.confidence??0)*100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                {(sug.denial_risk_factors??[]).length>0 && (
                  <div className="px-3 py-2 bg-red-500/5 border border-red-500/15 rounded-sm">
                    <div className="data-label mb-1 text-red-400">Risk factors</div>
                    {sug.denial_risk_factors.map((f: string, i: number) => <div key={i} className="text-xs text-slate-400">• {f}</div>)}
                  </div>
                )}
                {sug.coding_notes && <div className="px-3 py-2 bg-navy-700/40 rounded-sm"><div className="data-label mb-0.5">Coding notes</div><div className="text-xs text-slate-400">{sug.coding_notes}</div></div>}
                <div className="flex gap-2 justify-end">
                  <button onClick={() => acceptAi.mutate({ id:sug.suggestion_id, encounterId:sug.encounter_id, cptCodes:(sug.suggested_cpt_codes??[]).map((c:any)=>c.code), icdCodes:(sug.suggested_icd_codes??[]).map((c:any)=>c.code) })} disabled={acceptAi.isPending} className="btn-primary text-xs">
                    <CheckCircle size={12}/> Accept & Apply
                  </button>
                  <button onClick={() => supabase.schema('cr').from('billing_ai_suggestions').update({status:'rejected'}).eq('suggestion_id',sug.suggestion_id).then(()=>queryClient.invalidateQueries({queryKey:['billing-ai']}))} className="btn-secondary text-xs">Reject</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── EDI ── */}
      {tab==='edi' && (
        <div className="hud-panel overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gold-500/10"><div className="font-mono text-xs text-slate-500">837P submissions to clearinghouse</div></div>
          {ediSubs.length===0 ? <div className="px-4 py-12 text-center text-slate-600 font-mono text-xs">No EDI submissions yet.</div> : (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gold-500/8">{['Ref #','Patient','Payer','Charges','Status','Submitted',''].map(h=><th key={h} className="text-left px-4 py-2 data-label">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gold-500/5">
                {ediSubs.map((sub: any) => {
                  const p = sub.patient as any
                  const sc: Record<string,string> = {queued:'text-slate-400',submitted:'text-amber-400',accepted:'text-blue-400',paid:'text-emerald-400',denied:'text-red-400'}
                  return (
                    <tr key={sub.submission_id} className="hover:bg-gold-500/3">
                      <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">{sub.internal_ref?.slice(0,12)}</td>
                      <td className="px-4 py-2.5 text-slate-200">{p?.last_name}, {p?.first_name}</td>
                      <td className="px-4 py-2.5 text-slate-400">{sub.payer_name}</td>
                      <td className="px-4 py-2.5 font-mono text-gold-400">{formatCurrency(parseFloat(sub.total_charges??0))}</td>
                      <td className="px-4 py-2.5"><span className={cn('font-mono text-[10px] uppercase',sc[sub.status]??'text-slate-500')}>{sub.status}</span></td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-slate-600">{sub.submitted_at?formatDate(sub.submitted_at):'—'}</td>
                      <td className="px-4 py-2.5">
                        {sub.status==='submitted' && <button onClick={()=>setShowPayModal(sub)} className="btn-primary text-[10px] py-1 px-2">Post ERA</button>}
                        {sub.status==='denied' && <button onClick={()=>supabase.schema('cr').from('claim_rejections').insert({submission_id:sub.submission_id,superbill_id:sub.superbill_id,patient_id:sub.patient_id,org_id:ORG_ID,rejection_type:'administrative',rejection_source:'payer',rejection_reason:'Denied by payer',denied_amount:sub.total_charges,status:'open',priority:'high'}).then(()=>queryClient.invalidateQueries({queryKey:['claim-rejections']}))} className="btn-secondary text-[10px] py-1 px-2 text-red-400">Create Rejection</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── ERA ── */}
      {tab==='era' && (
        <div className="hud-panel overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gold-500/10 flex items-center justify-between">
            <div className="font-mono text-xs text-slate-500">835 ERA — posted payments</div>
            {can('system','edit') && (
              <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1.5">
                {importing835 ? <Loader size={12} className="animate-spin"/> : <Upload size={12}/>}
                Import 835
                <input type="file" accept=".835,.txt,.edi,.x12,.era" className="hidden" disabled={importing835}
                  onChange={async e => {
                    const f = e.target.files?.[0]; e.target.value = ''
                    if (f) importEra.mutate(await f.text())
                  }} />
              </label>
            )}
          </div>
          {era835Msg && <div className="px-4 py-2 text-xs font-mono border-b border-gold-500/10 text-gold-300">{era835Msg}</div>}
          {eraPayments.length===0 ? <div className="px-4 py-12 text-center text-slate-600 font-mono text-xs">No ERA payments posted yet.</div> : (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gold-500/8">{['Patient','Payer','Check #','Date','Payment','Method'].map(h=><th key={h} className="text-left px-4 py-2 data-label">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gold-500/5">
                {eraPayments.map((era: any) => {
                  const p = era.patient as any
                  return (
                    <tr key={era.era_id} className="hover:bg-gold-500/3">
                      <td className="px-4 py-2.5 text-slate-200">{p?.last_name}, {p?.first_name}</td>
                      <td className="px-4 py-2.5 text-slate-400">{era.payer_name}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">{era.check_number??'—'}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">{era.check_date?formatDate(era.check_date):'—'}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-emerald-400">{formatCurrency(parseFloat(era.total_payment))}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500 uppercase">{era.payment_method}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── REJECTIONS ── */}
      {tab==='rejections' && (
        <div className="space-y-3">
          {rejections.length===0 ? <div className="hud-panel px-4 py-12 text-center"><CheckCircle size={24} className="text-emerald-400 mx-auto mb-2"/><div className="font-mono text-xs text-slate-500">No claim rejections.</div></div> : rejections.map((rej: any) => {
            const p = rej.patient as any; const sc = REJ_COLORS[rej.status]??'bg-slate-500/15 text-slate-400'
            const isGenerating = generatingAppeal === rej.rejection_id
            return (
              <div key={rej.rejection_id} className="hud-panel p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('badge text-[9px]',sc)}>{rej.status.replace('_',' ')}</span>
                      <span className={cn('badge text-[9px]',rej.priority==='urgent'?'bg-red-500/15 text-red-400':'bg-slate-500/10 text-slate-500')}>{rej.priority}</span>
                      <span className="text-sm font-medium text-slate-200">{p?.last_name}, {p?.first_name}</span>
                    </div>
                    <div className="text-xs text-slate-400">{rej.rejection_reason}</div>
                    <div className="flex gap-4 mt-1">
                      {rej.carc_code && <span className="font-mono text-[10px] text-slate-600">CARC: {rej.carc_code}</span>}
                      {rej.denied_amount && <span className="font-mono text-[10px] text-red-400">Denied: {formatCurrency(parseFloat(rej.denied_amount))}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    {rej.status==='open' && <>
                      <button onClick={()=>generateAppealLetter(rej)} disabled={isGenerating} className="btn-secondary text-xs py-1 flex items-center gap-1">
                        {isGenerating?<><Loader size={10} className="animate-spin"/>Generating...</>:<><Sparkles size={10}/>AI Appeal</>}
                      </button>
                      <button onClick={()=>updateRejection.mutate({id:rej.rejection_id,status:'appealing'})} className="btn-secondary text-xs py-1">Appeal</button>
                      <button onClick={()=>updateRejection.mutate({id:rej.rejection_id,status:'resolved'})} className="btn-primary text-xs py-1">Resubmit</button>
                    </>}
                    {rej.status==='appealing' && <>
                      <button onClick={()=>generateAppealLetter(rej)} disabled={isGenerating} className="btn-secondary text-xs py-1 flex items-center gap-1">
                        {isGenerating?<><Loader size={10} className="animate-spin"/>Generating...</>:<><Sparkles size={10}/>AI Letter</>}
                      </button>
                      <button onClick={()=>updateRejection.mutate({id:rej.rejection_id,status:'resolved'})} className="btn-primary text-xs py-1">Mark Resolved</button>
                    </>}
                  </div>
                </div>
                {rej.ai_recommendation && <div className="px-3 py-2 bg-purple-500/5 border border-purple-500/15 rounded-sm"><div className="data-label mb-0.5 text-purple-400">AI recommendation</div><div className="text-xs text-slate-400">{rej.ai_recommendation}</div></div>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── AGING ── */}
      {tab==='aging' && (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {['0-30','31-60','61-90','91-120','120+'].map(bucket => {
              const rows = arAging.filter((r:any)=>r.aging_bucket===bucket)
              const total = rows.reduce((s:number,r:any)=>s+parseFloat(r.amount_due??0),0)
              return (
                <div key={bucket} className="hud-panel px-3 py-2.5">
                  <div className={cn('font-display font-bold text-sm',AGING_COLORS[bucket])}>{bucket} days</div>
                  <div className="font-mono text-xs text-gold-400 mt-0.5">{formatCurrency(total)}</div>
                  <div className="font-mono text-[10px] text-slate-600">{rows.length} claims</div>
                </div>
              )
            })}
          </div>
          {arAging.length===0 ? <div className="hud-panel px-4 py-12 text-center"><CheckCircle size={24} className="text-emerald-400 mx-auto mb-2"/><div className="font-mono text-xs text-slate-500">No outstanding A/R.</div></div> : (
            <div className="hud-panel overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gold-500/8">{['Patient','Insurer','Days Out','Billed','Ins. Paid','Balance Due','Bucket'].map(h=><th key={h} className="text-left px-3 py-2 data-label">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gold-500/5">
                  {arAging.map((row:any)=>(
                    <tr key={row.invoice_id} className="hover:bg-gold-500/3">
                      <td className="px-3 py-2.5 text-slate-200">{row.patient_last}, {row.patient_first}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-[11px]">{row.primary_insurer??'Self-Pay'}</td>
                      <td className={cn('px-3 py-2.5 font-mono font-bold',AGING_COLORS[row.aging_bucket??'0-30'])}>{row.days_outstanding??0}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-300">{formatCurrency(parseFloat(row.total_charges??0))}</td>
                      <td className="px-3 py-2.5 font-mono text-emerald-400">{formatCurrency(parseFloat(row.insurance_paid??0))}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-gold-400">{formatCurrency(parseFloat(row.amount_due??0))}</td>
                      <td className="px-3 py-2.5"><span className={cn('font-mono text-[10px] font-bold',AGING_COLORS[row.aging_bucket??'0-30'])}>{row.aging_bucket??'0-30'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PRE-AUTH ── */}
      {tab==='preauth' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={()=>setShowNewAuthModal(true)} className="btn-primary text-xs"><ShieldCheck size={12}/> New Prior Auth</button>
          </div>
          {authLoading ? <div className="flex justify-center py-12"><Loader size={16} className="animate-spin text-gold-500"/></div> :
          priorAuths.length===0 ? <div className="hud-panel px-4 py-12 text-center"><ShieldCheck size={24} className="text-slate-600 mx-auto mb-2"/><div className="font-mono text-xs text-slate-500">No prior authorizations.</div></div> :
          priorAuths.map((auth: any) => {
            const p = auth.patient as any
            const sc = AUTH_COLORS[auth.status] ?? AUTH_COLORS.pending
            const daysLeft = auth.expiration_date ? Math.ceil((new Date(auth.expiration_date).getTime() - Date.now()) / 86400000) : null
            const expiring = daysLeft !== null && daysLeft <= 14 && daysLeft >= 0 && auth.status === 'approved'
            const unitsUsedPct = auth.units_approved ? Math.round((auth.units_used / auth.units_approved) * 100) : 0
            return (
              <div key={auth.auth_id} className={cn('hud-panel p-4 space-y-3', expiring && 'border-amber-500/30')}>
                {expiring && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/8 border border-amber-500/20 rounded-sm">
                    <AlertTriangle size={11} className="text-amber-400"/><span className="font-mono text-[10px] text-amber-300">Expires in {daysLeft} day{daysLeft!==1?'s':''} — renewal required</span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('badge text-[9px] border', sc)}>{auth.status}</span>
                      {auth.urgency !== 'routine' && <span className="badge text-[9px] bg-red-500/15 text-red-400 border-red-500/25">{auth.urgency}</span>}
                      <span className="text-sm font-medium text-slate-200">{p?.last_name}, {p?.first_name}</span>
                      {auth.auth_number && <span className="font-mono text-[10px] text-slate-600">{auth.auth_number}</span>}
                    </div>
                    <div className="text-xs text-slate-500">{auth.payer_name}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {(auth.procedure_codes??[]).map((c:any,i:number) => (
                        <span key={i} className="font-mono text-[10px] text-gold-400">{c.cpt} — {c.description}</span>
                      ))}
                    </div>
                    {auth.effective_date && <div className="font-mono text-[10px] text-slate-600 mt-1">
                      {formatDate(auth.effective_date)} → {auth.expiration_date ? formatDate(auth.expiration_date) : '—'}
                    </div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {auth.units_approved && (
                      <div className="mb-2">
                        <div className="data-label mb-1">Units</div>
                        <div className="font-mono text-xs text-slate-300">{auth.units_used ?? 0} / {auth.units_approved} used</div>
                        <div className="w-24 h-1.5 bg-navy-700/60 rounded-full mt-1 overflow-hidden ml-auto">
                          <div className={cn('h-full rounded-full', unitsUsedPct>=90?'bg-red-500':unitsUsedPct>=70?'bg-amber-500':'bg-emerald-500')} style={{width:`${Math.min(unitsUsedPct,100)}%`}}/>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 justify-end flex-wrap">
                      {auth.status==='pending' && <>
                        <button onClick={()=>predictAuthApproval(auth)} className="btn-secondary text-[10px] py-1 px-2 flex items-center gap-1"><Sparkles size={10}/>AI Predict</button>
                        <button onClick={()=>updateAuthStatus.mutate({id:auth.auth_id,status:'approved'})} className="btn-primary text-[10px] py-1 px-2">Approve</button>
                        <button onClick={()=>updateAuthStatus.mutate({id:auth.auth_id,status:'denied'})} className="btn-secondary text-[10px] py-1 px-2 text-red-400">Deny</button>
                      </>}
                      {auth.status==='approved' && expiring && <button onClick={()=>updateAuthStatus.mutate({id:auth.auth_id,status:'pending'})} className="btn-primary text-[10px] py-1 px-2">Request Renewal</button>}
                    </div>
                  </div>
                </div>
                {auth.ai_recommendation && (
                  <div className="px-3 py-2 bg-purple-500/5 border border-purple-500/15 rounded-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles size={10} className="text-purple-400"/>
                      <div className="data-label text-purple-400">AI Prediction</div>
                      {auth.ai_approval_prob != null && (
                        <span className={cn('font-mono text-[10px] font-bold ml-auto', auth.ai_approval_prob>=70?'text-emerald-400':auth.ai_approval_prob>=50?'text-amber-400':'text-red-400')}>
                          {auth.ai_approval_prob}% approval probability
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{auth.ai_recommendation}</div>
                    {(auth.ai_risk_factors??[]).length>0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {auth.ai_risk_factors.map((f:string,i:number) => <span key={i} className="font-mono text-[9px] bg-red-500/8 text-red-400 px-2 py-0.5 rounded-sm">⚠ {f}</span>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── APPEALS ── */}
      {tab==='appeals' && (
        <div className="space-y-3">
          {appealsLoading ? <div className="flex justify-center py-12"><Loader size={16} className="animate-spin text-gold-500"/></div> :
          appeals.length===0 ? (
            <div className="hud-panel px-4 py-12 text-center">
              <FileEdit size={24} className="text-slate-600 mx-auto mb-2"/>
              <div className="font-mono text-xs text-slate-500 mb-3">No appeal letters yet.</div>
              <div className="text-xs text-slate-600">Go to Rejections tab and click "AI Appeal" to generate a letter with Claude AI.</div>
            </div>
          ) : appeals.map((appeal: any) => {
            const p = appeal.patient as any
            const sc = APPEAL_COLORS[appeal.status] ?? APPEAL_COLORS.draft
            const daysLeft = appeal.deadline_date ? Math.ceil((new Date(appeal.deadline_date).getTime() - Date.now()) / 86400000) : null
            return (
              <div key={appeal.appeal_id} className="hud-panel p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('badge text-[9px]', sc)}>{appeal.status}</span>
                      {appeal.ai_generated && <span className="badge text-[9px] bg-purple-500/15 text-purple-400"><Sparkles size={8} className="inline mr-0.5"/>AI Generated</span>}
                      <span className="text-sm font-medium text-slate-200">{p?.last_name}, {p?.first_name}</span>
                      <span className="font-mono text-[10px] text-gold-400">{appeal.appeal_type.replace('_',' ')}</span>
                    </div>
                    <div className="text-xs text-slate-400">{appeal.denial_reason}</div>
                    <div className="flex gap-4 mt-1">
                      {appeal.denial_code && <span className="font-mono text-[10px] text-slate-600">CARC: {appeal.denial_code}</span>}
                      {appeal.denied_amount && <span className="font-mono text-[10px] text-red-400">Denied: {formatCurrency(parseFloat(appeal.denied_amount))}</span>}
                      {daysLeft !== null && <span className={cn('font-mono text-[10px]', daysLeft<=7?'text-red-400':'text-amber-400')}>Deadline: {daysLeft}d</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {appeal.status==='draft' && <button onClick={()=>updateAppealStatus.mutate({id:appeal.appeal_id,status:'submitted'})} className="btn-primary text-xs py-1"><Send size={10}/> Submit</button>}
                    {appeal.status==='submitted' && <button onClick={()=>updateAppealStatus.mutate({id:appeal.appeal_id,status:'under_review'})} className="btn-secondary text-xs py-1">Under Review</button>}
                    {appeal.status==='under_review' && <>
                      <button onClick={()=>updateAppealStatus.mutate({id:appeal.appeal_id,status:'overturned'})} className="btn-primary text-xs py-1 text-emerald-400">Overturned ✓</button>
                      <button onClick={()=>updateAppealStatus.mutate({id:appeal.appeal_id,status:'upheld'})} className="btn-secondary text-xs py-1 text-red-400">Upheld ✗</button>
                    </>}
                  </div>
                </div>
                {appeal.appeal_letter && (
                  <details className="group">
                    <summary className="cursor-pointer text-[10px] font-mono text-slate-500 hover:text-gold-400 transition-colors">View appeal letter ▸</summary>
                    <div className="mt-2 px-3 py-3 bg-navy-700/30 rounded-sm border border-gold-500/10">
                      <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{appeal.appeal_letter}</pre>
                    </div>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── SECONDARY ── */}
      {tab==='secondary' && (
        <div className="space-y-3">
          <div className="hud-panel px-4 py-2.5 border-b border-gold-500/10 flex items-center gap-2">
            <GitBranch size={12} className="text-blue-400"/>
            <div className="font-mono text-xs text-slate-500">Secondary & tertiary claims — auto-created when primary ERA is posted</div>
          </div>
          {secondaryLoading ? <div className="flex justify-center py-12"><Loader size={16} className="animate-spin text-gold-500"/></div> :
          secondaryClaims.length===0 ? (
            <div className="hud-panel px-4 py-12 text-center">
              <GitBranch size={24} className="text-slate-600 mx-auto mb-2"/>
              <div className="font-mono text-xs text-slate-500">No secondary claims yet.</div>
              <div className="text-xs text-slate-600 mt-1">Secondary claims are auto-created when you post ERA payments for patients with secondary insurance.</div>
            </div>
          ) : (
            <div className="hud-panel overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gold-500/8">{['Patient','Level','Secondary Payer','Primary Paid','Billed','Status',''].map(h=><th key={h} className="text-left px-4 py-2 data-label">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gold-500/5">
                  {secondaryClaims.map((sc2: any) => {
                    const p = sc2.patient as any
                    const statusColors: Record<string,string> = {pending:'text-amber-400',submitted:'text-blue-400',paid:'text-emerald-400',denied:'text-red-400',adjusted:'text-purple-400'}
                    return (
                      <tr key={sc2.secondary_id} className="hover:bg-gold-500/3">
                        <td className="px-4 py-2.5 text-slate-200">{p?.last_name}, {p?.first_name}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('font-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded-sm', sc2.claim_level==='secondary'?'bg-blue-500/15 text-blue-400':'bg-purple-500/15 text-purple-400')}>
                            {sc2.claim_level}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">{sc2.payer_name ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-emerald-400">{formatCurrency(parseFloat(sc2.primary_paid??0))}</td>
                        <td className="px-4 py-2.5 font-mono text-gold-400">{sc2.billed_amount?formatCurrency(parseFloat(sc2.billed_amount)):'—'}</td>
                        <td className="px-4 py-2.5"><span className={cn('font-mono text-[10px] uppercase', statusColors[sc2.status]??'text-slate-500')}>{sc2.status}</span></td>
                        <td className="px-4 py-2.5">
                          {sc2.status==='pending' && <button onClick={()=>submitSecondary.mutate({id:sc2.secondary_id})} disabled={submitSecondary.isPending} className="btn-primary text-[10px] py-1 px-2"><Send size={10}/> Submit</button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}

      {/* EDI Modal */}
      {showEdiModal && selectedSb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80">
          <div className="hud-panel w-full max-w-md">
            <div className="px-5 py-4 border-b border-gold-500/10 flex items-center justify-between">
              <div className="section-heading">Submit 837P EDI Claim</div>
              <button onClick={()=>setShowEdiModal(false)} className="btn-ghost text-xs">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="hud-panel px-4 py-3 space-y-2">
                {[
                  {label:'Patient', value:`${(selectedSb.patient as any)?.last_name}, ${(selectedSb.patient as any)?.first_name}`},
                  {label:'CPT', value:Array.isArray(selectedSb.cpt_codes)?selectedSb.cpt_codes.join(', '):selectedSb.cpt_codes},
                  {label:'Charges', value:formatCurrency(parseFloat(selectedSb.total_amount??0))},
                  {label:'Clearinghouse', value:'Change Healthcare (837P X12 5010)'},
                ].map(({label,value})=>(
                  <div key={label} className="flex gap-3"><span className="data-label w-28 flex-shrink-0">{label}</span><span className="text-xs text-slate-300 font-mono">{value}</span></div>
                ))}
              </div>
              <div className="px-3 py-2 bg-amber-500/5 border border-amber-500/15 rounded-sm text-xs text-amber-300">The X12 837P claim is generated and stored now; live transmission to Optum/Change Healthcare activates automatically once clearinghouse credentials are configured (super admin).</div>
            </div>
            <div className="px-5 py-4 border-t border-gold-500/10 flex justify-end gap-3">
              <button onClick={()=>setShowEdiModal(false)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={()=>submitEdi.mutate(selectedSb)} disabled={submitEdi.isPending} className="btn-primary text-xs">
                {submitEdi.isPending?<><Loader size={12} className="animate-spin"/>Submitting...</>:<><Send size={12}/>Submit 837P</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERA Post Modal */}
      {showPayModal && (
        <EraModal submission={showPayModal}
          onPost={(amt:number)=>postEra.mutate({submissionId:showPayModal.submission_id,superbillId:showPayModal.superbill_id,patientId:showPayModal.patient_id,amount:amt,payer:showPayModal.payer_name})}
          onClose={()=>setShowPayModal(null)} posting={postEra.isPending}/>
      )}

      {/* New Prior Auth Modal */}
      {showNewAuthModal && (
        <NewAuthModal onClose={()=>setShowNewAuthModal(false)} onSuccess={()=>{queryClient.invalidateQueries({queryKey:['prior-auths']});setShowNewAuthModal(false)}}/>
      )}
    </div>
  )
}

function EraModal({ submission, onPost, onClose, posting }: any) {
  const [amount, setAmount] = useState(submission.total_charges ?? '')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80">
      <div className="hud-panel w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gold-500/10 flex items-center justify-between">
          <div className="section-heading">Post ERA Payment</div>
          <button onClick={onClose} className="btn-ghost text-xs">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="font-mono text-xs text-slate-500">Payer: {submission.payer_name}</div>
          <div>
            <label className="data-label block mb-1.5">Payment Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="hud-input pl-6 font-mono" step={0.01}/>
            </div>
          </div>
          <div className="px-3 py-2 bg-blue-500/5 border border-blue-500/15 rounded-sm text-xs text-blue-300">
            If patient has secondary insurance, a secondary claim will be auto-created.
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gold-500/10 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button onClick={()=>onPost(parseFloat(amount))} disabled={posting||!amount} className="btn-primary text-xs">
            {posting?<><Loader size={12} className="animate-spin"/>Posting...</>:'Post Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NewAuthModal({ onClose, onSuccess }: any) {
  const [form, setForm] = useState({ patient_id:'', payer_name:'', cpt_code:'', cpt_desc:'', units:'', urgency:'routine', notes:'' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    setSaving(true)
    try {
      await supabase.schema('cr').from('prior_authorizations').insert({
        org_id: ORG_ID,
        patient_id: parseInt(form.patient_id),
        payer_name: form.payer_name,
        procedure_codes: form.cpt_code ? [{ cpt: form.cpt_code, description: form.cpt_desc, units: parseInt(form.units||'1') }] : [],
        urgency: form.urgency,
        clinical_notes: form.notes,
        status: 'pending',
        request_date: new Date().toISOString(),
      })
      onSuccess()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80">
      <div className="hud-panel w-full max-w-md">
        <div className="px-5 py-4 border-b border-gold-500/10 flex items-center justify-between">
          <div className="section-heading">New Prior Authorization</div>
          <button onClick={onClose} className="btn-ghost text-xs">✕</button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { label:'Patient ID', key:'patient_id', type:'number', placeholder:'Patient ID' },
            { label:'Payer / Insurance', key:'payer_name', placeholder:'e.g. Aetna PPO' },
            { label:'CPT Code', key:'cpt_code', placeholder:'e.g. 90837' },
            { label:'Procedure Description', key:'cpt_desc', placeholder:'e.g. Psychotherapy 60 min' },
            { label:'Units Requested', key:'units', type:'number', placeholder:'e.g. 12' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="data-label block mb-1.5">{label}</label>
              <input type={type??'text'} value={(form as any)[key]} onChange={e=>set(key,e.target.value)} className="hud-input text-xs" placeholder={placeholder}/>
            </div>
          ))}
          <div>
            <label className="data-label block mb-1.5">Urgency</label>
            <div className="flex border border-gold-500/20 rounded-sm overflow-hidden">
              {['routine','urgent','emergent'].map(u=>(
                <button key={u} onClick={()=>set('urgency',u)} className={cn('flex-1 px-3 py-1.5 text-[10px] font-mono uppercase transition-colors', form.urgency===u?'bg-gold-500/15 text-gold-300':'text-slate-600 hover:text-gold-400')}>{u}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="data-label block mb-1.5">Clinical Notes</label>
            <textarea rows={3} value={form.notes} onChange={e=>set('notes',e.target.value)} className="hud-input text-xs resize-none" placeholder="Medical necessity documentation..."/>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gold-500/10 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.patient_id||!form.payer_name} className="btn-primary text-xs">
            {saving?<><Loader size={12} className="animate-spin"/>Saving...</>:'Submit Auth Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Billing
