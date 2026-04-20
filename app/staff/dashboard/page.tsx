'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { getStaffSession, clearStaffSession } from '@/lib/staff-auth';
import { io, Socket } from 'socket.io-client';

export default function StaffDashboard() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState<any>(null);
  const [toast, setToast] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [clock, setClock] = useState('');
  const [loading, setLoading] = useState(true);
  const [closingNight, setClosingNight] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const showToastMsg = (msg: string) => {
    setToast(msg); setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  useEffect(() => {
    const session = getStaffSession();
    if (!session) { router.push('/staff/login'); return; }
    setRestaurant(session.restaurant);
  }, [router]);

  const fetchData = useCallback(async () => {
    if (!restaurant) return;
    const [tablesRes, queueRes] = await Promise.all([
      fetch(`/api/staff/tables?restaurant_id=${restaurant.id}`).then(r => r.json()),
      fetch(`/api/staff/queue?restaurant_id=${restaurant.id}`).then(r => r.json()),
    ]);
    if (tablesRes.success) setTables(tablesRes.tables);
    if (queueRes.success) { setQueue(queueRes.queue); setStats(queueRes.stats); }
    setLoading(false);
  }, [restaurant]);

  useEffect(() => {
    if (!restaurant) return;
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData, restaurant]);

  useEffect(() => {
    if (!restaurant) return;
    if (socketRef.current) return;
    const socketUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const socket = io(socketUrl, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => { socket.emit('join_restaurant', restaurant.id); });
    socket.on('queue_updated', (data: any) => {
      fetchData();
      if (data.type === 'new_customer') showToastMsg(`New customer joined · ${data.entry.customer_name} (${data.entry.token})`);
    });
    socket.on('restaurant_closed', () => { fetchData(); showToastMsg('Restaurant closed for the night'); });
    socket.on('table_updated', () => { fetchData(); });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [restaurant, fetchData]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: restaurant?.timezone || 'Asia/Kolkata'
    }));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [restaurant]);

  const executeTableAction = async (action: string, tableId: string, partySize?: number) => {
    const res = await fetch('/api/staff/tables', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_id: tableId, action, restaurant_id: restaurant.id, party_size: partySize })
    });
    const data = await res.json();
    if (action === 'exit') {
      if (data.notified_customer) showToastMsg(`Table free · ${data.notified_customer.name} (${data.notified_customer.token}) notified ✓`);
      else showToastMsg('Table cleared · No one in queue');
    } else if (action === 'delay') showToastMsg('Table marked for cleaning');
    else if (action === 'ready') showToastMsg('Table ready · Auto-assigning next customer');
    else if (action === 'occupy') showToastMsg('Walk-in seated · Session started');
    setConfirm(null); setDrawer(false); setSelectedTable(null);
    fetchData();
  };

  const prioritizeEntry = async (entry: any) => {
    const res = await fetch('/api/staff/queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_entry_id: entry.id, action: 'prioritize', restaurant_id: restaurant.id })
    });
    const data = await res.json();
    showToastMsg(data.priority === 'vip' ? `★ ${entry.customer_name} marked as priority` : `${entry.customer_name} moved to normal queue`);
    fetchData();
  };

  const skipQueue = async (entry: any) => {
    await fetch('/api/staff/queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_entry_id: entry.id, action: 'skip', restaurant_id: restaurant.id })
    });
    showToastMsg(`Token ${entry.token} skipped`);
    fetchData();
  };

  const handleNoShow = async (table: any) => {
    if (table.current_queue_entry_id) {
      await fetch('/api/staff/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue_entry_id: table.current_queue_entry_id, action: 'skip', restaurant_id: restaurant.id })
      });
    }
    await fetch('/api/staff/tables', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_id: table.id, action: 'exit', restaurant_id: restaurant.id })
    });
    showToastMsg(`No show · Table ${table.table_label} freed`);
    setDrawer(false); setSelectedTable(null);
    fetchData();
  };

  const seatCustomerNow = async (entry: any) => {
    const bestTable = tables.find(t =>
      t.status === 'free' &&
      t.seats >= entry.party_size &&
      (entry.zone_preference === 'any' || t.zone === entry.zone_preference)
    ) || tables.find(t => t.status === 'free' && t.seats >= entry.party_size);

    if (!bestTable) { showToastMsg('No suitable free table available'); return; }

    await fetch('/api/staff/tables', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_id: bestTable.id,
        action: 'seat_customer',
        queue_entry_id: entry.id,
        restaurant_id: restaurant.id,
        party_size: entry.party_size
      })
    });

    showToastMsg(`${entry.customer_name} notified · Table ${bestTable.table_label} reserved`);
    fetchData();
  };

  const handleCloseNight = async () => {
    setClosingNight(true);
    const res = await fetch('/api/staff/closenight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurant.id })
    });
    const data = await res.json();
    if (data.success) showToastMsg(`Night closed · ${data.customers_notified} customers notified · All tables cleared`);
    setShowCloseConfirm(false); setClosingNight(false);
    fetchData();
  };

  const handleLogout = () => { clearStaffSession(); router.push('/staff/login'); };

  const freeCount = tables.filter(t => t.status === 'free').length;
  const occCount = tables.filter(t => t.status === 'occupied').length;
  const cleanCount = tables.filter(t => t.status === 'cleaning').length;
  const isPremium = restaurant?.subscription === 'premium';

  const getTableColor = (t: any) => {
    if (t.status === 'occupied') return { bg: 'rgba(201,76,76,.18)', border: '#c94c4c', text: '#e88080' };
    if (t.status === 'reserved') return { bg: 'rgba(201,168,76,.12)', border: '#C9A84C', text: '#C9A84C' };
    if (t.status === 'cleaning') return { bg: 'rgba(212,134,58,.1)', border: '#d4863a', text: '#d4863a' };
    return { bg: 'var(--bg3)', border: '#2d4a2d', text: '#5a5448' };
  };

  const zones = [
    { id: 'window', label: 'Window Seating' },
    { id: 'indoor', label: 'Indoor Dining' },
    { id: 'private', label: 'Private Dining' },
    { id: 'outdoor', label: 'Outdoor Terrace' },
  ];

  if (loading || !restaurant) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: "'Jost',sans-serif", fontWeight: 300 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:var(--bg2)}
        ::-webkit-scrollbar-thumb{background:var(--border2)}
      `}</style>

      <div style={{ position: 'fixed', top: 16, left: '50%', transform: `translateX(-50%) translateY(${showToast ? '0' : '-100px'})`, background: 'var(--bg3)', border: '1px solid #2d6145', borderRadius: 8, padding: '10px 20px', fontSize: 11, color: 'var(--text)', zIndex: 999, transition: 'transform .3s cubic-bezier(.34,1.4,.64,1)', whiteSpace: 'nowrap' }}>{toast}</div>

      {/* Top bar */}
      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: 'var(--text)', fontWeight: 300 }}>{restaurant.name}</span>
          <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8, letterSpacing: '1px' }}>Staff Dashboard</span>
          <div style={{ fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginTop: 2 }}>{restaurant.city} · {isPremium ? 'Premium' : 'Base'} plan</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(74,158,110,.1)', border: '1px solid #2d6145', borderRadius: 2, padding: '4px 10px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4a9e6e', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }}></span>
            <span style={{ fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#4a9e6e' }}>Live</span>
          </div>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 14, color: 'var(--text3)', letterSpacing: 1 }}>{clock}</span>
          <ThemeToggle />
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text3)', fontFamily: "'Jost',sans-serif", fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '5px 10px', borderRadius: 2, cursor: 'pointer' }}>Logout</button>
          <button onClick={() => setShowCloseConfirm(true)} style={{ background: 'transparent', border: '1px solid #c94c4c', color: '#c94c4c', fontFamily: "'Jost',sans-serif", fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '5px 10px', borderRadius: 2, cursor: 'pointer' }}>Close Night</button>
          <button onClick={() => router.push('/restaurant/analytics')} style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text3)', fontFamily: "'Jost',sans-serif", fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '5px 10px', borderRadius: 2, cursor: 'pointer' }}>Analytics</button>
          <button onClick={() => router.push('/restaurant/profile')} style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text3)', fontFamily: "'Jost',sans-serif", fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '5px 10px', borderRadius: 2, cursor: 'pointer' }}>Profile</button>
        </div>
      </div>

      {/* Close night confirm */}
      {showCloseConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid #c94c4c', borderRadius: 8, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: 'var(--text)', marginBottom: 8 }}>Close for the night?</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 20 }}>This will skip all customers in queue, notify them, clear all tables and end all active sessions. This cannot be undone.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleCloseNight} disabled={closingNight} style={{ flex: 1, background: '#c94c4c', border: 'none', color: '#fff', fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', padding: 12, borderRadius: 3, cursor: 'pointer', fontWeight: 500, opacity: closingNight ? .7 : 1 }}>{closingNight ? 'Closing...' : 'Yes, Close Night'}</button>
              <button onClick={() => setShowCloseConfirm(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text3)', fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', padding: 12, borderRadius: 3, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        {[
          { v: queue.length, l: 'In queue', c: queue.length > 5 ? '#c94c4c' : 'var(--text)' },
          { v: freeCount, l: 'Tables free', c: freeCount > 0 ? '#4a9e6e' : '#c94c4c' },
          { v: occCount, l: 'Occupied', c: 'var(--text)' },
          { v: cleanCount > 0 ? cleanCount : stats.seated_today || 0, l: cleanCount > 0 ? 'Cleaning' : 'Seated today', c: cleanCount > 0 ? '#d4863a' : 'var(--text)' },
          { v: `~${Math.max(5, queue.length * 8)}m`, l: 'Avg wait', c: 'var(--text)' },
        ].map((item, i, arr) => (
          <div key={i} style={{ flex: 1, padding: '10px 8px', textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: item.c, lineHeight: 1, transition: '.3s' }}>{item.v}</div>
            <div style={{ fontSize: 7, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginTop: 2 }}>{item.l}</div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: isPremium ? 'minmax(0,1fr) 280px' : '1fr 280px', gap: 0, minHeight: 'calc(100vh - 130px)' }}>

        {/* Floor section */}
        <div style={{ padding: '16px', borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          {isPremium ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 8, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text3)' }}>Live floor · tap table to manage</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { bg: 'var(--bg3)', border: '#2d4a2d', label: 'Free' },
                    { bg: 'rgba(201,76,76,.18)', border: '#c94c4c', label: 'Occupied' },
                    { bg: 'rgba(201,168,76,.12)', border: '#C9A84C', label: 'Reserved' },
                    { bg: 'rgba(212,134,58,.1)', border: '#d4863a', label: 'Cleaning' },
                  ].map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 7, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)' }}>
                      <div style={{ width: 9, height: 9, borderRadius: 1, background: l.bg, border: `1px solid ${l.border}`, flexShrink: 0 }}></div>
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
              {zones.map(zone => {
                const zoneTables = tables.filter(t => t.zone === zone.id);
                if (zoneTables.length === 0) return null;
                return (
                  <div key={zone.id} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{zone.label}</span><span style={{ color: 'var(--border2)' }}>·</span>
                      <span style={{ color: '#4a9e6e' }}>{zoneTables.filter(t => t.status === 'free').length} free</span>
                      {zoneTables.filter(t => t.status === 'occupied').length > 0 && (<><span style={{ color: 'var(--border2)' }}>·</span><span style={{ color: '#e88080' }}>{zoneTables.filter(t => t.status === 'occupied').length} occupied</span></>)}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {zoneTables.map(t => {
                        const col = getTableColor(t);
                        const isSel = selectedTable?.id === t.id;
                        const size = t.seats >= 10 ? 92 : t.seats >= 8 ? 84 : t.seats >= 6 ? 76 : t.seats >= 4 ? 68 : 58;
                        return (
                          <div key={t.id} onClick={() => { setSelectedTable(t); setDrawer(true); }}
                            style={{ width: size, height: size, background: col.bg, border: `${isSel ? 2 : 1}px solid ${isSel ? '#fff' : col.border}`, borderRadius: 4, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', position: 'relative' }}>
                            {t.status === 'occupied' && <div style={{ fontSize: 8, color: '#e88080', marginBottom: 1 }}>{Math.round(t.minutes_seated || 0)}m</div>}
                            {t.status === 'cleaning' && <div style={{ fontSize: 8, color: '#d4863a', marginBottom: 1 }}>clean</div>}
                            {t.status === 'reserved' && <div style={{ fontSize: 8, color: '#C9A84C', marginBottom: 1 }}>rsv</div>}
                            <div style={{ fontSize: t.seats >= 8 ? 12 : 11, color: col.text, fontWeight: 400 }}>{t.table_label}</div>
                            <div style={{ fontSize: 8, color: 'var(--text3)', marginTop: 2 }}>{t.seats}p</div>
                            {t.is_popular && t.status === 'free' && <div style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', border: '2px solid var(--bg)' }}></div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div style={{ fontSize: 8, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 16 }}>Tables · tap to manage</div>
              {['indoor', 'outdoor', 'window', 'private'].map(zone => {
                const zoneTables = tables.filter(t => t.zone === zone);
                if (zoneTables.length === 0) return null;
                return (
                  <div key={zone} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{zone.charAt(0).toUpperCase() + zone.slice(1)}</span><span style={{ color: 'var(--border2)' }}>·</span>
                      <span style={{ color: '#4a9e6e' }}>{zoneTables.filter(t => t.status === 'free').length} free</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {zoneTables.map(t => {
                        const col = getTableColor(t);
                        const isSel = selectedTable?.id === t.id;
                        const size = t.seats >= 8 ? 84 : t.seats >= 6 ? 76 : t.seats >= 4 ? 68 : 58;
                        return (
                          <div key={t.id} onClick={() => { setSelectedTable(t); setDrawer(true); }}
                            style={{ width: size, height: size, background: col.bg, border: `${isSel ? 2 : 1}px solid ${isSel ? '#fff' : col.border}`, borderRadius: 4, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', position: 'relative' }}>
                            {t.status === 'occupied' && <div style={{ fontSize: 8, color: '#e88080', marginBottom: 1 }}>{Math.round(t.minutes_seated || 0)}m</div>}
                            {t.status === 'cleaning' && <div style={{ fontSize: 8, color: '#d4863a', marginBottom: 1 }}>clean</div>}
                            {t.status === 'reserved' && <div style={{ fontSize: 8, color: '#C9A84C', marginBottom: 1 }}>rsv</div>}
                            <div style={{ fontSize: 11, color: col.text }}>{t.table_label}</div>
                            <div style={{ fontSize: 8, color: 'var(--text3)', marginTop: 2 }}>{t.seats}p</div>
                            {t.is_popular && t.status === 'free' && <div style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', border: '2px solid var(--bg)' }}></div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Queue panel */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg2)', borderLeft: '1px solid var(--border)', maxHeight: 'calc(100vh - 130px)', position: 'sticky', top: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text3)' }}>
              Queue <span style={{ color: 'var(--gold)' }}>{queue.length > 0 ? `(${queue.length})` : ''}</span>
            </div>
            {queue.filter(e => e.priority === 'vip').length > 0 && (
              <div style={{ fontSize: 7, letterSpacing: '1px', color: 'var(--gold)', background: 'rgba(201,168,76,.1)', border: '1px solid #8a6e2f', borderRadius: 2, padding: '3px 8px' }}>
                ★ {queue.filter(e => e.priority === 'vip').length} priority
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {queue.length === 0 ? (
              <div style={{ padding: '32px 12px', textAlign: 'center', fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)' }}>No one in queue</div>
            ) : queue.map((entry, i) => (
              <div key={entry.id} style={{
                background: entry.priority === 'vip' ? 'rgba(201,168,76,.08)' : i === 0 ? 'rgba(201,168,76,.04)' : 'var(--bg3)',
                border: `1px solid ${entry.priority === 'vip' ? 'var(--gold)' : i === 0 ? 'var(--gold)' : 'var(--border)'}`,
                borderRadius: 3, padding: '10px 12px', marginBottom: 6, position: 'relative', overflow: 'hidden', animation: 'slideUp .2s ease',
              }}>
                {entry.priority === 'vip' && <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--gold)', color: '#0d0d0d', fontSize: 6, letterSpacing: '1.5px', padding: '3px 7px', fontWeight: 500 }}>★ PRIORITY</div>}
                {entry.priority !== 'vip' && i === 0 && <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--border2)', color: 'var(--text2)', fontSize: 6, letterSpacing: '1.5px', padding: '3px 7px' }}>NEXT</div>}
                {entry.notified_at && <div style={{ position: 'absolute', top: 0, left: 0, background: '#4a9e6e', color: '#fff', fontSize: 6, letterSpacing: '1px', padding: '3px 7px', fontWeight: 500 }}>NOTIFIED</div>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, marginTop: (entry.priority === 'vip' || entry.notified_at) ? 10 : 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{entry.customer_name}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: entry.priority === 'vip' ? 'var(--gold)' : 'var(--text2)' }}>{entry.token}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 7, letterSpacing: '1px', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 1, border: '1px solid var(--border2)', color: 'var(--text3)' }}>{entry.party_size}p</div>
                  <div style={{ fontSize: 7, letterSpacing: '1px', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 1, border: '1px solid var(--border2)', color: 'var(--text3)' }}>{entry.zone_preference}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 'auto' }}>
                    {new Date(entry.joined_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: restaurant?.timezone || 'Asia/Kolkata' })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => prioritizeEntry(entry)}
                    style={{ flex: 1, background: entry.priority === 'vip' ? 'rgba(201,168,76,.1)' : 'transparent', border: `1px solid ${entry.priority === 'vip' ? 'var(--gold)' : 'var(--border2)'}`, color: entry.priority === 'vip' ? 'var(--gold)' : 'var(--text3)', fontFamily: "'Jost',sans-serif", fontSize: 7, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '6px 4px', borderRadius: 2, cursor: 'pointer' }}>
                    {entry.priority === 'vip' ? '★ VIP' : '☆ VIP'}
                  </button>
                  {freeCount > 0 && !entry.notified_at && (
                    <button onClick={() => seatCustomerNow(entry)}
                      style={{ flex: 1, background: 'rgba(74,158,110,.1)', border: '1px solid #2d6145', color: '#4a9e6e', fontFamily: "'Jost',sans-serif", fontSize: 7, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '6px 4px', borderRadius: 2, cursor: 'pointer' }}>
                      Seat Now
                    </button>
                  )}
                  <button onClick={() => skipQueue(entry)}
                    style={{ flex: 1, background: 'transparent', border: '1px solid #5a3030', color: '#c94c4c', fontFamily: "'Jost',sans-serif", fontSize: 7, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '6px 4px', borderRadius: 2, cursor: 'pointer' }}>
                    Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table drawer */}
      {drawer && selectedTable && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setDrawer(false); setSelectedTable(null); } }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '12px 12px 0 0', padding: '20px', width: '100%', animation: 'slideUp .25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: 'var(--text)' }}>Table {selectedTable.table_label}</div>
              <button onClick={() => { setDrawer(false); setSelectedTable(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 14 }}>
              {selectedTable.zone} · {selectedTable.seats}-Seater ·{' '}
              <span style={{ color: selectedTable.status === 'occupied' ? '#e88080' : selectedTable.status === 'reserved' ? '#C9A84C' : selectedTable.status === 'cleaning' ? '#d4863a' : '#4a9e6e', textTransform: 'capitalize' }}>{selectedTable.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { v: selectedTable.seats, l: 'Seats' },
                { v: selectedTable.current_party || '—', l: 'Party' },
                { v: selectedTable.status === 'occupied' ? `${Math.round(selectedTable.minutes_seated || 0)}m` : '—', l: 'Seated for' },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 3, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: 'var(--text)' }}>{item.v}</div>
                  <div style={{ fontSize: 7, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginTop: 2 }}>{item.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedTable.status === 'occupied' && (
                <>
                  <button style={{ flex: 2, background: '#4a9e6e', border: 'none', color: '#fff', fontFamily: "'Jost',sans-serif", fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', padding: 14, borderRadius: 3, cursor: 'pointer', fontWeight: 500 }}
                    onClick={() => setConfirm({ action: 'exit', table: selectedTable })}>✓ Customer Exited</button>
                  <button style={{ flex: 1, background: 'transparent', border: '1px solid #d4863a', color: '#d4863a', fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', padding: 14, borderRadius: 3, cursor: 'pointer' }}
                    onClick={() => executeTableAction('delay', selectedTable.id)}>Needs Cleaning</button>
                </>
              )}
              {selectedTable.status === 'cleaning' && (
                <button style={{ flex: 1, background: '#4a9e6e', border: 'none', color: '#fff', fontFamily: "'Jost',sans-serif", fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', padding: 14, borderRadius: 3, cursor: 'pointer', fontWeight: 500 }}
                  onClick={() => executeTableAction('ready', selectedTable.id)}>Table Ready</button>
              )}
              {selectedTable.status === 'free' && (
                <button style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text2)', fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', padding: 14, borderRadius: 3, cursor: 'pointer' }}
                  onClick={() => setConfirm({ action: 'occupy', table: selectedTable })}>Walk-in Seated</button>
              )}
              {selectedTable.status === 'reserved' && (
                <>
                  <button style={{ flex: 2, background: '#4a9e6e', border: 'none', color: '#fff', fontFamily: "'Jost',sans-serif", fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', padding: 14, borderRadius: 3, cursor: 'pointer', fontWeight: 500 }}
                    onClick={() => executeTableAction('occupy', selectedTable.id, selectedTable.current_party || 2)}>Customer Arrived</button>
                  <button style={{ flex: 1, background: 'transparent', border: '1px solid #c94c4c', color: '#c94c4c', fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', padding: 14, borderRadius: 3, cursor: 'pointer' }}
                    onClick={() => handleNoShow(selectedTable)}>No Show</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: 'var(--text)', marginBottom: 8 }}>
              {confirm.action === 'exit' ? `Customer exited Table ${confirm.table.table_label}?` : `Walk-in at Table ${confirm.table.table_label}?`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 20 }}>
              {confirm.action === 'exit' ? 'Table will be cleared and the next matching customer in queue will be automatically notified.' : 'A new session will be started for this table.'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, background: '#4a9e6e', border: 'none', color: '#fff', fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', padding: 12, borderRadius: 3, cursor: 'pointer', fontWeight: 500 }}
                onClick={() => executeTableAction(confirm.action, confirm.table.id, confirm.table.current_party || confirm.table.seats)}>Confirm</button>
              <button style={{ flex: 1, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text3)', fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', padding: 12, borderRadius: 3, cursor: 'pointer' }}
                onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}