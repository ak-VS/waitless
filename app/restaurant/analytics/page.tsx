'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { getStaffSession } from '@/lib/staff-auth';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Analytics() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getStaffSession();
    if (!session) { router.push('/staff/login'); return; }
    setRestaurant(session.restaurant);

    fetch(`/api/restaurant/analytics?restaurant_id=${session.restaurant.id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d); setLoading(false); });
  }, [router]);

  if (loading) return (
    <div style={{background:'var(--bg)',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,border:'2px solid var(--border)',borderTop:'2px solid var(--gold)',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const maxHour = Math.max(...(data?.peak_hours?.map((h: any) => parseInt(h.count)) || [1]));
  const maxDay = Math.max(...(data?.peak_days?.map((d: any) => parseInt(d.count)) || [1]));
  const noShowRate = data?.no_show?.total_notified > 0
    ? Math.round((data.no_show.no_shows / data.no_show.total_notified) * 100)
    : 0;

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh',fontFamily:"'Jost',sans-serif",fontWeight:300}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* Header */}
      <div style={{background:'var(--bg2)',borderBottom:'1px solid var(--border)',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:'var(--text)',fontWeight:300}}>{restaurant?.name}</span>
          <span style={{fontSize:10,color:'var(--text3)',marginLeft:8,letterSpacing:'1px'}}>Analytics</span>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={() => router.push('/staff/dashboard')}
            style={{background:'transparent',border:'1px solid var(--border2)',color:'var(--text3)',fontFamily:"'Jost',sans-serif",fontSize:8,letterSpacing:'1.5px',textTransform:'uppercase',padding:'5px 10px',borderRadius:2,cursor:'pointer'}}>
            ← Dashboard
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'20px 16px'}}>

        {/* Today stats */}
        <div style={{fontSize:8,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text3)',marginBottom:12}}>Today</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:24}}>
          {[
            {v: data?.today?.seated_today || 0, l: 'Seated', c:'#4a9e6e'},
            {v: data?.today?.currently_waiting || 0, l: 'Waiting now', c:'var(--gold)'},
            {v: data?.today?.skipped_today || 0, l: 'No shows', c:'#c94c4c'},
            {v: `${data?.today?.avg_estimated_wait || 0}m`, l: 'Avg wait', c:'var(--text)'},
          ].map((item, i) => (
            <div key={i} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,padding:'14px 12px',textAlign:'center'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,color:item.c,lineHeight:1}}>{item.v}</div>
              <div style={{fontSize:7,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text3)',marginTop:4}}>{item.l}</div>
            </div>
          ))}
        </div>

        {/* This week */}
        <div style={{fontSize:8,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text3)',marginBottom:12}}>This week</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:24}}>
          {[
            {v: data?.week?.seated_week || 0, l: 'Total seated'},
            {v: `${data?.dwell?.avg_dwell || 0}m`, l: 'Avg dwell time'},
            {v: `${noShowRate}%`, l: 'No-show rate'},
          ].map((item, i) => (
            <div key={i} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,padding:'14px 12px',textAlign:'center'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,color:'var(--text)',lineHeight:1}}>{item.v}</div>
              <div style={{fontSize:7,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text3)',marginTop:4}}>{item.l}</div>
            </div>
          ))}
        </div>

        {/* Peak hours chart */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'16px',marginBottom:16}}>
          <div style={{fontSize:8,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:16}}>Peak hours · last 7 days</div>
          {data?.peak_hours?.length > 0 ? (
            <div style={{display:'flex',alignItems:'flex-end',gap:4,height:80}}>
              {Array.from({length:24},(_,i) => {
                const hour = data.peak_hours.find((h: any) => parseInt(h.hour) === i);
                const count = hour ? parseInt(hour.count) : 0;
                const height = maxHour > 0 ? Math.round((count/maxHour)*70) : 0;
                const isPeak = count === maxHour && count > 0;
                return (
                  <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                    <div style={{
                      width:'100%', height:height || 2,
                      background: isPeak ? 'var(--gold)' : count > 0 ? '#4a9e6e' : 'var(--border)',
                      borderRadius:2, transition:'height .3s'
                    }}></div>
                    {i % 3 === 0 && <div style={{fontSize:6,color:'var(--text3)'}}>{i}</div>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{textAlign:'center',fontSize:11,color:'var(--text3)',padding:'20px 0'}}>No data yet</div>
          )}
        </div>

        {/* Peak days chart */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'16px',marginBottom:16}}>
          <div style={{fontSize:8,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:16}}>Peak days · last 30 days</div>
          {data?.peak_days?.length > 0 ? (
            <div style={{display:'flex',alignItems:'flex-end',gap:8,height:80}}>
              {DAYS.map((day, i) => {
                const d = data.peak_days.find((p: any) => parseInt(p.day) === i);
                const count = d ? parseInt(d.count) : 0;
                const height = maxDay > 0 ? Math.round((count/maxDay)*70) : 0;
                const isPeak = count === maxDay && count > 0;
                return (
                  <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <div style={{
                      width:'100%', height:height || 2,
                      background: isPeak ? 'var(--gold)' : count > 0 ? '#4a9e6e' : 'var(--border)',
                      borderRadius:2
                    }}></div>
                    <div style={{fontSize:7,color:'var(--text3)'}}>{day}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{textAlign:'center',fontSize:11,color:'var(--text3)',padding:'20px 0'}}>No data yet</div>
          )}
        </div>

        {/* Table utilization */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'16px',marginBottom:16}}>
          <div style={{fontSize:8,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:12}}>Table utilization · last 7 days</div>
          {data?.table_utilization?.length > 0 ? (
            <div>
              {data.table_utilization.map((t: any, i: number) => {
                const maxSessions = Math.max(...data.table_utilization.map((x: any) => parseInt(x.session_count)));
                const pct = maxSessions > 0 ? Math.round((parseInt(t.session_count)/maxSessions)*100) : 0;
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                    <div style={{width:32,fontSize:10,color:'var(--text)',fontFamily:"'Cormorant Garamond',serif"}}>{t.table_label}</div>
                    <div style={{fontSize:7,letterSpacing:'1px',textTransform:'uppercase',color:'var(--text3)',width:50,textAlign:'right'}}>{t.zone}</div>
                    <div style={{flex:1,height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,background:'#4a9e6e',borderRadius:3,transition:'width .5s'}}></div>
                    </div>
                    <div style={{fontSize:9,color:'var(--text3)',width:30,textAlign:'right'}}>{t.session_count}x</div>
                    <div style={{fontSize:9,color:'var(--text3)',width:40,textAlign:'right'}}>{t.avg_dwell||0}m</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{textAlign:'center',fontSize:11,color:'var(--text3)',padding:'20px 0'}}>No session data yet</div>
          )}
        </div>

        {/* Daily trend */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'16px',marginBottom:24}}>
          <div style={{fontSize:8,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text3)',marginBottom:12}}>Daily trend · last 7 days</div>
          {data?.daily_trend?.length > 0 ? (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                <thead>
                  <tr>
                    {['Date','Total','Seated','Conversion'].map(h => (
                      <th key={h} style={{fontSize:7,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text3)',padding:'4px 8px',textAlign:'left',borderBottom:'1px solid var(--border)',fontWeight:400}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.daily_trend.map((d: any, i: number) => {
                    const conv = d.total > 0 ? Math.round((d.seated/d.total)*100) : 0;
                    return (
                      <tr key={i}>
                        <td style={{padding:'8px',color:'var(--text)',fontSize:11}}>{new Date(d.date).toLocaleDateString('en-IN',{weekday:'short',month:'short',day:'numeric'})}</td>
                        <td style={{padding:'8px',color:'var(--text)',fontSize:11}}>{d.total}</td>
                        <td style={{padding:'8px',color:'#4a9e6e',fontSize:11}}>{d.seated}</td>
                        <td style={{padding:'8px',fontSize:11}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <div style={{width:40,height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${conv}%`,background:conv>70?'#4a9e6e':conv>40?'var(--gold)':'#c94c4c',borderRadius:2}}></div>
                            </div>
                            <span style={{color:'var(--text3)'}}>{conv}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{textAlign:'center',fontSize:11,color:'var(--text3)',padding:'20px 0'}}>No data yet</div>
          )}
        </div>

      </div>
    </div>
  );
}