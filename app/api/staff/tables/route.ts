import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { emitToRestaurant, emitToCustomer } from '@/lib/socket';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurant_id = searchParams.get('restaurant_id');

    if (!restaurant_id) {
      return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 });
    }

    const result = await query(
      `SELECT rt.*, 
        ts.party_size as current_party,
        ts.seated_at,
        EXTRACT(EPOCH FROM (NOW() - ts.seated_at))/60 as minutes_seated,
        ts.id as session_id
       FROM restaurant_tables rt
       LEFT JOIN table_sessions ts ON ts.table_id = rt.id 
         AND ts.cleared_at IS NULL
       WHERE rt.restaurant_id = $1
       ORDER BY rt.zone, rt.table_label`,
      [restaurant_id]
    );

    return NextResponse.json({ success: true, tables: result.rows });

  } catch (error) {
    console.error('Staff tables error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { table_id, action, restaurant_id, party_size } = body;

    if (!table_id || !action || !restaurant_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (action === 'exit') {
      // 1. Close the session
      await query(
        `UPDATE table_sessions 
         SET cleared_at = NOW(),
             dwell_minutes = EXTRACT(EPOCH FROM (NOW() - seated_at))/60
         WHERE table_id = $1 AND cleared_at IS NULL`,
        [table_id]
      );

      // 2. Mark table as free
      await query(
        `UPDATE restaurant_tables 
         SET status = 'free', current_queue_entry_id = NULL 
         WHERE id = $1`,
        [table_id]
      );

      // 3. Get table details
      const tableResult = await query(
        'SELECT * FROM restaurant_tables WHERE id = $1',
        [table_id]
      );
      const table = tableResult.rows[0];

      // 4. Find next waiting customer — priority first, then zone match
      const nextCustomer = await query(
        `SELECT * FROM queue_entries
         WHERE restaurant_id = $1 
         AND status = 'waiting'
         AND party_size <= $2
         AND (zone_preference = 'any' OR zone_preference = $3)
         ORDER BY 
           CASE WHEN priority = 'vip' THEN 0 ELSE 1 END,
           joined_at ASC
         LIMIT 1`,
        [restaurant_id, table.seats, table.zone]
      );

      // 5. If no zone match, find any fitting customer
      let customer = nextCustomer.rows[0];
      if (!customer) {
        const anyCustomer = await query(
          `SELECT * FROM queue_entries
           WHERE restaurant_id = $1 
           AND status = 'waiting'
           AND party_size <= $2
           ORDER BY 
             CASE WHEN priority = 'vip' THEN 0 ELSE 1 END,
             joined_at ASC
           LIMIT 1`,
          [restaurant_id, table.seats]
        );
        customer = anyCustomer.rows[0];
      }

      if (customer) {
        // 6. Notify customer — starts 5 min no-show timer
        await query(
          `UPDATE queue_entries 
           SET notified_at = NOW(), assigned_table_id = $1
           WHERE id = $2`,
          [table_id, customer.id]
        );

        // 7. Reserve table for this customer
        await query(
          `UPDATE restaurant_tables 
           SET status = 'reserved', current_queue_entry_id = $1
           WHERE id = $2`,
          [customer.id, table_id]
        );

        // 8. Send push notification
        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              queue_entry_id: customer.id,
              title: 'Your table is ready!',
              message: `Table ${table.table_label} is ready. Please head to the entrance now.`,
              type: 'table_ready'
            })
          });
        } catch (e) {
          console.error('Push notification failed:', e);
        }
// Emit real-time update to staff
emitToRestaurant(restaurant_id, 'table_updated', {
  type: 'table_cleared',
  table_id,
  new_status: customer ? 'reserved' : 'free',
  notified_customer: customer ? {
    id: customer.id,
    name: customer.customer_name,
    token: customer.token
  } : null
});

