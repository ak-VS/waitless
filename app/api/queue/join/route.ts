import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { predictWaitTime } from '@/lib/ml';
import { emitToRestaurant, emitToCustomer } from '@/lib/socket';

function generateToken(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurant_id, customer_name, party_size, zone_preference } = body;

    if (!restaurant_id || !customer_name || !party_size) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const queueCount = await query(
      `SELECT COUNT(*) FROM queue_entries 
       WHERE restaurant_id = $1 AND status = 'waiting'`,
      [restaurant_id]
    );
    const queue_length = parseInt(queueCount.rows[0].count);

    const tableStats = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'occupied') as occupied
       FROM restaurant_tables WHERE restaurant_id = $1`,
      [restaurant_id]
    );
    const tables_total = parseInt(tableStats.rows[0].total) || 28;
    const tables_occupied = parseInt(tableStats.rows[0].occupied) || 0;

    const avgParty = await query(
      `SELECT AVG(party_size) as avg_party 
       FROM queue_entries 
       WHERE restaurant_id = $1 AND status = 'waiting'`,
      [restaurant_id]
    );
    const avg_party_size_ahead = parseFloat(avgParty.rows[0].avg_party) || 2.5;

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

    // Check if a matching free table is immediately available
    const freeTable = await query(
      `SELECT * FROM restaurant_tables
       WHERE restaurant_id = $1
       AND status = 'free'
       AND seats >= $2
       AND (
         $3 = 'any'
         OR zone = $3
       )
       ORDER BY ABS(seats - $2) ASC
       LIMIT 1`,
      [restaurant_id, party_size, zone_preference || 'any']
    );

    if (freeTable.rows.length > 0 && queue_length === 0) {
      const table = freeTable.rows[0];

      // Notify customer immediately
      await query(
        `UPDATE queue_entries 
         SET notified_at = NOW(), assigned_table_id = $1
         WHERE id = $2`,
        [table.id, entry.id]
      );

      // Reserve table
      await query(
        `UPDATE restaurant_tables 
         SET status = 'reserved', current_queue_entry_id = $1
         WHERE id = $2`,
        [entry.id, table.id]
      );

      // Emit to customer — triggers Screen 2 immediately
      emitToCustomer(entry.id, 'status_updated', {
        type: 'table_ready',
        message: `Table ${table.table_label} is ready. Please head to the entrance now.`,
        table_label: table.table_label
      });

      // Emit to staff
      emitToRestaurant(restaurant_id, 'table_updated', {
        type: 'table_cleared',
        table_id: table.id,
        new_status: 'reserved',
        notified_customer: {
          id: entry.id,
          name: customer_name,
          token: entry.token
        }
      });

      emitToRestaurant(restaurant_id, 'queue_updated', {
        type: 'new_customer',
        entry: {
          id: entry.id,
          token: entry.token,
          customer_name: entry.customer_name,
          party_size: entry.party_size,
          zone_preference: entry.zone_preference,
          joined_at: entry.joined_at,
          priority: 'normal',
          estimated_wait: 0
        },
        queue_length: position
      });

      return NextResponse.json({
        success: true,
        token: entry.token,
        position: 1,
        estimated_wait: 0,
        confidence: 'high',
        ml_factors: {},
        queue_entry_id: entry.id,
        customer_name: entry.customer_name,
        party_size: entry.party_size,
        zone_preference: entry.zone_preference,
        joined_at: entry.joined_at,
        table_ready: true,
        table_label: table.table_label
      }, { status: 201 });
    }

    // No free table — normal queue flow
    emitToRestaurant(restaurant_id, 'queue_updated', {
      type: 'new_customer',
      entry: {
        id: entry.id,
        token: entry.token,
        customer_name: entry.customer_name,
        party_size: entry.party_size,
        zone_preference: entry.zone_preference,
        joined_at: entry.joined_at,
        priority: 'normal',
        estimated_wait: prediction.minutes
      },
      queue_length: position
    });

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
      joined_at: entry.joined_at,
      table_ready: false
    }, { status: 201 });

  } catch (error) {
    console.error('Queue join error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}