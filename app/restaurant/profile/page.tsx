'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { getStaffSession, clearStaffSession } from '@/lib/staff-auth';

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Mumbai',
  'Asia/Delhi',
  'Asia/Bangalore',
  'Asia/Hyderabad',
  'Asia/Chennai',
];

export default function RestaurantProfile() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [error, setError] = useState('');

  const showToastMsg = (msg: string) => {
    setToast(msg); setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  useEffect(() => {
    const s = getStaffSession();
    if (!s) { router.push('/staff/login'); return; }
    setSession(s);
    // Fetch latest profile
    fetch('/api/restaurant/profile', {
      headers: { 'Authorization': `Bearer ${s.token}` }
    }).then(r => r.json()).then(d => {
      if (d.success) setForm(d.restaurant);
      setLoading(false);
    });
  }, [router]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/restaurant/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        // Update local session
        const updated = { ...session.restaurant, ...data.restaurant };
        localStorage.setItem('waitless_restaurant', JSON.stringify(updated));
        showToastMsg('Profile updated successfully ✓');
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('Network error');
    }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: "'Jost',sans-serif", fontWeight: 300 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');`}</style>

      {/* Toast */}
      <div style={{
        position: 'fixed', top: 16, left: '50%',
        transform: `translateX(-50%) translateY(${showToast ? '0' : '-100px'})`,
        background: 'var(--bg3)', border: '1px solid #2d6145', borderRadius: 8,
        padding: '10px 20px', fontSize: 11, color: 'var(--text)', zIndex: 999,
        transition: 'transform .3s cubic-bezier(.34,1.4,.64,1)', whiteSpace: 'nowrap',
      }}>{toast}</div>

      {/* Header */}
      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: 'var(--text)', fontWeight: 300 }}>
            {form.name}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8, letterSpacing: '1px' }}>Restaurant Profile</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => router.push('/staff/dashboard')}
            style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text3)', fontFamily: "'Jost',sans-serif", fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 2, cursor: 'pointer' }}>
            ← Dashboard
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Form */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px' }}>

        {/* Subscription badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: form.subscription === 'premium' ? 'rgba(201,168,76,.08)' : 'var(--bg2)', border: `1px solid ${form.subscription === 'premium' ? 'var(--gold-dim, #8a6e2f)' : 'var(--border2)'}`, borderRadius: 3, padding: '6px 14px', marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: form.subscription === 'premium' ? 'var(--gold)' : 'var(--text3)' }}>
            {form.subscription === 'premium' ? '★ Premium Plan' : 'Base Plan'}
          </div>
        </div>

        {/* Section: Basic Info */}
        <div style={{ fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 14, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
          Basic Information
        </div>

        <label style={lbl}>Restaurant name</label>
        <input style={inp} value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} placeholder="Restaurant name"/>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>City</label>
            <input style={inp} value={form.city || ''} onChange={e => setForm({...form, city: e.target.value})} placeholder="City"/>
          </div>
          <div>
            <label style={lbl}>Phone</label>
            <input style={inp} value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone number"/>
          </div>
        </div>

        <label style={lbl}>Address</label>
        <input style={inp} value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} placeholder="Full address"/>

        {/* Section: Hours */}
        <div style={{ fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 14, marginTop: 24, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
          Operating Hours
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Opens at</label>
            <input style={inp} type="time" value={form.opening_time || '11:00'} onChange={e => setForm({...form, opening_time: e.target.value})}/>
          </div>
          <div>
            <label style={lbl}>Closes at</label>
            <input style={inp} type="time" value={form.closing_time || '23:00'} onChange={e => setForm({...form, closing_time: e.target.value})}/>
          </div>
          <div>
            <label style={lbl}>Timezone</label>
            <select style={inp} value={form.timezone || 'Asia/Kolkata'} onChange={e => setForm({...form, timezone: e.target.value})}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        {/* Section: Location */}
        <div style={{ fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 14, marginTop: 24, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
          GPS Coordinates <span style={{ fontSize: 7, color: 'var(--text3)', textTransform: 'none', letterSpacing: 0 }}>(used for geofence verification)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Latitude</label>
            <input style={inp} type="number" step="0.0001" value={form.lat || ''} onChange={e => setForm({...form, lat: parseFloat(e.target.value)})} placeholder="e.g. 17.4123"/>
          </div>
          <div>
            <label style={lbl}>Longitude</label>
            <input style={inp} type="number" step="0.0001" value={form.lng || ''} onChange={e => setForm({...form, lng: parseFloat(e.target.value)})} placeholder="e.g. 78.4481"/>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 3, padding: '10px 14px', marginTop: 8, marginBottom: 24 }}>
          <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.5px', lineHeight: 1.6 }}>
            To find your coordinates: open Google Maps → right click on your restaurant location → copy the numbers shown. Format: 17.4123, 78.4481
          </div>
        </div>

        {/* Read-only info */}
        <div style={{ fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 14, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
          Account
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 3, padding: '12px 14px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '1px', textTransform: 'uppercase' }}>Email</span>
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>{form.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '1px', textTransform: 'uppercase' }}>Plan</span>
            <span style={{ fontSize: 11, color: form.subscription === 'premium' ? 'var(--gold)' : 'var(--text2)', textTransform: 'capitalize' }}>{form.subscription}</span>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(201,76,76,.1)', border: '1px solid #c94c4c', borderRadius: 3, padding: '10px 12px', fontSize: 11, color: '#e88080', marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSave} disabled={saving}
          style={{ width: '100%', background: 'var(--gold)', border: 'none', color: '#0d0d0d', fontFamily: "'Jost',sans-serif", fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', padding: 14, borderRadius: 3, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: saving ? .7 : 1 }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        <button
          onClick={() => { clearStaffSession(); router.push('/staff/login'); }}
          style={{ width: '100%', background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text3)', fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', padding: 12, borderRadius: 3, cursor: 'pointer', marginTop: 8 }}>
          Logout
        </button>
      </div>
    </div>
  );
}

const lbl: any = {
  fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase',
  color: 'var(--text3)', display: 'block', marginBottom: 5
};
const inp: any = {
  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)',
  color: 'var(--text)', fontFamily: "'Jost',sans-serif", fontSize: 13,
  padding: '10px 12px', borderRadius: 3, outline: 'none', marginBottom: 14,
  WebkitAppearance: 'none'
};