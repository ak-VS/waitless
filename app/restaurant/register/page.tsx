'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function RestaurantRegister() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    address: '',
    city: '',
    phone: '',
    subscription: 'base',
    timezone: 'Asia/Kolkata',
    opening_time: '11:00',
    closing_time: '23:00',
    lat: '',
    lng: '',
  });

  const update = (key: string, value: string) => setForm(f => ({...f, [key]: value}));

  const handleSubmit = async () => {
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/restaurant/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          address: form.address,
          city: form.city,
          phone: form.phone,
          subscription: form.subscription,
          timezone: form.timezone,
          opening_time: form.opening_time,
          closing_time: form.closing_time,
          lat: form.lat ? parseFloat(form.lat) : null,
          lng: form.lng ? parseFloat(form.lng) : null,
        })
      });
      const data = await res.json();
      if (data.success) {
        router.push('/staff/login?registered=true');
      } else {
        setError(data.error || 'Registration failed');
        setLoading(false);
      }
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');`}</style>

      {/* Header */}
      <div style={s.header}>
        <div style={{fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:'var(--text)', fontWeight:300}}>
          Wait<em style={{fontStyle:'italic', color:'#C9A84C'}}>less</em>
        </div>
        <div style={{fontSize:9, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text3)'}}>
          Restaurant Registration
        </div>
         <ThemeToggle />
      </div>

      <div style={s.body}>
        {/* Progress */}
        <div style={s.progress}>
          {[1,2,3].map(n => (
            <div key={n} style={{display:'flex', alignItems:'center', gap:8}}>
              <div style={{
                width:24, height:24, borderRadius:'50%',
                background: step >= n ? '#C9A84C' : 'var(--bg3)',
                border: `1px solid ${step >= n ? '#C9A84C' : 'var(--border2)'}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, color: step >= n ? '#0d0d0d' : 'var(--text3)',
                fontWeight:500, transition:'all .3s'
              }}>{n}</div>
              <div style={{fontSize:9, letterSpacing:'1px', textTransform:'uppercase', color: step === n ? 'var(--text)' : 'var(--text3)'}}>
                {n === 1 ? 'Account' : n === 2 ? 'Restaurant' : 'Hours & Location'}
              </div>
              {n < 3 && <div style={{flex:1, height:1, background:'var(--border)', marginLeft:4}}></div>}
            </div>
          ))}
        </div>

        {/* Step 1 — Account */}
        {step === 1 && (
          <div style={s.stepCard}>
            <div style={s.stepTitle}>Account details</div>
            <div style={s.stepSub}>You'll use these to login to your staff dashboard</div>

            <label style={s.lbl}>Restaurant email</label>
            <input style={s.inp} type="email" placeholder="restaurant@email.com"
              value={form.email} onChange={e => update('email', e.target.value)}/>

            <label style={s.lbl}>Password</label>
            <input style={s.inp} type="password" placeholder="Min 6 characters"
              value={form.password} onChange={e => update('password', e.target.value)}/>

            <label style={s.lbl}>Confirm password</label>
            <input style={s.inp} type="password" placeholder="Repeat password"
              value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)}/>

            <label style={s.lbl}>Plan</label>
            <div style={{display:'flex', gap:10, marginBottom:16}}>
              {['base', 'premium'].map(plan => (
                <div key={plan}
                  onClick={() => update('subscription', plan)}
                  style={{
                    flex:1, padding:'12px 16px', borderRadius:4, cursor:'pointer',
                    background: form.subscription === plan ? 'rgba(201,168,76,.08)' : 'var(--bg3)',
                    border: `1px solid ${form.subscription === plan ? '#C9A84C' : 'var(--border2)'}`,
                    transition:'all .2s'
                  }}>
                  <div style={{fontSize:12, color: form.subscription === plan ? '#C9A84C' : 'var(--text)', fontWeight:500, textTransform:'capitalize', marginBottom:4}}>
                    {plan === 'premium' ? '★ Premium' : 'Base'}
                  </div>
                  <div style={{fontSize:9, color:'var(--text3)', letterSpacing:'.3px', lineHeight:1.5}}>
                    {plan === 'premium' ? 'Floor map, zones, full features' : 'Simple queue, essential features'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Restaurant Info */}
        {step === 2 && (
          <div style={s.stepCard}>
            <div style={s.stepTitle}>Restaurant details</div>
            <div style={s.stepSub}>This shows on customer-facing screens</div>

            <label style={s.lbl}>Restaurant name</label>
            <input style={s.inp} placeholder="e.g. Paradise Biryani"
              value={form.name} onChange={e => update('name', e.target.value)}/>

            <label style={s.lbl}>City</label>
            <input style={s.inp} placeholder="e.g. Hyderabad"
              value={form.city} onChange={e => update('city', e.target.value)}/>

            <label style={s.lbl}>Address</label>
            <input style={s.inp} placeholder="Full address"
              value={form.address} onChange={e => update('address', e.target.value)}/>

            <label style={s.lbl}>Phone</label>
            <input style={s.inp} placeholder="+91 98765 43210"
              value={form.phone} onChange={e => update('phone', e.target.value)}/>
          </div>
        )}

        {/* Step 3 — Hours & Location */}
        {step === 3 && (
          <div style={s.stepCard}>
            <div style={s.stepTitle}>Hours & location</div>
            <div style={s.stepSub}>Used for QR time-gating and GPS geofencing</div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div>
                <label style={s.lbl}>Opens at</label>
                <input style={s.inp} type="time" value={form.opening_time}
                  onChange={e => update('opening_time', e.target.value)}/>
              </div>
              <div>
                <label style={s.lbl}>Closes at</label>
                <input style={s.inp} type="time" value={form.closing_time}
                  onChange={e => update('closing_time', e.target.value)}/>
              </div>
            </div>

            <label style={s.lbl}>Timezone</label>
            <select style={s.inp} value={form.timezone} onChange={e => update('timezone', e.target.value)}>
              {['Asia/Kolkata','Asia/Mumbai','Asia/Delhi','Asia/Bangalore','Asia/Hyderabad','Asia/Chennai'].map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>

            <label style={s.lbl}>GPS Coordinates <span style={{color:'var(--text3)',fontSize:9,textTransform:'none',letterSpacing:0}}>(for geofencing)</span></label>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div>
                <input style={s.inp} type="number" step="0.0001" placeholder="Latitude e.g. 17.4123"
                  value={form.lat} onChange={e => update('lat', e.target.value)}/>
              </div>
              <div>
                <input style={s.inp} type="number" step="0.0001" placeholder="Longitude e.g. 78.4481"
                  value={form.lng} onChange={e => update('lng', e.target.value)}/>
              </div>
            </div>
            <div style={{fontSize:9,color:'var(--text3)',lineHeight:1.6,marginBottom:16}}>
              Open Google Maps → right click your location → copy coordinates
            </div>
          </div>
        )}

        {error && (
          <div style={{background:'rgba(201,76,76,.1)',border:'1px solid #c94c4c',borderRadius:3,padding:'10px 12px',fontSize:11,color:'#e88080',marginBottom:14}}>
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{display:'flex', gap:10}}>
          {step > 1 && (
            <button onClick={() => { setStep(s => s-1); setError(''); }}
              style={{flex:1, background:'transparent', border:'1px solid var(--border2)', color:'var(--text3)', fontFamily:"'Jost',sans-serif", fontSize:10, letterSpacing:'2px', textTransform:'uppercase', padding:12, borderRadius:3, cursor:'pointer'}}>
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => {
                if (step === 1 && (!form.email || !form.password || !form.confirmPassword)) {
                  setError('Please fill all fields'); return;
                }
                if (step === 2 && (!form.name || !form.city)) {
                  setError('Restaurant name and city are required'); return;
                }
                setError('');
                setStep(s => s+1);
              }}
              style={{flex:2, background:'#C9A84C', border:'none', color:'#0d0d0d', fontFamily:"'Jost',sans-serif", fontSize:11, letterSpacing:'2.5px', textTransform:'uppercase', padding:14, borderRadius:3, cursor:'pointer', fontWeight:500}}>
              Continue →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading}
              style={{flex:2, background:'#C9A84C', border:'none', color:'#0d0d0d', fontFamily:"'Jost',sans-serif", fontSize:11, letterSpacing:'2.5px', textTransform:'uppercase', padding:14, borderRadius:3, cursor:loading?'not-allowed':'pointer', fontWeight:500, opacity:loading?.7:1}}>
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>
          )}
        </div>

        <div style={{textAlign:'center', marginTop:16, fontSize:10, color:'var(--text3)'}}>
          Already have an account?{' '}
          <span style={{color:'#C9A84C', cursor:'pointer'}} onClick={() => router.push('/staff/login')}>
            Sign in
          </span>
        </div>
      </div>

      <div style={{textAlign:'center', padding:'12px', fontSize:8, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text3)'}}>
        Powered by <span style={{color:'#8a6e2f'}}>Waitless</span>
      </div>
    </div>
  );
}

const s: any = {
  page:{background:'var(--bg)',minHeight:'100vh',display:'flex',flexDirection:'column',maxWidth:520,margin:'0 auto',fontFamily:"'Jost',sans-serif",fontWeight:300},
  header:{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'},
  body:{padding:'24px 20px 32px',flex:1},
  progress:{display:'flex',alignItems:'center',gap:6,marginBottom:24},
  stepCard:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'20px',marginBottom:16},
  stepTitle:{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:'var(--text)',marginBottom:4},
  stepSub:{fontSize:9,letterSpacing:'1px',color:'var(--text3)',marginBottom:18,textTransform:'uppercase'},
  lbl:{fontSize:8,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',display:'block',marginBottom:5},
  inp:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',color:'var(--text)',fontFamily:"'Jost',sans-serif",fontSize:13,padding:'10px 12px',borderRadius:3,outline:'none',marginBottom:14,WebkitAppearance:'none'},
};