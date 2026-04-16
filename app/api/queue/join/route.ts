import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { predictWaitTime } from '@/lib/ml';

function generateToken(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurant_id, customer_name, party_size, zone_preference } = body;

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
    const queue_length = parseInt(queueCount.rows[0].count);

    // Get table stats for ML
    const tableStats = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'occupied') as occupied
       FROM restaurant_tables 
       WHERE restaurant_id = $1`,
      [restaurant_id]
    );
    const tables_total = parseInt(tableStats.rows[0].total) || 28;
    const tables_occupied = parseInt(tableStats.rows[0].occupied) || 0;

    // Get avg party size of people ahead
    const avgParty = await query(
      `SELECT AVG(party_size) as avg_party 
       FROM queue_entries 
       WHERE restaurant_id = $1 AND status = 'waiting'`,
      [restaurant_id]
    );
    const avg_party_size_ahead = parseFloat(avgParty.rows[0].avg_party) || 2.5;

    // ML prediction
    const prediction = await predictWaitTime({
      party_size,
      tables_occupied,
      tables_total,
      queue_length,
      avg_party_size_ahead
    });

    const token = generateToken();

    const result = await query(
      `INSERT INTO queue_entries 
       (restaurant_id, token, customer_name, party_size, zone_preference, estimated_wait)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, token, customer_name, party_size, zone_preference, estimated_wait, joined_at`,
      [restaurant_id, token, customer_name, party_size, zone_preference || 'any', prediction.minutes]
    );

    const entry = result.rows[0];
    const position = queue_length + 1;

    return NextResponse.json({
      success: true,
      token: entry.token,
      position,
      estimated_wait: prediction.minutes,
      confidence: prediction.confidence,
      ml_factors: prediction.factors,
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