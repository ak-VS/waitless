'use client';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { io } from 'socket.io-client';

function QueueTokenInner() {
  const router = useRouter();
  const [queue_entry_id, setQueueEntryId] = useState<string|null>(null);
  const [restaurant_id, setRestaurantId] = useState<string|null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQueueEntryId(params.get('id'));
    setRestaurantId(params.get('r'));
  }, []);

  const [data, setData] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [onMyWayDone, setOnMyWayDone] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg); setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  const fetchStatus = useCallback(async () => {
    if (!queue_entry_id || !restaurant_id) return;
    const res = await fetch(`/api/queue/status?id=${queue_entry_id}&restaurant_id=${restaurant_id}`);
    const json = await res.json();
    if (json.success) {
      if (json.status === 'skipped') { setSkipped(true); return; }
      setData((prev: any) => {
        if (prev && json.position < prev.position) triggerToast(`Queue moved — you're now position ${json.position}`);
        if (json.position <= 2 && (!prev || prev.position > 2)) triggerToast('Your table is almost ready — head to the entrance!');
        return json;
      });
    }
  }, [queue_entry_id, restaurant_id]);

  useEffect(() => {
    if (!restaurant_id) return;
    fetch(`/api/restaurant/info?id=${restaurant_id}`).then(r => r.json()).then(d => setRestaurant(d.restaurant));
  }, [restaurant_id]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (!queue_entry_id) return;
    const socketUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const socket = io(socketUrl, { transports: ['websocket'] });
    socket.on('connect', () => socket.emit('join_queue', queue_entry_id));
    socket.on('status_updated', (update: any) => {
      if (update.type === 'table_ready') { triggerToast('Your table is ready! Head to the entrance now.'); fetchStatus(); }
      else if (update.type === 'skipped') { setSkipped(true); }
      else if (update.type === 'seated') { fetchStatus(); }
      else if (update.type === 'removed') { router.push(`/q/${restaurant_id}`); }
    });
    return () => { socket.disconnect(); };
  }, [queue_entry_id, fetchStatus, router, restaurant_id]);

  useEffect(() => {
    if (!queue_entry_id || !restaurant_id || !data) return;
    import('@/lib/push').then(({ registerPushNotifications }) => {
      registerPushNotifications(queue_entry_id, restaurant_id);
    });
  }, [queue_entry_id, restaurant_id, data]);

  const handleLeaveQueue = async () => {
    if (!queue_entry_id) return;
    setLeaving(true);
    try {
      await fetch('/api/staff/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue_entry_id, action: 'remove', restaurant_id: restaurant_id || '' })
      });
    } catch (e) { console.error(e); }
    router.push(`/q/${restaurant_id}`);
  };

  const handleImOnMyWay = async () => {
    if (!queue_entry_id) return;
    await fetch('/api/staff/queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_entry_id, action: 'im_on_my_way', restaurant_id: restaurant_id || '' })
    });
    setOnMyWayDone(true);
    triggerToast('Got it! Your timer has been extended by 3 minutes.');
  };

  if (!data && !skipped) return (
    <div style={{background:'var(--bg)',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,border:'2px solid var(--border)',borderTop:'2px solid var(--gold)',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (data?.status === 'seated') return (
    <div style={s.centerPage}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');`}</style>
      <div style={s.bigRing}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M6 16l7 7 13-13" stroke="#4a9e6e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={s.bigTitle}>Enjoy your meal</div>
      <div style={s.bigSub}>You're all set, {data.customer_name}.</div>
      <div style={{...s.infoCard, marginTop:20}}>
        <div style={s.infoLabel}>Restaurant</div>
        <div style={s.infoVal}>{restaurant?.name}</div>
      </div>
      <div style={{fontSize:10,color:'var(--text3)',textAlign:'center',lineHeight:1.7,marginTop:20,letterSpacing:'.3px'}}>
        Thank you for using Waitless. We hope you have a great meal!
      </div>
      <div style={s.powered}>Powered by <span style={{color:'var(--gold-dim)'}}>Waitless</span></div>
    </div>
  );

  if (data?.notified_at && data?.status === 'waiting') return (
    <div style={s.centerPage}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
      `}</style>
      <div style={{...s.toast, transform: showToast ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-120px)'}}>
        <span>🔔</span><span style={{fontSize:11}}>{toastMsg}</span>
      </div>
      <div style={s.header}>
        <div><div style={s.restName}>{restaurant?.name}</div><div style={s.restAddr}>{restaurant?.city}</div></div>
        <ThemeToggle />
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem 1.5rem'}}>
        <div style={{width:72,height:72,borderRadius:'50%',background:'rgba(74,158,110,.1)',border:'2px solid #4a9e6e',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20,animation:'bounce 1.5s ease-in-out infinite'}}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 4C9.4 4 4 9.4 4 16s5.4 12 12 12 12-5.4 12-12S22.6 4 16 4z" stroke="#4a9e6e" strokeWidth="1.5"/>
            <path d="M16 10v6l4 4" stroke="#4a9e6e" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,color:'var(--text)',textAlign:'center',marginBottom:8}}>Your table is ready!</div>
        <div style={{fontSize:12,color:'var(--text2)',textAlign:'center',lineHeight:1.7,marginBottom:28,letterSpacing:'.3px'}}>
          Please head to the restaurant entrance now. Show your token to the staff.
        </div>
        <div style={{background:'var(--bg2)',border:'1px solid var(--gold)',borderRadius:8,padding:'20px 32px',textAlign:'center',marginBottom:24,width:'100%'}}>
          <div style={{fontSize:8,letterSpacing:'3px',textTransform:'uppercase',color:'var(--gold-dim)',marginBottom:6}}>Your token</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:56,letterSpacing:6,color:'var(--gold)',lineHeight:1}}>{data.token}</div>
          <div style={{fontSize:9,color:'var(--text3)',marginTop:6,letterSpacing:'1px'}}>Show this to the staff at the entrance</div>
        </div>
        {!onMyWayDone ? (
          <button onClick={handleImOnMyWay}
            style={{width:'100%',background:'var(--gold)',border:'none',color:'#0d0d0d',fontFamily:"'Jost',sans-serif",fontSize:11,letterSpacing:'2px',textTransform:'uppercase',padding:14,borderRadius:3,cursor:'pointer',fontWeight:500,marginBottom:10}}>
            I'm on my way →
          </button>
        ) : (
          <div style={{width:'100%',background:'rgba(74,158,110,.1)',border:'1px solid #2d6145',borderRadius:3,padding:14,textAlign:'center',fontSize:10,color:'#4a9e6e',letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:10}}>
            ✓ Timer extended — we'll wait for you
          </div>
        )}
        <div style={{fontSize:9,color:'var(--text3)',textAlign:'center',lineHeight:1.6,letterSpacing:'.3px'}}>
          Didn't make it? The staff can reassign your table if needed.
        </div>
      </div>
      <div style={s.powered}>Powered by <span style={{color:'var(--gold-dim)'}}>Waitless</span></div>
    </div>
  );

  if (skipped) return (
    <div style={s.centerPage}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');`}</style>
      <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(201,76,76,.1)',border:'1px solid #c94c4c',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M6 6l10 10M16 6L6 16" stroke="#c94c4c" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:'var(--text)',marginBottom:8,textAlign:'center'}}>You were skipped</div>
      <div style={{fontSize:11,color:'var(--text3)',textAlign:'center',lineHeight:1.7,marginBottom:24}}>
        You didn't respond in time. If you're still at the restaurant, you can rejoin the queue.
      </div>
      <button onClick={() => router.push(`/customer/floor?r=${restaurant_id}`)}
        style={{width:'100%',background:'var(--gold)',border:'none',color:'#0d0d0d',fontFamily:"'Jost',sans-serif",fontSize:11,letterSpacing:'2px',textTransform:'uppercase',padding:14,borderRadius:3,cursor:'pointer',fontWeight:500,marginBottom:8}}>
        Rejoin Queue →
      </button>
      <button onClick={() => router.push(`/q/${restaurant_id}`)}
        style={{width:'100%',background:'transparent',border:'1px solid var(--border2)',color:'var(--text3)',fontFamily:"'Jost',sans-serif",fontSize:10,letterSpacing:'2px',textTransform:'uppercase',padding:12,borderRadius:3,cursor:'pointer'}}>
        Leave
      </button>
    </div>
  );

  if (!data) return null;

  const pct = Math.max(5, Math.round((1 - (data.position / data.total_waiting)) * 100));
  const isAlmost = data.position <= 2;
  const isClose = data.position <= 4;

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>
      <div style={{...s.toast, transform: showToast ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-120px)'}}>
        <span>🔔</span><span style={{fontSize:11}}>{toastMsg}</span>
      </div>
      <div style={s.header}>
        <div><div style={s.restName}>{restaurant?.name}</div><div style={s.restAddr}>{restaurant?.city}</div></div>
        <ThemeToggle />
      </div>
      <div style={s.body}>
        <div style={{...s.waitHero, ...(isAlmost ? s.waitHeroGreen : {})}}>
          <div style={s.waitLabel}>Estimated wait</div>
          <div style={{...s.waitNum, ...(isAlmost ? {color:'#4a9e6e'} : {})}}>
            {data.confidence === 'low' ? Math.ceil(data.estimated_wait * 1.1) : data.estimated_wait}
            <span style={s.waitUnit}>min</span>
          </div>
          <div style={s.waitSub}>
            {isAlmost ? 'Head to the entrance now' : isClose ? 'Almost your turn' : `${data.customer_name} · Party of ${data.party_size}`}
          </div>
          <div style={s.progWrap}>
            <div style={s.progLabels}>
              <span style={{fontSize:9,color:'var(--text3)',letterSpacing:'1px',textTransform:'uppercase'}}>Queue progress</span>
              <span style={{fontSize:9,color:'var(--text3)',letterSpacing:'1px'}}>{pct}%</span>
            </div>
            <div style={s.progBar}>
              <div style={{...s.progFill, width:`${pct}%`, background: isAlmost ? '#4a9e6e' : 'var(--gold)'}}></div>
            </div>
          </div>
        </div>
        <div style={s.statsRow}>
          <div style={{...s.stat, borderRight:'1px solid var(--border)'}}>
            <div style={{...s.sv, color: isAlmost ? '#4a9e6e' : 'var(--text)'}}>{data.position}</div>
            <div style={s.sl}>Position</div>
          </div>
          <div style={{...s.stat, borderRight:'1px solid var(--border)'}}>
            <div style={s.sv}>{data.total_waiting}</div>
            <div style={s.sl}>In queue</div>
          </div>
          <div style={s.stat}>
            <div style={s.sv}>{data.party_size}</div>
            <div style={s.sl}>Guests</div>
          </div>
        </div>
        <div style={{...s.liveBar, ...(isAlmost ? s.liveBarGreen : {})}}>
          <span style={{...s.liveDot, background:'#4a9e6e'}}></span>
          <span style={s.liveText}>
            {isAlmost ? 'Your table is ready — please make your way in'
              : isClose ? 'Getting close — a few parties ahead of you'
              : "You can roam freely. We'll notify you when ready."}
          </span>
        </div>
        <div style={s.tokenRow}>
          <div style={s.tokenLeft}>
            <div style={s.tokenLabel}>Queue token</div>
            <div style={s.tokenNum}>{data.token}</div>
          </div>
          <div style={s.tokenRight}>
            <div style={s.tokenLabel}>Joined at</div>
            <div style={s.tokenTime}>
              {new Date(data.joined_at).toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
              })}
            </div>
          </div>
          {data.zone_preference && data.zone_preference !== 'any' && (
            <div style={s.tokenRight}>
              <div style={s.tokenLabel}>Preference</div>
              <div style={{...s.tokenTime, textTransform:'capitalize'}}>{data.zone_preference}</div>
            </div>
          )}
        </div>
        <div style={s.note}>This page auto-updates every 15 seconds. No need to refresh.</div>
        <button onClick={handleLeaveQueue} disabled={leaving}
          style={{width:'100%',background:'transparent',border:'1px solid var(--border2)',color:'var(--text3)',fontFamily:"'Jost',sans-serif",fontSize:9,letterSpacing:'2px',textTransform:'uppercase',padding:11,borderRadius:3,cursor:'pointer',marginTop:12,opacity:leaving?0.5:1}}>
          {leaving ? 'Leaving...' : 'Leave Queue'}
        </button>
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

export default function QueueToken() {
  return (
    <Suspense fallback={<Loader />}>
      <QueueTokenInner />
    </Suspense>
  );
}

const s: any = {
  page:{background:'var(--bg)',minHeight:'100vh',display:'flex',flexDirection:'column',maxWidth:480,margin:'0 auto',fontFamily:"'Jost',sans-serif",fontWeight:300},
  centerPage:{background:'var(--bg)',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem 1.5rem',maxWidth:480,margin:'0 auto',fontFamily:"'Jost',sans-serif",fontWeight:300},
  toast:{position:'fixed',top:16,left:'50%',transform:'translateX(-50%) translateY(-120px)',background:'var(--bg3)',border:'1px solid var(--gold-dim)',borderRadius:10,padding:'10px 16px',display:'flex',alignItems:'center',gap:8,zIndex:999,transition:'transform .4s cubic-bezier(.34,1.56,.64,1)',whiteSpace:'nowrap',color:'var(--text)',fontSize:11},
  header:{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,width:'100%'},
  restName:{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:'var(--text)',fontWeight:300},
  restAddr:{fontSize:9,letterSpacing:'1px',color:'var(--text3)',marginTop:1},
  body:{padding:'20px 20px 32px',flex:1,display:'flex',flexDirection:'column'},
  bigRing:{width:72,height:72,borderRadius:'50%',background:'rgba(74,158,110,.1)',border:'2px solid #4a9e6e',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20},
  bigTitle:{fontFamily:"'Cormorant Garamond',serif",fontSize:30,color:'var(--text)',textAlign:'center',marginBottom:8},
  bigSub:{fontSize:12,color:'var(--text2)',textAlign:'center',letterSpacing:'.3px',marginBottom:20},
  infoCard:{width:'100%',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,padding:'12px 16px',marginBottom:8},
  infoLabel:{fontSize:7,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:4},
  infoVal:{fontSize:14,color:'var(--text)',fontFamily:"'Cormorant Garamond',serif"},
  waitHero:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'24px 20px 20px',marginBottom:12,textAlign:'center',transition:'all .3s'},
  waitHeroGreen:{borderColor:'#2d6145',background:'rgba(74,158,110,.06)'},
  waitLabel:{fontSize:9,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text3)',marginBottom:8},
  waitNum:{fontFamily:"'Cormorant Garamond',serif",fontSize:88,lineHeight:1,color:'var(--gold)',letterSpacing:-2,transition:'color .3s'},
  waitUnit:{fontSize:28,letterSpacing:0,color:'var(--text3)',marginLeft:4},
  waitSub:{fontSize:11,color:'var(--text2)',letterSpacing:'.5px',marginTop:6,marginBottom:16},
  progWrap:{width:'100%'},
  progLabels:{display:'flex',justifyContent:'space-between',marginBottom:6},
  progBar:{width:'100%',height:3,background:'var(--border2)',borderRadius:2,overflow:'hidden'},
  progFill:{height:'100%',borderRadius:2,transition:'width 1s ease, background .3s'},
  statsRow:{display:'flex',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,overflow:'hidden',marginBottom:10},
  stat:{flex:1,padding:'12px 6px',textAlign:'center'},
  sv:{fontFamily:"'Cormorant Garamond',serif",fontSize:24,color:'var(--text)',transition:'color .3s'},
  sl:{fontSize:7,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text3)',marginTop:2},
  liveBar:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,padding:'11px 14px',display:'flex',alignItems:'center',gap:10,marginBottom:10,transition:'all .3s'},
  liveBarGreen:{borderColor:'#2d6145',background:'rgba(74,158,110,.06)'},
  liveDot:{width:7,height:7,borderRadius:'50%',flexShrink:0,display:'inline-block',animation:'pulse 1.5s ease-in-out infinite'},
  liveText:{fontSize:10,color:'var(--text2)',letterSpacing:'.3px',lineHeight:1.5},
  tokenRow:{display:'flex',gap:0,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,overflow:'hidden',marginBottom:12},
  tokenLeft:{flex:1,padding:'10px 14px',borderRight:'1px solid var(--border)'},
  tokenRight:{flex:1,padding:'10px 14px',borderRight:'1px solid var(--border)'},
  tokenLabel:{fontSize:7,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:3},
  tokenNum:{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:'var(--text)',letterSpacing:2},
  tokenTime:{fontSize:13,color:'var(--text)',fontFamily:"'Cormorant Garamond',serif"},
  note:{fontSize:9,color:'var(--text3)',textAlign:'center',lineHeight:1.6,letterSpacing:'.3px',marginTop:'auto',paddingTop:12},
  powered:{textAlign:'center',padding:'10px',fontSize:8,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)'},
};