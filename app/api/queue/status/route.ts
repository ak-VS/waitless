import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queue_entry_id = searchParams.get('id');
    const restaurant_id = searchParams.get('restaurant_id');

    if (!queue_entry_id || !restaurant_id) {
      return NextResponse.json(
        { error: 'Missing id or restaurant_id' },
        { status: 400 }
      );
    }

    // Get this entry
    const entryResult = await query(
      `SELECT * FROM queue_entries WHERE id = $1 AND restaurant_id = $2`,
      [queue_entry_id, restaurant_id]
    );

    if (entryResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Queue entry not found' },
        { status: 404 }
      );
    }

    const entry = entryResult.rows[0];

    // Position — only count entries from SAME restaurant
    const posResult = await query(
      `SELECT COUNT(*) FROM queue_entries 
       WHERE restaurant_id = $1 
       AND status = 'waiting' 
       AND joined_at < $2`,
      [restaurant_id, entry.joined_at]
    );

    const position = parseInt(posResult.rows[0].count) + 1;

    // Total waiting — only for THIS restaurant
    const totalResult = await query(
      `SELECT COUNT(*) FROM queue_entries 
       WHERE restaurant_id = $1 
       AND status = 'waiting'`,
      [restaurant_id]
    );

    const total_waiting = parseInt(totalResult.rows[0].count);
    const estimated_wait = Math.max(2, (position - 1) * 8 + 5);

    return NextResponse.json({
      success: true,
      position,
      total_waiting,
      estimated_wait,
      status: entry.status,
      token: entry.token,
      customer_name: entry.customer_name,
      party_size: entry.party_size,
      zone_preference: entry.zone_preference,
      assigned_table_id: entry.assigned_table_id,
      joined_at: entry.joined_at
    });

  } catch (error) {
    console.error('Queue status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}