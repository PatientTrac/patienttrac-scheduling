import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function AdminShell() {
  const navigate = useNavigate()
  const links = [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/facilities', label: 'Facilities' },
    { to: '/admin/appt-types', label: 'Appt Types' },
    { to: '/admin/roles', label: 'Roles' },
    { to: '/admin/audit', label: 'Audit Log' },
    { to: '/admin/settings', label: 'Settings' },
  ]
  const signOut = async () => { await supabase.auth.signOut(); navigate('/admin/login') }
  return (
    <div style={{ minHeight:'100vh', background:'#060e1c', display:'flex', fontFamily:'sans-serif' }}>
      <div style={{ width:200, background:'#0a1628', borderRight:'1px solid rgba(201,169,110,0.15)', padding:'24px 0', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'0 20px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:16 }}>
          <div style={{ color:'#c9a96e', fontSize:16, fontWeight:600 }}>PatientTracForge</div>
          <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, marginTop:2 }}>Admin Portal</div>
        </div>
        {links.map(l => (
          <NavLink key={l.to} to={l.to} end={l.end} style={({ isActive }) => ({ display:'block', padding:'9px 20px', fontSize:13, color: isActive ? '#c9a96e' : 'rgba(255,255,255,0.5)', background: isActive ? 'rgba(201,169,110,0.08)' : 'transparent', textDecoration:'none', borderLeft: isActive ? '2px solid #c9a96e' : '2px solid transparent' })}>{l.label}</NavLink>
        ))}
        <div style={{ marginTop:'auto', padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={signOut} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:12, cursor:'pointer' }}>Sign out</button>
        </div>
      </div>
      <div style={{ flex:1, overflow:'auto' }}><Outlet /></div>
    </div>
  )
}
