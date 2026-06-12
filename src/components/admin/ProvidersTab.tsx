import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ToggleLeft, ToggleRight, UserCheck, UserX, BadgeCheck, Phone, Mail, Building2 } from 'lucide-react';

interface Provider {
  provider_id: number;
  first_name: string;
  last_name: string;
  credential: string;
  title: string;
  specialty: string;
  npi: string;
  email: string;
  cell_phone: string;
  is_active: boolean;
  insert_date: string;
  org_id: string;
}

interface Props {
  orgId: string;
}

export default function ProvidersTab({ orgId }: Props) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    supabase.schema('cr').from('providers')
      .select('provider_id,first_name,last_name,credential,title,specialty,npi,email,cell_phone,is_active,insert_date,org_id')
      .eq('org_id', orgId)
      .order('last_name')
      .then(({ data }) => { setProviders(data ?? []); setLoading(false); });
  }, [orgId]);

  const toggleActive = async (p: Provider) => {
    const next = !p.is_active;
    await supabase.schema('cr').from('providers')
      .update({ is_active: next }).eq('provider_id', p.provider_id);
    setProviders(prev => prev.map(x => x.provider_id === p.provider_id ? { ...x, is_active: next } : x));
  };

  const displayed = providers.filter(p =>
    filter === 'all' ? true : filter === 'active' ? p.is_active : !p.is_active
  );

  const active = providers.filter(p => p.is_active).length;

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Providers', value: providers.length, icon: <Building2 size={16} />, color: '#c9a96e' },
          { label: 'Active', value: active, icon: <UserCheck size={16} />, color: '#2ecc71' },
          { label: 'Inactive', value: providers.length - active, icon: <UserX size={16} />, color: 'rgba(255,255,255,0.3)' },
        ].map(stat => (
          <div key={stat.label} style={{ flex: 1, background: '#0a1628', border: '1px solid rgba(201,169,110,0.12)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: stat.color, marginBottom: 4 }}>
              {stat.icon}
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</span>
            </div>
            <div style={{ color: '#fff', fontSize: 26, fontWeight: 700 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', borderColor: filter === f ? '#c9a96e' : 'rgba(255,255,255,0.15)', background: filter === f ? 'rgba(201,169,110,0.15)' : 'transparent', color: filter === f ? '#c9a96e' : 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
            {f}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>Loading providers…</div>
        : displayed.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', border: '2px dashed rgba(255,255,255,0.08)', borderRadius: 12 }}>No providers found</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {displayed.map(p => (
                <div key={p.provider_id} style={{
                  background: '#0a1628',
                  border: `1px solid ${p.is_active ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 10, padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  opacity: p.is_active ? 1 : 0.55,
                }}>
                  {/* Avatar */}
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: p.is_active ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.05)', border: `2px solid ${p.is_active ? 'rgba(201,169,110,0.35)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: p.is_active ? '#c9a96e' : 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: 16 }}>
                    {p.first_name?.[0]}{p.last_name?.[0]}
                  </div>

                  {/* Name + credentials */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
                        {p.first_name} {p.last_name}{p.credential ? `, ${p.credential}` : ''}
                      </span>
                      {p.npi && (
                        <span style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)', color: '#c9a96e', fontSize: 10, padding: '2px 7px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <BadgeCheck size={9} /> NPI {p.npi}
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                      {p.specialty && <span>{p.specialty}</span>}
                      {p.email && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={10} />{p.email}</span>}
                      {p.cell_phone && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={10} />{p.cell_phone}</span>}
                    </div>
                  </div>

                  {/* Active toggle */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <button onClick={() => toggleActive(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {p.is_active
                        ? <ToggleRight size={28} color="#2ecc71" />
                        : <ToggleLeft size={28} color="rgba(255,255,255,0.2)" />}
                    </button>
                    <span style={{ fontSize: 10, color: p.is_active ? '#2ecc71' : 'rgba(255,255,255,0.2)', fontWeight: 600 }}>
                      {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
      }
    </div>
  );
}
