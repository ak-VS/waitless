'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function StaffLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter email and password'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/restaurant/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('waitless_staff_token', data.token);
        localStorage.setItem('waitless_restaurant', JSON.stringify(data.restaurant));
        router.push('/staff/dashboard');
      } else {
        setError(data.error || 'Invalid credentials');
        setLoading(false);
      }
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Jost',sans-serif", fontWeight: 300 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');`}</style>

      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: 'var(--text)', fontWeight: 300 }}>
          Wait<em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>less</em>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, color: 'var(--text)', marginBottom: 4 }}>Staff Login</div>
          <div style={{ fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 32 }}>Restaurant dashboard access</div>

          <label style={{ fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Email</label>
          <input
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', fontFamily: "'Jost',sans-serif", fontSize: 14, padding: '11px 12px', borderRadius: 3, outline: 'none', marginBottom: 14 }}
            type="email" placeholder="restaurant@email.com"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />

          <label style={{ fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Password</label>
          <input
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', fontFamily: "'Jost',sans-serif", fontSize: 14, padding: '11px 12px', borderRadius: 3, outline: 'none', marginBottom: 20 }}
            type="password" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />

          {error && (
            <div style={{ background: 'rgba(201,76,76,.1)', border: '1px solid #c94c4c', borderRadius: 3, padding: '10px 12px', fontSize: 11, color: '#e88080', marginBottom: 14, lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin} disabled={loading}
            style={{ width: '100%', background: 'var(--gold)', border: 'none', color: '#0d0d0d', fontFamily: "'Jost',sans-serif", fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', padding: 14, borderRadius: 3, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: loading ? .7 : 1 }}>
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>

          <div style={{ textAlign: 'center', fontSize: 9, color: 'var(--text3)', marginTop: 20, letterSpacing: '.5px' }}>
            Powered by <span style={{ color: 'var(--gold-dim)' }}>Waitless</span>
          </div>
        </div>
      </div>
    </div>
  );
}