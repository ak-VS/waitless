'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';

function JoinQueueInner() {
  const router = useRouter();
  const [restaurant_id, setRestaurantId] = useState<string|null>(null);
  const [table_id, setTableId] = useState<string|null>(null);
  const [table_label, setTableLabel] = useState<string|null>(null);
  const [table_seats, setTableSeats] = useState<string|null>(null);
  const [table_zone, setTableZone] = useState<string|null>(null);
  const [is_any, setIsAny] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRestaurantId(params.get('r'));
    setTableId(params.get('table'));
    setTableLabel(params.get('label'));
    setTableSeats(params.get('seats'));
    setTableZone(params.get('zone'));
    setIsAny(params.get('any') === 'true');
  }, []);

  const [restaurant, setRestaurant] = useState<any>(null);
  const [name, setName] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [occasion, setOccasion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [locationChecking, setLocationChecking] = useState(true);

  useEffect(() => {
    if (table_seats) setPartySize(parseInt(table_seats));
  }, [table_seats]);

  useEffect(() => {
    if (!restaurant_id) return;
    fetch(`/api/restaurant/info?id=${restaurant_id}`)
      .then(r => r.json())
      .then(d => setRestaurant(d.restaurant));
  }, [restaurant_id]);

  useEffect(() => {
    if (!restaurant_id) return;
    // If coming from a specific table selection, skip geofence (already checked on floor map)
    if (table_id) { setLocationChecking(false); return; }
    if (!navigator.geolocation) { setLocationChecking(false); return; }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch('/api/geofence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurant_id, lat: pos.coords.latitude, lng: pos.coords.longitude })
          });
          const data = await res.json();
          if (!data.allowed) {
            setLocationBlocked(true);
            setError(`You must be within 100m of the restaurant. You are ${data.distance_meters}m away.`);
          }
        } catch {
          // Network error — allow through
        }
        setLocationChecking(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationBlocked(true);
          setError('Location access is required to join the queue. Please enable location and try again.');
        }
        setLocationChecking(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, [restaurant_id, table_id]);

  const handleSubmit = async () => {
    if (locationBlocked) {
      setError('Location verification failed. Please enable location access and reload.');
      return;
    }
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!partySize) { setError('Please select party size'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id,
          customer_name: name.trim(),
          party_size: partySize,
          zone_preference: table_zone || 'any',
          table_preference: table_id || null,
          occasion: occasion || null,
        })
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/customer/queue?id=${data.queue_entry_id}&r=${restaurant_id}`);
      } else {
        setError(data.error || 'Something went wrong');
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
      <div style={s.header}>
        <div>
          <div style={s.restName}>{restaurant?.name || '...'}</div>
          <div style={s.restAddr}>{restaurant?.city}</div>
        </div>
        <ThemeToggle />
      </div>
      <div style={s.body}>
        <div style={s.backBtn} onClick={() => router.push(`/customer/floor?r=${restaurant_id}`)}>
          ← Back to floor map
        </div>
        {(table_label && !is_any) && (
          <div style={s.tableCard}>
            <div style={s.tcLeft}>
              <div style={s.tcLabel}>Selected Table</div>
              <div style={s.tcName}>Table {table_label} · {table_seats}-Seater</div>
              <div style={s.tcZone}>{table_zone} seating</div>
            </div>
            <button style={s.tcChange} onClick={() => router.push(`/customer/floor?r=${restaurant_id}`)}>Change</button>
          </div>
        )}
        {is_any && (
          <div style={s.tableCard}>
            <div style={s.tcLeft}>
              <div style={s.tcLabel}>Table preference</div>
              <div style={s.tcName}>Any Available Table</div>
              <div style={s.tcZone}>Best fit will be assigned</div>
            </div>
            <button style={s.tcChange} onClick={() => router.push(`/customer/floor?r=${restaurant_id}`)}>Change</button>
          </div>
        )}

        {locationChecking && !table_id ? (
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,padding:'10px 12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:3}}>
            <div style={{width:12,height:12,border:'1.5px solid var(--border)',borderTop:'1.5px solid var(--gold)',borderRadius:'50%',animation:'spin 1s linear infinite',flexShrink:0}}></div>
            <div style={{fontSize:9,letterSpacing:'1px',textTransform:'uppercase',color:'var(--text3)'}}>Verifying your location…</div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : null}

        <div style={s.formTitle}>Join the Queue</div>
        <div style={s.formSub}>2 fields · 10 seconds</div>
        <label style={s.label}>Your name</label>
        <input style={s.input} placeholder="e.g. Aryan Sharma" value={name}
          onChange={e => setName(e.target.value)} autoComplete="name"/>
        <label style={s.label}>Party size</label>
        <div style={s.paxRow}>
          {[1,2,3,4,5,6,8,10].map(n => (
            <button key={n} style={{...s.paxBtn, ...(partySize===n ? s.paxOn : {})}}
              onClick={() => setPartySize(n)}>{n}</button>
          ))}
        </div>
        <label style={s.label}>Occasion <span style={{color:'var(--text3)',fontSize:9}}>(optional)</span></label>
        <input style={s.input} placeholder="Birthday, anniversary, business lunch…"
          value={occasion} onChange={e => setOccasion(e.target.value)}/>

        {error && (
          <div style={s.errorBox}>
            {error}
            {locationBlocked && (
              <div style={{marginTop:8}}>
                <span onClick={() => window.location.reload()}
                  style={{color:'#e88080',textDecoration:'underline',cursor:'pointer',fontSize:10}}>
                  Enable location and reload
                </span>
              </div>
            )}
          </div>
        )}

        <button
          style={{...s.submitBtn, opacity: (loading || locationBlocked || locationChecking) ? .5 : 1}}
          onClick={handleSubmit}
          disabled={loading || locationBlocked || locationChecking}>
          {loading ? 'Joining queue...'
            : locationBlocked ? '📍 Location required'
            : locationChecking ? 'Verifying location…'
            : 'Join Queue →'}
        </button>
        <div style={s.note}>You can roam freely after joining. We'll notify you when your table is ready.</div>
      </div>
      <div style={s.powered}>Powered by <span style={{color:'var(--gold-dim)'}}>Waitless</span></div>
    </div>
  );
}

const Loader = () => (
  <div style={{background:'var(--bg)',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
    <div style={{width:32,height:32,border:'2px solid #2a2620',borderTop:'2px solid #C9A84C',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export default function JoinQueue() {
  return (
    <Suspense fallback={<Loader />}>
      <JoinQueueInner />
    </Suspense>
  );
}

const s: any = {
  page:{background:'var(--bg)',minHeight:'100vh',display:'flex',flexDirection:'column',maxWidth:480,margin:'0 auto',fontFamily:"'Jost',sans-serif",fontWeight:300},
  header:{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'},
  restName:{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:'var(--text)',fontWeight:300},
  restAddr:{fontSize:9,letterSpacing:'1px',color:'var(--text3)',marginTop:1},
  body:{padding:'20px 20px 32px',flex:1},
  backBtn:{display:'flex',alignItems:'center',gap:6,fontSize:9,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text3)',cursor:'pointer',marginBottom:16},
  tableCard:{background:'var(--bg2)',border:'1px solid var(--gold-dim)',borderRadius:3,padding:'12px 14px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'},
  tcLeft:{flex:1},
  tcLabel:{fontSize:7,letterSpacing:'2px',textTransform:'uppercase',color:'var(--gold-dim)',marginBottom:3},
  tcName:{fontSize:15,color:'var(--text)',fontFamily:"'Cormorant Garamond',serif"},
  tcZone:{fontSize:9,color:'var(--text3)',marginTop:2,textTransform:'capitalize'},
  tcChange:{background:'transparent',border:'1px solid var(--border2)',color:'var(--text3)',fontSize:8,letterSpacing:'1.5px',textTransform:'uppercase',padding:'5px 10px',borderRadius:2,cursor:'pointer'},
  formTitle:{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:'var(--text)',marginBottom:2},
  formSub:{fontSize:9,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text3)',marginBottom:20},
  label:{fontSize:8,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',display:'block',marginBottom:6},
  input:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',color:'var(--text)',fontFamily:"'Jost',sans-serif",fontSize:14,padding:'11px 12px',borderRadius:3,outline:'none',marginBottom:16,WebkitAppearance:'none'},
  paxRow:{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'},
  paxBtn:{flex:1,minWidth:44,background:'var(--bg3)',borderWidth:1,borderStyle:'solid',borderColor:'var(--border2)',color:'var(--text2)',fontFamily:"'Jost',sans-serif",fontSize:13,padding:'10px 4px',borderRadius:2,cursor:'pointer',textAlign:'center'},
  paxOn:{background:'rgba(201,168,76,.1)',borderWidth:1,borderStyle:'solid',borderColor:'var(--gold)',color:'var(--gold)'},
  errorBox:{background:'rgba(201,76,76,.1)',border:'1px solid #c94c4c',borderRadius:3,padding:'10px 12px',fontSize:11,color:'#e88080',marginBottom:12},
  submitBtn:{width:'100%',background:'var(--gold)',border:'none',color:'#0d0d0d',fontFamily:"'Jost',sans-serif",fontSize:11,letterSpacing:'2.5px',textTransform:'uppercase',padding:14,borderRadius:3,cursor:'pointer',fontWeight:500,marginBottom:12},
  note:{fontSize:10,color:'var(--text3)',textAlign:'center',lineHeight:1.6,letterSpacing:'.3px'},
  powered:{textAlign:'center',padding:'12px',fontSize:8,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)'},
};