import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { predictWaitTime } from '@/lib/ml';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queue_entry_id = searchParams.get('id');
    const restaurant_id = searchParams.get('restaurant_id');

    if (!queue_entry_id || !restaurant_id) {
      return NextResponse.json({ error: 'Missing id or restaurant_id' }, { status: 400 });
    }

    const entryResult = await query(
      `SELECT * FROM queue_entries WHERE id = $1 AND restaurant_id = $2`,
      [queue_entry_id, restaurant_id]
    );

    if (entryResult.rows.length === 0) {
      return NextResponse.json({ error: 'Queue entry not found' }, { status: 404 });
    }

    const entry = entryResult.rows[0];

    // Position
    const posResult = await query(
      `SELECT COUNT(*) FROM queue_entries 
       WHERE restaurant_id = $1 
       AND status = 'waiting' 
       AND joined_at < $2`,
      [restaurant_id, entry.joined_at]
    );
    const position = parseInt(posResult.rows[0].count) + 1;

    // Total waiting
    const totalResult = await query(
      `SELECT COUNT(*) FROM queue_entries 
       WHERE restaurant_id = $1 AND status = 'waiting'`,
      [restaurant_id]
    );
    const total_waiting = parseInt(totalResult.rows[0].count);

    // Table stats for ML
    const tableStats = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'occupied') as occupied
       FROM restaurant_tables WHERE restaurant_id = $1`,
      [restaurant_id]
    );
    const tables_total = parseInt(tableStats.rows[0].total) || 28;
    const tables_occupied = parseInt(tableStats.rows[0].occupied) || 0;

    // Live ML prediction based on current position
    const prediction = await predictWaitTime({
      party_size: entry.party_size,
      tables_occupied,
      tables_total,
      queue_length: position - 1,
      avg_party_size_ahead: 2.5
    });
// Send 15 min warning notification if wait is between 14-16 mins
if (prediction.minutes >= 14 && prediction.minutes <= 16) {
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queue_entry_id: entry.id,
      title: 'Almost your turn!',
      message: `About 15 minutes remaining. Start making your way to ${entry.restaurant_name || 'the restaurant'}.`,
      type: 'fifteen_min_warning'
    })
  }).catch(() => {});
}
    return NextResponse.json({
      success: true,
      position,
      total_waiting,
      estimated_wait: prediction.minutes,
      confidence: prediction.confidence,
      ml_factors: prediction.factors,
      status: entry.status,
      token: entry.token,
      customer_name: entry.customer_name,
      party_size: entry.party_size,
      zone_preference: entry.zone_preference,
      assigned_table_id: entry.assigned_table_id,
      notified_at: entry.notified_at,
      joined_at: entry.joined_at
    });

    
  } catch (error) {
    console.error('Queue status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  
}