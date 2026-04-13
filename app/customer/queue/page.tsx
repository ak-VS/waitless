'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function QueueToken() {
  const searchParams = useSearchParams();
  const queue_entry_id = searchParams.get('id');
  const restaurant_id = searchParams.get('r');

  const [data, setData] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [prevPosition, setPrevPosition] = useState<number | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  const fetchStatus = useCallback(async () => {
    if (!queue_entry_id || !restaurant_id) return;
    const res = await fetch(`/api/queue/status?id=${queue_entry_id}&restaurant_id=${restaurant_id}`);
    const json = await res.json();
    if (json.success) {
      setData((prev: any) => {
        if (prev && json.position < prev.position) {
          triggerToast(`Queue moved — you're now position ${json.position}`);
        }
        if (json.position <= 2) {
          triggerToast('Your table is almost ready — head to the entrance!');
        }
        return json;
      });
    }
  }, [queue_entry_id, restaurant_id]);

  useEffect(() => {
    if (!restaurant_id) return;
    fetch(`/api/restaurant/info?id=${restaurant_id}`)
      .then(r => r.json()).then(d => setRestaurant(d.restaurant));
  }, [restaurant_id]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!data) return (
    <div style={{background:'var(--bg)',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,border:'2px solid var(--border)',borderTop:'2px solid var(--gold)',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const pct = Math.max(5, Math.round((1 - (data.position / data.total_waiting)) * 100));
  const isAlmost = data.position <= 2;
  const isClose = data.position <= 4;

  return (
    <div style={s.page}>
      {/* Toast */}
      <div style={{...s.toast, transform: showToast ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-120px)'}}>
        <span>🔔</span>
        <span style={{fontSize:11}}>{toastMsg}</span>
      </div>

      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.restName}>{restaurant?.name}</div>
          <div style={s.restAddr}>{restaurant?.city}</div>
        </div>
        <ThemeToggle />
      </div>

      <div style={s.body}>

        {/* WAIT TIME — primary hero element */}
        <div style={{...s.waitHero, ...(isAlmost ? s.waitHeroGreen : {})}}>
          <div style={s.waitLabel}>Estimated wait</div>
          <div style={{...s.waitNum, ...(isAlmost ? {color:'#4a9e6e'} : {})}}>
            {data.estimated_wait}
            <span style={s.waitUnit}>min</span>
          </div>
          <div style={s.waitSub}>
            {isAlmost
              ? 'Head to the entrance now'
              : isClose
              ? 'Almost your turn'
              : `${data.customer_name} · Party of ${data.party_size}`}
          </div>

          {/* Progress arc */}
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

        {/* Position + Status row */}
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

        {/* Live status bar */}
        <div style={{...s.liveBar, ...(isAlmost ? s.liveBarGreen : {})}}>
          <span style={{...s.liveDot, background: isAlmost ? '#4a9e6e' : '#4a9e6e'}}></span>
          <span style={s.liveText}>
            {isAlmost
              ? 'Your table is ready — please make your way in'
              : isClose
              ? 'Getting close — a few parties ahead of you'
              : 'You can roam freely. We\'ll notify you when ready.'}
          </span>
        </div>

        {/* Token — small, secondary */}
        <div style={s.tokenRow}>
          <div style={s.tokenLeft}>
            <div style={s.tokenLabel}>Queue token</div>
            <div style={s.tokenNum}>{data.token}</div>
          </div>
          <div style={s.tokenRight}>
            <div style={s.tokenLabel}>Joined at</div>
            <div style={s.tokenTime}>
              {new Date(data.joined_at).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata'})}
            </div>
          </div>
          {data.zone_preference && data.zone_preference !== 'any' && (
            <div style={s.tokenRight}>
              <div style={s.tokenLabel}>Preference</div>
              <div style={s.tokenTime} style={{textTransform:'capitalize'}}>{data.zone_preference}</div>
            </div>
          )}
        </div>

        <div style={s.note}>
          This page auto-updates every 15 seconds. No need to refresh.
        </div>
      </div>

      <div style={s.powered}>Powered by <span style={{color:'var(--gold-dim)'}}>Waitless</span></div>
    </div>
  );
}

const s: any = {
  page:{background:'var(--bg)',minHeight:'100vh',display:'flex',flexDirection:'column',maxWidth:480,margin:'0 auto',fontFamily:"'Jost',sans-serif",fontWeight:300},
  toast:{position:'fixed',top:16,left:'50%',transform:'translateX(-50%) translateY(-120px)',background:'var(--bg3)',border:'1px solid var(--gold-dim)',borderRadius:10,padding:'10px 16px',display:'flex',alignItems:'center',gap:8,zIndex:999,transition:'transform .4s cubic-bezier(.34,1.56,.64,1)',whiteSpace:'nowrap',color:'var(--text)',fontSize:11},
  header:{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0},
  restName:{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:'var(--text)',fontWeight:300},
  restAddr:{fontSize:9,letterSpacing:'1px',color:'var(--text3)',marginTop:1},
  body:{padding:'20px 20px 32px',flex:1,display:'flex',flexDirection:'column'},

  // Wait time hero
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

  // Stats
  statsRow:{display:'flex',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,overflow:'hidden',marginBottom:10},
  stat:{flex:1,padding:'12px 6px',textAlign:'center'},
  sv:{fontFamily:"'Cormorant Garamond',serif",fontSize:24,color:'var(--text)',transition:'color .3s'},
  sl:{fontSize:7,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text3)',marginTop:2},

  // Live bar
  liveBar:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,padding:'11px 14px',display:'flex',alignItems:'center',gap:10,marginBottom:10,transition:'all .3s'},
  liveBarGreen:{borderColor:'#2d6145',background:'rgba(74,158,110,.06)'},
  liveDot:{width:7,height:7,borderRadius:'50%',flexShrink:0,display:'inline-block',animation:'pulse 1.5s ease-in-out infinite'},
  liveText:{fontSize:10,color:'var(--text2)',letterSpacing:'.3px',lineHeight:1.5},

  // Token — secondary
  tokenRow:{display:'flex',gap:0,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,overflow:'hidden',marginBottom:12},
  tokenLeft:{flex:1,padding:'10px 14px',borderRight:'1px solid var(--border)'},
  tokenRight:{flex:1,padding:'10px 14px',borderRight:'1px solid var(--border)'},
  tokenLabel:{fontSize:7,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:3},
  tokenNum:{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:'var(--text)',letterSpacing:2},
  tokenTime:{fontSize:13,color:'var(--text)',fontFamily:"'Cormorant Garamond',serif"},

  note:{fontSize:9,color:'var(--text3)',textAlign:'center',lineHeight:1.6,letterSpacing:'.3px',marginTop:'auto',paddingTop:12},
  powered:{textAlign:'center',padding:'10px',fontSize:8,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)'},
};