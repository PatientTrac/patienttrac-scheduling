import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, FileText, AlertTriangle, CheckCircle, Clock, Send, XCircle, Search, Loader, TrendingUp, Activity } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn, formatDate, formatCurrency } from '@/lib/utils'

const ORG_ID = '00000000-0000-0000-0000-000000000001'
type BillingTab = 'superbills'|'ai'|'edi'|'era'|'rejections'|'aging'

const SB_STATUS_COLORS: Record<string,string> = {
  draft:'bg-slate-500/15 text-slate-400 border-slate-500/25', ready:'bg-blue-500/15 text-blue-400 border-blue-500/25',
  submitted:'bg-amber-500/15 text-amber-400 border-amber-500/25', paid:'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  denied:'bg-red-500/15 text-red-400 border-red-500/25', partial:'bg-purple-500/15 text-purple-400 border-purple-500/25',
}
const AGING_COLORS: Record<string,string> = {
  '0-30':'text-emerald-400','31-60':'text-gold-400','61-90':'text-amber-400','91-120':'text-orange-400','120+':'text-red-400'
}
const REJ_COLORS: Record<string,string> = {
  open:'bg-red-500/15 text-red-400', in_review:'bg-amber-500/15 text-amber-400',
  appealing:'bg-orange-500/15 text-orange-400', resolved:'bg-emerald-500/15 text-emerald-400',
  written_off:'bg-slate-500/15 text-slate-400',
}

