import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
export default function AuditReport() {
  const { data = [] } = useQuery({ queryKey: ['audit'], queryFn: async () => {
    const { data } = await supabase.from('auth_audit_log').select('*').order('created_at', { ascending: false }).limit(100)
    return data ?? []
  }})
  return (
    <div style={{ padding:24 }}>
      <h2 style={{ color:'#c9a96e', fontSize:18, fontWeight:600, marginBottom:20 }}>Audit Log</h2>
      <div style={{ background:'#0a1628', borderRadius:10, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)' }}>
        {data.map((r: any) => (
          <div key={r.id} style={{ padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)', display:'flex', gap:16, fontSize:12 }}>
            <span style={{ color:'rgba(255,255,255,0.3)', width:160, flexShrink:0 }}>{new Date(r.created_at).toLocaleString()}</span>
            <span style={{ color: r.success ? '#34c759' : '#f87171', width:100, flexShrink:0 }}>{r.event}</span>
            <span style={{ color:'rgba(255,255,255,0.6)' }}>{r.user_id}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
