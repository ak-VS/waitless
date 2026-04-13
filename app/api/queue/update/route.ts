import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { queue_entry_id, status, assigned_table_id } = body;

    if (!queue_entry_id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const validStatuses = ['waiting', 'seated', 'skipped', 'left'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    let result;
    if (status === 'seated') {
      result = await query(
        `UPDATE queue_entries 
         SET status = $1, assigned_table_id = $2, seated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [status, assigned_table_id, queue_entry_id]
      );

      // Log session for ML training
      if (assigned_table_id) {
        const entry = result.rows[0];
        await query(
          `INSERT INTO table_sessions 
           (restaurant_id, table_id, party_size, day_of_week, hour_of_day)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            entry.restaurant_id,
            assigned_table_id,
            entry.party_size,
            new Date().getDay(),
            new Date().getHours()
          ]
        );
      }
    } else if (status === 'left') {
      result = await query(
        `UPDATE queue_entries 
         SET status = $1, left_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, queue_entry_id]
      );
    } else {
      result = await query(
        `UPDATE queue_entries 
         SET status = $1
         WHERE id = $2
         RETURNING *`,
        [status, queue_entry_id]
      );
    }

    return NextResponse.json({
      success: true,
      entry: result.rows[0]
    });

  } catch (error) {
    console.error('Queue update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}