// Emit real-time update to notified customer
if (customer) {
  emitToCustomer(customer.id, 'status_updated', {
    type: 'table_ready',
    message: `Table ${table.table_label} is ready. Please head to the entrance now.`,
    table_label: table.table_label
  });
}
        return NextResponse.json({
          success: true,
          table_status: 'reserved',
          notified_customer: {
            id: customer.id,
            name: customer.customer_name,
            token: customer.token,
            party_size: customer.party_size,
          }
        });
      }

      return NextResponse.json({
        success: true,
        table_status: 'free',
        notified_customer: null
      });

    } else if (action === 'delay') {
      await query(
        `UPDATE restaurant_tables SET status = 'cleaning' WHERE id = $1`,
        [table_id]
      );
      return NextResponse.json({ success: true, table_status: 'cleaning' });

    } else if (action === 'ready') {
      await query(
        `UPDATE restaurant_tables SET status = 'free' WHERE id = $1`,
        [table_id]
      );

      // Auto assign next customer after cleaning
      const tableResult = await query(
        'SELECT * FROM restaurant_tables WHERE id = $1',
        [table_id]
      );
      const table = tableResult.rows[0];

      const nextCustomer = await query(
        `SELECT * FROM queue_entries
         WHERE restaurant_id = $1 
         AND status = 'waiting'
         AND party_size <= $2
         ORDER BY 
           CASE WHEN priority = 'vip' THEN 0 ELSE 1 END,
           joined_at ASC
         LIMIT 1`,
        [restaurant_id, table.seats]
      );

      const customer = nextCustomer.rows[0];
      if (customer) {
        await query(
          `UPDATE queue_entries 
           SET notified_at = NOW(), assigned_table_id = $1
           WHERE id = $2`,
          [table_id, customer.id]
        );
        await query(
          `UPDATE restaurant_tables 
           SET status = 'reserved', current_queue_entry_id = $1
           WHERE id = $2`,
          [customer.id, table_id]
        );
        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              queue_entry_id: customer.id,
              title: 'Your table is ready!',
              message: `Table ${table.table_label} is ready. Please head to the entrance now.`,
              type: 'table_ready'
            })
          });
        } catch (e) {
          console.error('Push notification failed:', e);
        }
        return NextResponse.json({
          success: true,
          table_status: 'reserved',
          notified_customer: {
            id: customer.id,
            name: customer.customer_name,
            token: customer.token,
            party_size: customer.party_size,
          }
        });
      }

      return NextResponse.json({ success: true, table_status: 'free' });

    } else if (action === 'occupy') {
  await query(
    `INSERT INTO table_sessions 
     (restaurant_id, table_id, party_size, day_of_week, hour_of_day)
     VALUES ($1, $2, $3, $4, $5)`,
    [restaurant_id, table_id, party_size || 2, new Date().getDay(), new Date().getHours()]
  );
  await query(
    `UPDATE restaurant_tables SET status = 'occupied' WHERE id = $1`,
    [table_id]
  );

  // Find the queue entry assigned to this table and mark as seated
  const queueEntry = await query(
    `UPDATE queue_entries 
     SET status = 'seated', seated_at = NOW()
     WHERE assigned_table_id = $1 
     AND status = 'waiting'
     AND notified_at IS NOT NULL
     RETURNING id, customer_name`,
    [table_id]
  );

  // Notify customer they are now seated — triggers Screen 3
  if (queueEntry.rows.length > 0) {
    const entry = queueEntry.rows[0];
    emitToCustomer(entry.id, 'status_updated', {
      type: 'seated',
      message: 'You are now seated. Enjoy your meal!'
    });
  }

  emitToRestaurant(restaurant_id, 'table_updated', {
    type: 'table_occupied',
    table_id,
    new_status: 'occupied'
  });

  return NextResponse.json({ success: true, table_status: 'occupied' });
}
      return NextResponse.json({ success: true, table_status: 'occupied' });
    }



   catch (error) {
    console.error('Staff table update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}