import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { emitToCustomer, emitToRestaurant } from '@/lib/socket';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurant_id = searchParams.get('restaurant_id');
    if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 });

    // Auto-skip no-shows (notified > 5 mins ago)
    const noShows = await query(
      `UPDATE queue_entries 
       SET status = 'skipped', no_show_at = NOW()
       WHERE restaurant_id = $1 
       AND status = 'waiting'
       AND notified_at IS NOT NULL
       AND notified_at < NOW() - INTERVAL '5 minutes'
       RETURNING id`,
      [restaurant_id]
    );

    // Notify auto-skipped customers
    for (const row of noShows.rows) {
      emitToCustomer(row.id, 'status_updated', {
        type: 'skipped',
        message: 'You were skipped due to no response. You can rejoin the queue if you are still at the restaurant.'
      });
    }

    // Get queue — priority first, then by join time
    const result = await query(
      `SELECT * FROM queue_entries
       WHERE restaurant_id = $1 AND status = 'waiting'
       ORDER BY 
         CASE WHEN priority = 'vip' THEN 0 ELSE 1 END,
         joined_at ASC`,
      [restaurant_id]
    );

    const stats = await query(
  `SELECT 
    COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
    COUNT(*) FILTER (WHERE status = 'seated' AND DATE(joined_at) = CURRENT_DATE) as seated_today
   FROM queue_entries WHERE restaurant_id = $1`,
  [restaurant_id]
);

    return NextResponse.json({
      success: true,
      queue: result.rows,
      stats: stats.rows[0]
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
    if (!queue_entry_id || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    if (action === 'seat') {
      await query(
        `UPDATE queue_entries SET status = 'seated', assigned_table_id = $1, seated_at = NOW() WHERE id = $2`,
        [table_id, queue_entry_id]
      );
      if (table_id) {
        const entry = await query('SELECT * FROM queue_entries WHERE id = $1', [queue_entry_id]);
        if (entry.rows.length > 0) {
          await query(
            `INSERT INTO table_sessions (restaurant_id, table_id, party_size, day_of_week, hour_of_day) VALUES ($1,$2,$3,$4,$5)`,
            [entry.rows[0].restaurant_id, table_id, entry.rows[0].party_size, new Date().getDay(), new Date().getHours()]
          );
          await query(
            `UPDATE restaurant_tables SET status = 'occupied', current_queue_entry_id = $1 WHERE id = $2`,
            [queue_entry_id, table_id]
          );
        }
      }
      return NextResponse.json({ success: true });

    } else if (action === 'prioritize') {
      const current = await query('SELECT priority FROM queue_entries WHERE id = $1', [queue_entry_id]);
      const newPriority = current.rows[0]?.priority === 'vip' ? 'normal' : 'vip';
      await query(`UPDATE queue_entries SET priority = $1 WHERE id = $2`, [newPriority, queue_entry_id]);

      // Emit queue reorder to staff
      emitToRestaurant(restaurant_id, 'queue_updated', {
        type: 'priority_changed',
        queue_entry_id,
        priority: newPriority
      });

      return NextResponse.json({ success: true, priority: newPriority });

    } else if (action === 'notify') {
      await query(`UPDATE queue_entries SET notified_at = NOW() WHERE id = $1`, [queue_entry_id]);
      return NextResponse.json({ success: true });

    } else if (action === 'skip') {
      await query(`UPDATE queue_entries SET status = 'skipped' WHERE id = $1`, [queue_entry_id]);

      // Notify customer they were skipped
      emitToCustomer(queue_entry_id, 'status_updated', {
        type: 'skipped',
        message: 'You were skipped. You can rejoin the queue if you are still at the restaurant.'
      });

      // Update staff queue
      emitToRestaurant(restaurant_id, 'queue_updated', {
        type: 'customer_skipped',
        queue_entry_id
      });

      return NextResponse.json({ success: true });

    } else if (action === 'im_on_my_way') {
      await query(
        `UPDATE queue_entries SET notified_at = NOW() - INTERVAL '2 minutes' WHERE id = $1`,
        [queue_entry_id]
      );
      return NextResponse.json({ success: true });

    } else if (action === 'remove') {
      await query(
        `UPDATE queue_entries SET status = 'left', left_at = NOW() WHERE id = $1`,
        [queue_entry_id]
      );

      emitToCustomer(queue_entry_id, 'status_updated', {
        type: 'removed',
        message: 'You have been removed from the queue.'
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Staff queue update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}