export function Billing() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<BillingTab>('superbills')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedSb, setSelectedSb] = useState<any>(null)
  const [showEdiModal, setShowEdiModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState<any>(null)

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

  const updateSbStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await supabase.schema('cr').from('superbill').update({ billing_status: status, update_date: new Date().toISOString() }).eq('superbill_id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['superbills'] }),
  })

  const submitEdi = useMutation({
    mutationFn: async (sb: any) => {
      const { data: ins } = await supabase.schema('cr').from('patient_insurance')
        .select('insurance_id, insurance_company').eq('patient_id', sb.patient_id).eq('is_primary', true).eq('is_active', true).single()
      await supabase.schema('cr').from('edi_submissions').insert({
        superbill_id: sb.superbill_id, patient_id: sb.patient_id, org_id: ORG_ID,
        insurance_id: ins?.insurance_id, payer_name: ins?.insurance_company ?? 'Unknown',
        status: 'submitted', submitted_at: new Date().toISOString(),
        total_charges: sb.total_amount, internal_ref: `PTF-${Date.now()}`,
      })
      await supabase.schema('cr').from('superbill')
        .update({ billing_status: 'submitted', submitted: true, submit_date: new Date().toISOString() }).eq('superbill_id', sb.superbill_id)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['superbills'] }); queryClient.invalidateQueries({ queryKey: ['edi-submissions'] }); setShowEdiModal(false) },
  })

  const postEra = useMutation({
    mutationFn: async ({ submissionId, superbillId, patientId, amount, payer }: any) => {
      await supabase.schema('cr').from('era_payments').insert({
        submission_id: submissionId, superbill_id: superbillId, patient_id: patientId,
        org_id: ORG_ID, payer_name: payer, total_payment: amount, status: 'posted', posted_at: new Date().toISOString(),
      })
      await supabase.schema('cr').from('edi_submissions').update({ status: 'paid' }).eq('submission_id', submissionId)
      await supabase.schema('cr').from('superbill').update({ billing_status: 'paid', insurance_paid: amount }).eq('superbill_id', superbillId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edi-submissions'] }); queryClient.invalidateQueries({ queryKey: ['era-payments'] })
      queryClient.invalidateQueries({ queryKey: ['superbills'] }); setShowPayModal(null)
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

  const totalBilled = superbills.reduce((s: number, sb: any) => s + parseFloat(sb.total_amount ?? 0), 0)
  const totalAr = arAging.reduce((s: number, i: any) => s + parseFloat(i.amount_due ?? 0), 0)
  const totalPending = ediSubs.filter((e: any) => e.status === 'submitted').length
  const openRej = rejections.filter((r: any) => r.status === 'open').length

  const TABS = [
    { id: 'superbills' as BillingTab, label: 'Superbills',  icon: FileText,    badge: superbills.filter((s:any) => s.billing_status === 'draft').length },
    { id: 'ai'         as BillingTab, label: 'AI Review',   icon: Activity,    badge: aiSuggestions.length },
    { id: 'edi'        as BillingTab, label: 'EDI Claims',  icon: Send,        badge: totalPending },
    { id: 'era'        as BillingTab, label: 'ERA / EOB',   icon: DollarSign   },
    { id: 'rejections' as BillingTab, label: 'Rejections',  icon: XCircle,     badge: openRej },
    { id: 'aging'      as BillingTab, label: 'A/R Aging',   icon: TrendingUp   },
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
          { label:'Total Billed',     value:formatCurrency(totalBilled), icon:DollarSign,    color:'text-gold-400' },
          { label:'Claims Pending',   value:totalPending,                icon:Clock,         color:'text-amber-400' },
          { label:'Open Rejections',  value:openRej,                     icon:AlertTriangle, color:'text-red-400' },
          { label:'AI Review Needed', value:aiSuggestions.length,        icon:Activity,      color:'text-purple-400' },
          { label:'Total A/R',        value:formatCurrency(totalAr),     icon:TrendingUp,    color:'text-blue-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="hud-panel hud-bracket px-3 py-2.5">
            <div className="flex items-center justify-between mb-1"><div className="data-label text-[10px]">{label}</div><Icon size={12} className={color} /></div>
            <div className="font-display font-bold text-lg text-slate-100">{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="hud-panel px-1 py-1 flex gap-0.5 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-mono transition-colors whitespace-nowrap flex-shrink-0',
              tab === id ? 'bg-gold-500/15 text-gold-300' : 'text-slate-500 hover:text-gold-400')}>
            <Icon size={12} />{label}
            {badge != null && badge > 0 && <span className={cn('ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold',
              id==='rejections'?'bg-red-500/20 text-red-400':id==='ai'?'bg-purple-500/20 text-purple-400':'bg-gold-500/20 text-gold-400')}>{badge}</span>}
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
          {ediSubs.length===0 ? <div className="px-4 py-12 text-center text-slate-600 font-mono text-xs">No EDI submissions yet. Mark a superbill as Ready and submit.</div> : (
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
          <div className="px-4 py-2.5 border-b border-gold-500/10"><div className="font-mono text-xs text-slate-500">835 ERA — posted payments</div></div>
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
                  <div className="flex gap-2 flex-shrink-0">
                    {rej.status==='open' && <>
                      <button onClick={()=>updateRejection.mutate({id:rej.rejection_id,status:'appealing'})} className="btn-secondary text-xs py-1">Appeal</button>
                      <button onClick={()=>updateRejection.mutate({id:rej.rejection_id,status:'resolved'})} className="btn-primary text-xs py-1">Resubmit</button>
                    </>}
                    {rej.status==='appealing' && <button onClick={()=>updateRejection.mutate({id:rej.rejection_id,status:'resolved'})} className="btn-primary text-xs py-1">Mark Resolved</button>}
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
                {[{label:'Patient',value:`${(selectedSb.patient as any)?.last_name}, ${(selectedSb.patient as any)?.first_name}`},{label:'CPT',value:Array.isArray(selectedSb.cpt_codes)?selectedSb.cpt_codes.join(', '):selectedSb.cpt_codes},{label:'Charges',value:formatCurrency(parseFloat(selectedSb.total_amount??0))},{label:'Clearinghouse',value:'Change Healthcare (837P)'}].map(({label,value})=>(
                  <div key={label} className="flex gap-3"><span className="data-label w-24 flex-shrink-0">{label}</span><span className="text-xs text-slate-300 font-mono">{value}</span></div>
                ))}
              </div>
              <div className="px-3 py-2 bg-amber-500/5 border border-amber-500/15 rounded-sm text-xs text-amber-300">In production, this submits a real 837P EDI transaction. Connect your clearinghouse credentials in Settings.</div>
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
