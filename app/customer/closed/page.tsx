'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ClosedContent() {
  const searchParams = useSearchParams();
  const restaurant_id = searchParams.get('r');
  const [restaurant, setRestaurant] = useState<any>(null);

  useEffect(() => {
    if (!restaurant_id) return;
    fetch(`/api/restaurant/info?id=${restaurant_id}`)
      .then(r => r.json())
      .then(d => setRestaurant(d.restaurant));
  }, [restaurant_id]);

  return (
    <div style={{
      background: 'var(--bg)', minHeight: '100vh', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', fontFamily: "'Jost',sans-serif", fontWeight: 300,
      maxWidth: 480, margin: '0 auto'
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');`}</style>

      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20
      }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="11" stroke="var(--text3)" strokeWidth="1.5"/>
          <path d="M14 8v6l4 4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      <div style={{
        fontFamily: "'Cormorant Garamond',serif", fontSize: 28,
        color: 'var(--text)', textAlign: 'center', marginBottom: 8
      }}>
        We're closed right now
      </div>

      <div style={{
        fontSize: 11, color: 'var(--text3)', textAlign: 'center',
        lineHeight: 1.7, marginBottom: 20
      }}>
        {restaurant?.name} is not accepting walk-ins at this time.
        Please come back during opening hours.
      </div>

      {restaurant && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '14px 20px', width: '100%', textAlign: 'center'
        }}>
          <div style={{ fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
            Opening hours
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: 'var(--text)' }}>
            {restaurant.opening_time || '11:00'} — {restaurant.closing_time || '23:00'}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text3)' }}>
        Powered by <span style={{ color: 'var(--gold-dim)' }}>Waitless</span>
      </div>
    </div>
  );
}

export default function RestaurantClosed() {
  return (
    <Suspense fallback={
      <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <ClosedContent />
    </Suspense>
  );
}