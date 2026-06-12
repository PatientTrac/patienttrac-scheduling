import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Upload, CheckCircle, AlertTriangle, Building2, X } from 'lucide-react';

interface Facility {
  facility_id: number;
  org_id: string;
  facility_name: string;
  facility_type: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zipcode: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  npi: string;
  tax_id: string;
  specialty: string;
  logo_url: string | null;
  is_active: boolean;
}

interface Props {
  orgId: string;
}

const INPUT = {
  background: '#0d1e36',
  border: '1px solid rgba(201,169,110,0.2)',
  borderRadius: 8,
  color: '#fff',
  padding: '10px 14px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
} as React.CSSProperties;

const LABEL = {
  display: 'block',
  color: 'rgba(255,255,255,0.6)',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
};

export default function FacilitySettings({ orgId }: Props) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selected, setSelected] = useState<Facility | null>(null);
  const [form, setForm] = useState<Partial<Facility>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.schema('cr').from('facilities')
      .select('*')
      .eq('org_id', orgId)
      .order('facility_name')
      .then(({ data }) => {
        if (data?.length) {
          setFacilities(data);
          setSelected(data[0]);
          setForm(data[0]);
          setLogoPreview(data[0].logo_url);
        }
        setLoading(false);
      });
  }, [orgId]);

  const handleSelect = (f: Facility) => {
    setSelected(f);
    setForm(f);
    setLogoPreview(f.logo_url);
    setSaveStatus('idle');
  };

  const handleChange = (field: keyof Facility, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;

    // Immediate preview
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${orgId}/logos/facility-${selected.facility_id}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('revela-assets')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('revela-assets')
        .getPublicUrl(path);

      setForm(prev => ({ ...prev, logo_url: publicUrl }));
    } catch (err) {
      console.error('Logo upload failed:', err);
      alert('Logo upload failed. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const { error } = await supabase.schema('cr').from('facilities')
        .update({
          facility_name: form.facility_name,
          facility_type: form.facility_type,
          address1: form.address1,
          address2: form.address2,
          city: form.city,
          state: form.state,
          zipcode: form.zipcode,
          phone: form.phone,
          fax: form.fax,
          email: form.email,
          website: form.website,
          npi: form.npi,
          tax_id: form.tax_id,
          specialty: form.specialty,
          logo_url: form.logo_url,
        })
        .eq('facility_id', selected.facility_id);
      if (error) throw error;

      // Update local state
      setFacilities(prev => prev.map(f =>
        f.facility_id === selected.facility_id ? { ...f, ...form } as Facility : f
      ));
      setSelected({ ...selected, ...form } as Facility);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #c9a96e', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* Facility selector sidebar */}
      {facilities.length > 1 && (
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ ...LABEL }}>Facilities</div>
          {facilities.map(f => (
            <button
              key={f.facility_id}
              onClick={() => handleSelect(f)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                background: selected?.facility_id === f.facility_id ? 'rgba(201,169,110,0.15)' : 'transparent',
                border: selected?.facility_id === f.facility_id ? '1px solid rgba(201,169,110,0.4)' : '1px solid transparent',
                color: selected?.facility_id === f.facility_id ? '#c9a96e' : 'rgba(255,255,255,0.7)',
                fontSize: 13, cursor: 'pointer', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <Building2 size={14} />
              {f.facility_name}
            </button>
          ))}
        </div>
      )}

      {/* Main form */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Logo upload */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...LABEL }}>Facility Logo</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
            {/* Logo preview */}
            <div
              style={{
                width: 180, height: 100, borderRadius: 10,
                border: '2px dashed rgba(201,169,110,0.3)',
                background: '#0a1628',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', cursor: 'pointer', flexShrink: 0, position: 'relative',
              }}
              onClick={() => fileRef.current?.click()}
            >
              {logoPreview ? (
                <>
                  <img src={logoPreview} alt="Facility logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: 8 }} />
                  <button
                    onClick={e => { e.stopPropagation(); setLogoPreview(null); setForm(prev => ({ ...prev, logo_url: null })); }}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                  >
                    <X size={12} />
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                  {uploadingLogo
                    ? <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #c9a96e', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 6px' }} />
                    : <Upload size={24} style={{ marginBottom: 6 }} />}
                  <div style={{ fontSize: 11 }}>{uploadingLogo ? 'Uploading…' : 'Click to upload'}</div>
                </div>
              )}
            </div>
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingLogo}
                style={{
                  background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.4)',
                  color: '#c9a96e', borderRadius: 8, padding: '8px 16px', fontSize: 13,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                }}
              >
                <Upload size={14} />
                {uploadingLogo ? 'Uploading…' : 'Upload Logo'}
              </button>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                PNG, JPEG or WebP · Max 10 MB<br />
                Displayed on proposals, consent forms & letterhead
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleLogoSelect} />
            </div>
          </div>
        </div>

        {/* Practice details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={LABEL}>Practice / Facility Name</label>
            <input style={INPUT} value={form.facility_name ?? ''} onChange={e => handleChange('facility_name', e.target.value)} placeholder="e.g. Beverly Hills Plastic Surgery" />
          </div>
          <div>
            <label style={LABEL}>Specialty</label>
            <input style={INPUT} value={form.specialty ?? ''} onChange={e => handleChange('specialty', e.target.value)} placeholder="Plastic & Reconstructive Surgery" />
          </div>
          <div>
            <label style={LABEL}>Facility Type</label>
            <select style={{ ...INPUT }} value={form.facility_type ?? ''} onChange={e => handleChange('facility_type', e.target.value)}>
              <option value="">Select type…</option>
              <option value="ASC">Ambulatory Surgery Center</option>
              <option value="office">Office-Based Practice</option>
              <option value="hospital">Hospital</option>
              <option value="clinic">Clinic</option>
            </select>
          </div>
        </div>

        {/* Address */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={LABEL}>Address Line 1</label>
            <input style={INPUT} value={form.address1 ?? ''} onChange={e => handleChange('address1', e.target.value)} placeholder="123 Medical Plaza Drive" />
          </div>
          <div>
            <label style={LABEL}>Address Line 2</label>
            <input style={INPUT} value={form.address2 ?? ''} onChange={e => handleChange('address2', e.target.value)} placeholder="Suite 400" />
          </div>
          <div>
            <label style={LABEL}>City</label>
            <input style={INPUT} value={form.city ?? ''} onChange={e => handleChange('city', e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>State</label>
            <input style={INPUT} value={form.state ?? ''} onChange={e => handleChange('state', e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>ZIP Code</label>
            <input style={INPUT} value={form.zipcode ?? ''} onChange={e => handleChange('zipcode', e.target.value)} />
          </div>
        </div>

        {/* Contact */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={LABEL}>Phone</label>
            <input style={INPUT} value={form.phone ?? ''} onChange={e => handleChange('phone', e.target.value)} placeholder="(310) 555-0100" />
          </div>
          <div>
            <label style={LABEL}>Fax</label>
            <input style={INPUT} value={form.fax ?? ''} onChange={e => handleChange('fax', e.target.value)} placeholder="(310) 555-0101" />
          </div>
          <div>
            <label style={LABEL}>Email</label>
            <input style={INPUT} type="email" value={form.email ?? ''} onChange={e => handleChange('email', e.target.value)} placeholder="info@practice.com" />
          </div>
          <div>
            <label style={LABEL}>Website</label>
            <input style={INPUT} value={form.website ?? ''} onChange={e => handleChange('website', e.target.value)} placeholder="https://www.practice.com" />
          </div>
        </div>

        {/* Billing identifiers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={LABEL}>Facility NPI</label>
            <input style={INPUT} value={form.npi ?? ''} onChange={e => handleChange('npi', e.target.value)} placeholder="1234567890" maxLength={10} />
          </div>
          <div>
            <label style={LABEL}>Tax ID / EIN</label>
            <input style={INPUT} value={form.tax_id ?? ''} onChange={e => handleChange('tax_id', e.target.value)} placeholder="XX-XXXXXXX" />
          </div>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saving ? 'rgba(201,169,110,0.5)' : '#c9a96e',
              color: '#060e1c', border: 'none', borderRadius: 8,
              padding: '11px 28px', fontWeight: 700, fontSize: 14,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save Facility Settings'}
          </button>
          {saveStatus === 'saved' && (
            <span style={{ color: '#2ecc71', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <CheckCircle size={16} /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span style={{ color: '#e74c3c', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <AlertTriangle size={16} /> Save failed — try again
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
