import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';

function generateToken(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function estimateWait(queueLength: number, avgDwell: number = 25): number {
  return Math.max(5, queueLength * Math.floor(avgDwell / 3));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurant_id, customer_name, party_size, zone_preference, lat, lng } = body;

    if (!restaurant_id || !customer_name || !party_size) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get current queue length
    const queueCount = await query(
      `SELECT COUNT(*) FROM queue_entries 
       WHERE restaurant_id = $1 AND status = 'waiting'`,
      [restaurant_id]
    );
    const queueLength = parseInt(queueCount.rows[0].count);
    const estimated_wait = estimateWait(queueLength);
    const token = generateToken();

    const result = await query(
      `INSERT INTO queue_entries 
       (restaurant_id, token, customer_name, party_size, zone_preference, estimated_wait)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, token, customer_name, party_size, zone_preference, estimated_wait, joined_at`,
      [restaurant_id, token, customer_name, party_size, zone_preference || 'any', estimated_wait]
    );

    const entry = result.rows[0];
    const position = queueLength + 1;

    return NextResponse.json({
      success: true,
      token: entry.token,
      position,
      estimated_wait,
      queue_entry_id: entry.id,
      customer_name: entry.customer_name,
      party_size: entry.party_size,
      zone_preference: entry.zone_preference,
      joined_at: entry.joined_at
    }, { status: 201 });

  } catch (error) {
    console.error('Queue join error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}