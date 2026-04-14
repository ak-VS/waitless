import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurant_id = searchParams.get('restaurant_id');

    if (!restaurant_id) {
      return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 });
    }

    const result = await query(
      `SELECT * FROM queue_entries
       WHERE restaurant_id = $1 AND status = 'waiting'
       ORDER BY joined_at ASC`,
      [restaurant_id]
    );

    const stats = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
        COUNT(*) FILTER (WHERE status = 'seated' AND seated_at > NOW() - INTERVAL '1 day') as seated_today
       FROM queue_entries WHERE restaurant_id = $1`,
      [restaurant_id]
    );

    // Check for no-shows — auto-skip if notified > 5 mins ago and still waiting
    const noShows = await query(
      `SELECT id, token, customer_name FROM queue_entries
       WHERE restaurant_id = $1 
       AND status = 'waiting'
       AND notified_at IS NOT NULL
       AND notified_at < NOW() - INTERVAL '5 minutes'`,
      [restaurant_id]
    );

    for (const entry of noShows.rows) {
      await query(
        `UPDATE queue_entries 
         SET status = 'skipped', no_show_at = NOW()
         WHERE id = $1`,
        [entry.id]
      );
      console.log(`Auto-skipped no-show: ${entry.customer_name} (${entry.token})`);
    }

    return NextResponse.json({
      success: true,
      queue: result.rows,
      stats: stats.rows[0],
      auto_skipped: noShows.rows.length
    });

  } catch (error) {
    console.error('Staff queue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { queue_entry_id, action, table_id, restaurant_id } = body;

    if (!queue_entry_id || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (action === 'seat') {
      await query(
        `UPDATE queue_entries 
         SET status = 'seated', assigned_table_id = $1, seated_at = NOW()
         WHERE id = $2`,
        [table_id, queue_entry_id]
      );
      if (table_id) {
        const entry = await query('SELECT * FROM queue_entries WHERE id = $1', [queue_entry_id]);
        if (entry.rows.length > 0) {
          await query(
            `INSERT INTO table_sessions 
             (restaurant_id, table_id, party_size, day_of_week, hour_of_day)
             VALUES ($1, $2, $3, $4, $5)`,
            [entry.rows[0].restaurant_id, table_id, entry.rows[0].party_size, new Date().getDay(), new Date().getHours()]
          );
          // Update table status
          await query(
            `UPDATE restaurant_tables SET status = 'occupied', current_queue_entry_id = $1 WHERE id = $2`,
            [queue_entry_id, table_id]
          );
        }
      }
      return NextResponse.json({ success: true });

    } else if (action === 'notify') {
      // Mark customer as notified — starts 5 min no-show timer
      await query(
        `UPDATE queue_entries SET notified_at = NOW() WHERE id = $1`,
        [queue_entry_id]
      );
      return NextResponse.json({ success: true, notified_at: new Date() });

    } else if (action === 'skip') {
      await query(
        `UPDATE queue_entries SET status = 'skipped' WHERE id = $1`,
        [queue_entry_id]
      );
      return NextResponse.json({ success: true });

    } else if (action === 'im_on_my_way') {
      // Customer tapped "I'm on my way" — extend by 3 more minutes
      await query(
        `UPDATE queue_entries 
         SET notified_at = NOW() - INTERVAL '2 minutes'
         WHERE id = $1`,
        [queue_entry_id]
      );
      return NextResponse.json({ success: true });

    } else if (action === 'remove') {
      await query(
        `UPDATE queue_entries SET status = 'left', left_at = NOW() WHERE id = $1`,
        [queue_entry_id]
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Staff queue update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}