'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';
export const dynamic = 'force-dynamic';

export default function FloorMap() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restaurant_id = searchParams.get('r');
  const [tables, setTables] = useState<any[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [zone, setZone] = useState('all');
  const [loading, setLoading] = useState(true);
  const [geoStatus, setGeoStatus] = useState<'checking'|'allowed'|'denied'>('checking');
  const [distance, setDistance] = useState<number|null>(null);

  useEffect(() => {
    if (!restaurant_id) return;
    if (!navigator.geolocation) { setGeoStatus('allowed'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch('/api/geofence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurant_id, lat: pos.coords.latitude, lng: pos.coords.longitude })
          });
          const data = await res.json();
          setDistance(data.distance_meters);
          setGeoStatus(data.allowed ? 'allowed' : 'denied');
        } catch { setGeoStatus('allowed'); }
      },
      () => { setGeoStatus('allowed'); },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, [restaurant_id]);

  useEffect(() => {
    if (!restaurant_id || geoStatus !== 'allowed') return;
    Promise.all([
      fetch(`/api/tables?restaurant_id=${restaurant_id}`).then(r => r.json()),
      fetch(`/api/restaurant/info?id=${restaurant_id}`).then(r => r.json()),
    ]).then(([tablesData, restData]) => {
      setTables(tablesData.tables || []);
      setRestaurant(restData.restaurant);
      setLoading(false);
    });
  }, [restaurant_id, geoStatus]);

  const zones = ['all', 'window', 'indoor', 'outdoor', 'private'];

  const goToJoin = (table: any) => {
    const params = new URLSearchParams({
      r: restaurant_id!,
      ...(table ? {
        table: table.id,
        label: table.table_label,
        seats: String(table.seats),
        zone: table.zone
      } : { any: 'true' })
    });
    router.push(`/customer/join?${params.toString()}`);
  };

  if (geoStatus === 'denied') return (
    <div style={{background:'var(--bg)',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',fontFamily:"'Jost',sans-serif",fontWeight:300,maxWidth:480,margin:'0 auto'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');`}</style>
      <div style={{width:56,height:56,borderRadius:'50%',background:'rgba(201,76,76,.1)',border:'1px solid #c94c4c',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#c94c4c" strokeWidth="1.5" fill="none"/>
          <circle cx="12" cy="9" r="2.5" stroke="#c94c4c" strokeWidth="1.5"/>
        </svg>
      </div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:'var(--text)',textAlign:'center',marginBottom:8}}>You're not nearby</div>
      <div style={{fontSize:11,color:'var(--text3)',textAlign:'center',lineHeight:1.7,marginBottom:20}}>
        This QR code is only valid at the restaurant.{distance && ` You are ${distance}m away.`} Please scan when you arrive.
      </div>
      <div style={{fontSize:9,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',textAlign:'center'}}>Required: within 100m of restaurant</div>
    </div>
  );

  if (geoStatus === 'checking') return (
    <div style={{background:'var(--bg)',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'Jost',sans-serif"}}>
      <div style={{width:32,height:32,border:'2px solid var(--border)',borderTop:'2px solid var(--gold)',borderRadius:'50%',animation:'spin 1s linear infinite',marginBottom:16}}></div>
      <div style={{fontSize:9,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)'}}>Verifying location…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (loading) return (
    <div style={{background:'var(--bg)',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,border:'2px solid var(--border)',borderTop:'2px solid var(--gold)',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');
        @keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
        html,body{height:100%;margin:0;padding:0}
      `}</style>

      {/* Header */}
      <div style={s.header}>
        <div style={s.hTop}>
          <div>
            <div style={s.restName}>{restaurant?.name}</div>
            <div style={s.restAddr}>{restaurant?.city}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
            {distance !== null && (
              <div style={{fontSize:8,letterSpacing:'1px',color:'#4a9e6e',background:'rgba(74,158,110,.1)',border:'1px solid #2d6145',borderRadius:2,padding:'3px 8px'}}>
                {distance}m
              </div>
            )}
            <div style={s.liveBadge}>
              <span style={s.liveDot}></span>
              <span style={s.liveTxt}>Live</span>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          {[
            {v: tables.length, l: 'Tables', c:'var(--text)'},
            {v: tables.filter(t => !t.status || t.status === 'free').length, l: 'Available', c:'#4a9e6e'},
            {v: '~20m', l: 'Avg wait', c:'var(--text)'},
            {v: 34, l: 'Seated today', c:'var(--text)'},
          ].map((item, i) => (
            <div key={i} style={{...s.stat, borderRight: i < 3 ? '1px solid var(--border)' : 'none'}}>
              <div style={{...s.sv, color: item.c}}>{item.v}</div>
              <div style={s.sl}>{item.l}</div>
            </div>
          ))}
        </div>

        {/* Zone filters */}
        <div style={s.filterRow}>
          {zones.map(z => (
            <button key={z}
              style={{...s.fb, ...(zone===z ? s.fbOn : {})}}
              onClick={() => { setZone(z); setSelectedTable(null); }}>
              {z === 'all' ? 'All' : z.charAt(0).toUpperCase() + z.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Any table button */}
      <div style={s.anyWrap}>
        <button style={s.anyBtn} onClick={() => goToJoin(null)}>
          <div style={s.anyBtnLeft}>
            <div style={s.anyBtnTitle}>Join Queue — Any Table</div>
            <div style={s.anyBtnSub}>Quickest available · We'll assign the best fit</div>
          </div>
          <div style={s.anyArrow}>→</div>
        </button>
      </div>

{/* Floor Map */}
      <div style={s.mapArea}>
        <svg
          viewBox="0 0 560 490"
          style={{display:'block',width:'100%',height:'auto',aspectRatio:'560/490'}}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="560" height="490" fill="var(--map-bg)"/>
          <rect x="0" y="0" width="560" height="90" fill="var(--map-zone-window)" stroke="var(--border)" strokeWidth=".5"/>
          <rect x="0" y="90" width="60" height="260" fill="var(--map-zone-outdoor)" stroke="var(--border)" strokeWidth=".5"/>
          <rect x="500" y="90" width="60" height="260" fill="var(--map-zone-outdoor)" stroke="var(--border)" strokeWidth=".5"/>
          <rect x="60" y="90" width="440" height="170" fill="var(--map-zone-indoor)" stroke="var(--border)" strokeWidth=".5"/>
          <rect x="60" y="260" width="440" height="90" fill="var(--map-zone-private)" stroke="var(--border)" strokeWidth=".5"/>
          <rect x="0" y="350" width="560" height="130" fill="var(--map-zone-bottom)" stroke="var(--border)" strokeWidth=".5"/>
          <text x="280" y="13" textAnchor="middle" fontSize="8" letterSpacing="3" fill="var(--map-label)" fontFamily="Jost,sans-serif">WINDOW SEATING</text>
          <text x="30" y="110" textAnchor="middle" fontSize="6" fill="var(--map-outdoor-label)" fontFamily="Jost,sans-serif">OUT</text>
          <text x="530" y="110" textAnchor="middle" fontSize="6" fill="var(--map-outdoor-label)" fontFamily="Jost,sans-serif">OUT</text>
          <text x="280" y="105" textAnchor="middle" fontSize="8" letterSpacing="2.5" fill="var(--map-zone-label)" fontFamily="Jost,sans-serif">INDOOR DINING</text>
          <text x="280" y="275" textAnchor="middle" fontSize="8" letterSpacing="2.5" fill="var(--map-zone-label)" fontFamily="Jost,sans-serif">PRIVATE DINING</text>
          <text x="280" y="365" textAnchor="middle" fontSize="8" letterSpacing="2.5" fill="var(--map-outdoor-label)" fontFamily="Jost,sans-serif">OUTDOOR TERRACE</text>
          <rect x="180" y="90" width="200" height="26" fill="var(--map-kitchen)" stroke="var(--border)" strokeWidth=".5" rx="1"/>
          <text x="280" y="106" textAnchor="middle" fontSize="6" letterSpacing="2" fill="var(--map-label)" fontFamily="Jost,sans-serif">KITCHEN · STAFF ONLY</text>
          {[[150,170],[410,170],[150,240],[410,240]].map(([cx,cy],i) => (
            <circle key={i} cx={cx} cy={cy} r="5" fill="var(--pillar)" stroke="var(--pillar-border)" strokeWidth="1"/>
          ))}
          <rect x="210" y="468" width="140" height="14" fill="var(--map-entrance)" stroke="var(--border2)" strokeWidth=".5" rx="2"/>
          <text x="280" y="479" textAnchor="middle" fontSize="6" letterSpacing="2" fill="var(--map-label)" fontFamily="Jost,sans-serif">ENTRANCE</text>
          {tables
            .filter(t => zone === 'all' || t.zone === zone)
            .map(t => {
              const scale = 2;
              const x = t.x_pos * scale;
              const y = t.y_pos * scale;
              const w = t.width * scale;
              const h = t.height * scale;
              const cx = x + w/2;
              const cy = y + h/2;
              const isSel = selectedTable?.id === t.id;
              return (
                <g key={t.id} style={{cursor:'pointer'}}
                  onClick={() => setSelectedTable(selectedTable?.id === t.id ? null : t)}>
                  <rect x={x} y={y} width={w} height={h}
                    rx={t.seats >= 8 ? 4 : 3}
                    fill={isSel ? 'rgba(201,168,76,.2)' : 'var(--map-table)'}
                    stroke={isSel ? '#C9A84C' : t.is_popular ? '#8a6e2f' : 'var(--map-table-border)'}
                    strokeWidth={isSel ? 2 : 1}
                  />
                  <text x={cx} y={cy-3} textAnchor="middle" dominantBaseline="middle"
                    fontSize={t.seats>=8?11:10} fontFamily="Jost,sans-serif"
                    fill={isSel?'#C9A84C':'var(--text2)'}>
                    {t.table_label}
                  </text>
                  <text x={cx} y={cy+9} textAnchor="middle" dominantBaseline="middle"
                    fontSize={8} fontFamily="Jost,sans-serif" fill="var(--text3)">
                    {t.seats}p
                  </text>
                </g>
              );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={s.legend}>
        {[
          {bg:'var(--map-table)', border:'1px solid var(--map-table-border)', label:'Available'},
          {bg:'rgba(201,168,76,.2)', border:'1px solid #C9A84C', label:'Selected'},
          {bg:'transparent', border:'1px solid #8a6e2f', label:'Popular'},
        ].map((l,i) => (
          <div key={i} style={s.leg}>
            <div style={{...s.ld, background:l.bg, border:l.border}}></div>
            {l.label}
          </div>
        ))}
      </div>

      {/* Tray */}
      <div style={s.tray}>
        {!selectedTable
          ? <div style={s.trayEmpty}>Tap a table — or use "Any Table" above</div>
          : <div style={s.trayInfo}>
              <div style={{flex:1}}>
                <div style={s.trayName}>
                  Table {selectedTable.table_label} · {selectedTable.seats}-Seater
                </div>
                <div style={s.trayMeta}>
                  {selectedTable.zone.charAt(0).toUpperCase()+selectedTable.zone.slice(1)} Seating
                  {selectedTable.is_popular ? ' · Popular' : ''}
                </div>
              </div>
              <button style={s.trayBtn} onClick={() => goToJoin(selectedTable)}>
                Reserve →
              </button>
            </div>
        }
      </div>
    </div>
  );
}

const s: any = {
  page:{
    background:'var(--bg)',
    display:'flex',
    flexDirection:'column',
    width:'100%',
    minHeight:'100vh',
    fontFamily:"'Jost',sans-serif",
    fontWeight:300
  },
  header:{
    padding:'12px 16px 10px',
    borderBottom:'1px solid var(--border)',
    background:'var(--bg)',
    flexShrink:0
  },
  hTop:{
    display:'flex',
    alignItems:'flex-start',
    justifyContent:'space-between',
    marginBottom:10,
    gap:8
  },
  restName:{
    fontFamily:"'Cormorant Garamond',serif",
    fontSize:20,
    color:'var(--text)',
    lineHeight:1.2
  },
  restAddr:{
    fontSize:9,
    letterSpacing:'1px',
    color:'var(--text3)',
    marginTop:2
  },
  liveBadge:{
    display:'flex',
    alignItems:'center',
    gap:5,
    background:'rgba(74,158,110,.1)',
    border:'1px solid #2d6145',
    borderRadius:2,
    padding:'4px 9px',
    flexShrink:0
  },
  liveDot:{
    width:6,
    height:6,
    borderRadius:'50%',
    background:'#4a9e6e',
    display:'inline-block',
    animation:'p 1.5s ease-in-out infinite'
  },
  liveTxt:{
    fontSize:8,
    letterSpacing:'1.5px',
    textTransform:'uppercase',
    color:'#4a9e6e'
  },
  statsRow:{
    display:'flex',
    marginBottom:10,
    background:'var(--bg3)',
    border:'1px solid var(--border)',
    borderRadius:3,
    overflow:'hidden'
  },
  stat:{flex:1,padding:'8px 4px',textAlign:'center'},
  sv:{
    fontFamily:"'Cormorant Garamond',serif",
    fontSize:18,
    lineHeight:1,
    color:'var(--text)'
  },
  sl:{
    fontSize:6,
    letterSpacing:'1px',
    textTransform:'uppercase',
    color:'var(--text3)',
    marginTop:2
  },
  filterRow:{
    display:'flex',
    gap:5,
    flexWrap:'wrap'
  },
  fb:{
    background:'transparent',
    border:'1px solid var(--border2)',
    color:'var(--text3)',
    fontFamily:"'Jost',sans-serif",
    fontSize:8,
    letterSpacing:'1px',
    textTransform:'uppercase',
    padding:'5px 10px',
    borderRadius:2,
    cursor:'pointer'
  },
  fbOn:{
    background:'rgba(201,168,76,.1)',
    borderColor:'var(--gold)',
    color:'var(--gold)'
  },
  anyWrap:{
    padding:'10px 16px',
    borderBottom:'1px solid var(--border)',
    flexShrink:0
  },
  anyBtn:{
    width:'100%',
    background:'rgba(201,168,76,.06)',
    border:'1px solid #8a6e2f',
    borderRadius:3,
    padding:'10px 14px',
    cursor:'pointer',
    display:'flex',
    alignItems:'center',
    gap:12,
    textAlign:'left'
  },
  anyBtnLeft:{flex:1},
  anyBtnTitle:{
    fontSize:12,
    color:'var(--gold)',
    fontFamily:"'Jost',sans-serif",
    fontWeight:500,
    letterSpacing:'.5px',
    marginBottom:2
  },
  anyBtnSub:{fontSize:9,color:'var(--text3)',letterSpacing:'.5px'},
  anyArrow:{fontSize:18,color:'var(--gold)'},
  mapArea:{
    width:'100%',
    background:'var(--map-bg)',
    flexShrink:0,
    lineHeight:0,
  fontSize:0,
  },
  legend:{
    display:'flex',
    gap:12,
    padding:'8px 16px',
    borderTop:'1px solid var(--border)',
    flexWrap:'wrap',
    background:'var(--bg)',
    flexShrink:0
  },
  leg:{
    display:'flex',
    alignItems:'center',
    gap:5,
    fontSize:7,
    letterSpacing:'1px',
    textTransform:'uppercase',
    color:'var(--text3)'
  },
  ld:{width:10,height:10,borderRadius:1,flexShrink:0},
  tray:{
    padding:'12px 16px 24px',
    borderTop:'1px solid var(--border)',
    background:'var(--bg)',
    flexShrink:0,
    minHeight:64
  },
  trayEmpty:{
    fontSize:9,
    letterSpacing:'1.5px',
    textTransform:'uppercase',
    color:'var(--text3)',
    textAlign:'center',
    padding:'8px 0'
  },
  trayInfo:{display:'flex',alignItems:'center',gap:12},
  trayName:{
    fontFamily:"'Cormorant Garamond',serif",
    fontSize:19,
    color:'var(--text)',
    flex:1
  },
  trayMeta:{
    fontSize:8,
    letterSpacing:'1px',
    textTransform:'uppercase',
    color:'var(--text3)',
    marginTop:1
  },
  trayBtn:{
    background:'var(--gold)',
    border:'none',
    color:'#0d0d0d',
    fontFamily:"'Jost',sans-serif",
    fontSize:9,
    letterSpacing:'2px',
    textTransform:'uppercase',
    padding:'11px 16px',
    borderRadius:2,
    cursor:'pointer',
    fontWeight:500,
    whiteSpace:'nowrap'
  },
};