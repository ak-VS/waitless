'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerLanding() {
  const router = useRouter();
  const [restaurant_id, setRestaurantId] = useState<string|null>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gpsError, setGpsError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRestaurantId(params.get('r'));
  }, []);

  useEffect(() => {
    if (!restaurant_id) return;
    fetch(`/api/restaurant/info?id=${restaurant_id}`)
      .then(r => r.json())
      .then(d => { setRestaurant(d.restaurant); setLoading(false); })
      .catch(() => setLoading(false));
  }, [restaurant_id]);

  const handleScan = async () => {
    setChecking(true);
    setGpsError('');
    if (!navigator.geolocation) {
      router.push(`/customer/floor?r=${restaurant_id}`);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => { router.push(`/customer/floor?r=${restaurant_id}`); },
      () => {
        setGpsError('Location access denied. Please enable GPS to verify you are at the restaurant.');
        setChecking(false);
      },
      { timeout: 8000 }
    );
  };

  if (!restaurant_id) return (
    <div style={s.center}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');`}</style>
      <div style={s.errorBox}>
        <div style={s.errorIcon}>⚠</div>
        <div style={s.errorTitle}>Invalid QR Code</div>
        <div style={s.errorMsg}>Please scan the QR code at the restaurant entrance.</div>
      </div>
    </div>
  );

  if (loading) return (
    <div style={s.center}>
      <div style={s.spinner}></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');
        @keyframes scan{0%{top:4px}50%{top:calc(100% - 6px)}100%{top:4px}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <div style={s.camSection}>
        <div style={s.camBg}></div>
        <div style={s.frameWrap}>
          <div style={s.frame}>
            <div style={{...s.corner, top:0, left:0, borderWidth:'2px 0 0 2px'}}></div>
            <div style={{...s.corner, top:0, right:0, borderWidth:'2px 2px 0 0'}}></div>
            <div style={{...s.corner, bottom:0, left:0, borderWidth:'0 0 2px 2px'}}></div>
            <div style={{...s.corner, bottom:0, right:0, borderWidth:'0 2px 2px 0'}}></div>
            <div style={s.scanLine}></div>
            <div style={s.qrBox}>
              <svg viewBox="0 0 104 104" style={{width:'100%',height:'100%'}}>
                <rect width="104" height="104" fill="white"/>
                <g fill="#0d0d0d">
                  <rect x="8" y="8" width="32" height="32"/><rect x="12" y="12" width="24" height="24" fill="white"/><rect x="16" y="16" width="16" height="16"/>
                  <rect x="64" y="8" width="32" height="32"/><rect x="68" y="12" width="24" height="24" fill="white"/><rect x="72" y="16" width="16" height="16"/>
                  <rect x="8" y="64" width="32" height="32"/><rect x="12" y="68" width="24" height="24" fill="white"/><rect x="16" y="72" width="16" height="16"/>
                  <rect x="46" y="46" width="8" height="8"/>
                  <rect x="60" y="46" width="6" height="6"/><rect x="70" y="46" width="6" height="6"/><rect x="80" y="46" width="16" height="6"/>
                  <rect x="46" y="60" width="6" height="6"/><rect x="56" y="60" width="6" height="6"/><rect x="66" y="60" width="6" height="6"/>
                  <rect x="46" y="70" width="8" height="8"/><rect x="60" y="70" width="10" height="8"/><rect x="74" y="70" width="6" height="8"/>
                  <rect x="46" y="84" width="6" height="12"/><rect x="56" y="84" width="8" height="12"/><rect x="68" y="84" width="6" height="12"/><rect x="78" y="84" width="18" height="12"/>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div style={s.bottom}>
        <div style={s.verifiedBadge}>
          <span style={s.dot}></span>
          <span style={s.badgeTxt}>Verified restaurant · Live tonight</span>
        </div>
        <div style={s.restName}>{restaurant?.name || 'Restaurant'}</div>
        <div style={s.restAddr}>{restaurant?.address}, {restaurant?.city}</div>
        {gpsError && <div style={s.gpsError}>{gpsError}</div>}
        <button style={s.primaryBtn} onClick={handleScan} disabled={checking}>
          {checking ? 'Checking location...' : 'Scan & View Floor Map →'}
        </button>
        {gpsError && (
          <button style={s.ghostBtn} onClick={() => router.push(`/customer/floor?r=${restaurant_id}`)}>
            Continue anyway
          </button>
        )}
        <div style={s.powered}>Powered by <span style={{color:'var(--gold-dim)'}}>Waitless</span></div>
      </div>
    </div>
  );
}

const s: any = {
  page:{background:'var(--bg)',minHeight:'100vh',display:'flex',flexDirection:'column',fontFamily:"'Jost',sans-serif",fontWeight:300},
  center:{background:'var(--bg)',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column'},
  camSection:{flex:1,background:'#000',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',minHeight:'52vw',maxHeight:'58vh'},
  camBg:{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(201,168,76,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,.03) 1px,transparent 1px)',backgroundSize:'26px 26px'},
  frameWrap:{position:'relative',zIndex:3},
  frame:{width:'min(190px,50vw)',height:'min(190px,50vw)',position:'relative'},
  corner:{position:'absolute',width:26,height:26,borderColor:'#C9A84C',borderStyle:'solid',borderRadius:3},
  scanLine:{position:'absolute',left:4,right:4,height:2,background:'#C9A84C',opacity:.65,zIndex:4,animation:'scan 2s ease-in-out infinite'},
  qrBox:{width:'min(125px,33vw)',height:'min(125px,33vw)',background:'#fff',borderRadius:3,zIndex:2,padding:8,position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)'},
  bottom:{padding:'20px 20px 32px'},
  verifiedBadge:{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(74,158,110,.08)',border:'1px solid #2d6145',borderRadius:2,padding:'5px 10px',marginBottom:12},
  dot:{width:6,height:6,borderRadius:'50%',background:'#4a9e6e',display:'inline-block'},
  badgeTxt:{fontSize:8,letterSpacing:'1.5px',textTransform:'uppercase',color:'#4a9e6e',fontFamily:"'Jost',sans-serif"},
  restName:{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(20px,5.5vw,28px)',fontWeight:300,color:'var(--text)',lineHeight:1.1,marginBottom:4},
  restAddr:{fontSize:9,letterSpacing:'1px',color:'var(--text3)',marginBottom:14},
  gpsError:{background:'rgba(201,76,76,.1)',border:'1px solid #c94c4c',borderRadius:3,padding:'10px 12px',fontSize:11,color:'#e88080',marginBottom:12,lineHeight:1.5},
  primaryBtn:{width:'100%',background:'#C9A84C',border:'none',color:'#0d0d0d',fontFamily:"'Jost',sans-serif",fontSize:11,letterSpacing:'2.5px',textTransform:'uppercase',padding:14,borderRadius:3,cursor:'pointer',fontWeight:500,marginBottom:8},
  ghostBtn:{width:'100%',background:'transparent',border:'1px solid var(--border2)',color:'var(--text3)',fontFamily:"'Jost',sans-serif",fontSize:10,letterSpacing:'2px',textTransform:'uppercase',padding:11,borderRadius:3,cursor:'pointer',marginBottom:8},
  powered:{textAlign:'center',fontSize:8,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginTop:8},
  errorBox:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:4,padding:'2rem',textAlign:'center',maxWidth:300},
  errorIcon:{fontSize:32,marginBottom:12},
  errorTitle:{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:'var(--text)',marginBottom:8},
  errorMsg:{fontSize:11,color:'var(--text3)',lineHeight:1.6},
  spinner:{width:32,height:32,border:'2px solid var(--border)',borderTop:'2px solid var(--gold)',borderRadius:'50%',animation:'spin 1s linear infinite'},
};