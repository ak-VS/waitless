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
    const { table_id, action, restaurant_id, party_size, queue_entry_id } = body;

    if (!table_id || !action || !restaurant_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (action === 'exit') {
      await query(
        `UPDATE table_sessions 
         SET cleared_at = NOW(),
             dwell_minutes = EXTRACT(EPOCH FROM (NOW() - seated_at))/60
         WHERE table_id = $1 AND cleared_at IS NULL`,
        [table_id]
      );
      await query(
        `UPDATE restaurant_tables 
         SET status = 'free', current_queue_entry_id = NULL 
         WHERE id = $1`,
        [table_id]
      );

      const tableResult = await query('SELECT * FROM restaurant_tables WHERE id = $1', [table_id]);
      const table = tableResult.rows[0];

      const nextCustomer = await query(
        `SELECT * FROM queue_entries
         WHERE restaurant_id = $1 
         AND status = 'waiting'
         AND party_size <= $2
         AND (zone_preference = 'any' OR zone_preference = $3)
         ORDER BY CASE WHEN priority = 'vip' THEN 0 ELSE 1 END, joined_at ASC
         LIMIT 1`,
        [restaurant_id, table.seats, table.zone]
      );

      let customer = nextCustomer.rows[0];
      if (!customer) {
        const anyCustomer = await query(
          `SELECT * FROM queue_entries
           WHERE restaurant_id = $1 
           AND status = 'waiting'
           AND party_size <= $2
           ORDER BY CASE WHEN priority = 'vip' THEN 0 ELSE 1 END, joined_at ASC
           LIMIT 1`,
          [restaurant_id, table.seats]
        );
        customer = anyCustomer.rows[0];
      }

      if (customer) {
        await query(
          `UPDATE queue_entries SET notified_at = NOW(), assigned_table_id = $1 WHERE id = $2`,
          [table_id, customer.id]
        );
        await query(
          `UPDATE restaurant_tables SET status = 'reserved', current_queue_entry_id = $1 WHERE id = $2`,
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
        } catch (e) { console.error('Push notification failed:', e); }

        emitToRestaurant(restaurant_id, 'table_updated', {
          type: 'table_cleared', table_id, new_status: 'reserved',
          notified_customer: { id: customer.id, name: customer.customer_name, token: customer.token }
        });
        emitToCustomer(customer.id, 'status_updated', {
          type: 'table_ready',
          message: `Table ${table.table_label} is ready. Please head to the entrance now.`,
          table_label: table.table_label
        });

        return NextResponse.json({
          success: true, table_status: 'reserved',
          notified_customer: { id: customer.id, name: customer.customer_name, token: customer.token, party_size: customer.party_size }
        });
      }

      emitToRestaurant(restaurant_id, 'table_updated', { type: 'table_cleared', table_id, new_status: 'free', notified_customer: null });
      return NextResponse.json({ success: true, table_status: 'free', notified_customer: null });

    } else if (action === 'delay') {
      await query(`UPDATE restaurant_tables SET status = 'cleaning' WHERE id = $1`, [table_id]);
      emitToRestaurant(restaurant_id, 'table_updated', { type: 'table_cleaning', table_id, new_status: 'cleaning' });
      return NextResponse.json({ success: true, table_status: 'cleaning' });

    } else if (action === 'ready') {
      await query(`UPDATE restaurant_tables SET status = 'free' WHERE id = $1`, [table_id]);

      const tableResult = await query('SELECT * FROM restaurant_tables WHERE id = $1', [table_id]);
      const table = tableResult.rows[0];

      const nextCustomer = await query(
        `SELECT * FROM queue_entries
         WHERE restaurant_id = $1 AND status = 'waiting' AND party_size <= $2
         ORDER BY CASE WHEN priority = 'vip' THEN 0 ELSE 1 END, joined_at ASC LIMIT 1`,
        [restaurant_id, table.seats]
      );

      const customer = nextCustomer.rows[0];
      if (customer) {
        await query(`UPDATE queue_entries SET notified_at = NOW(), assigned_table_id = $1 WHERE id = $2`, [table_id, customer.id]);
        await query(`UPDATE restaurant_tables SET status = 'reserved', current_queue_entry_id = $1 WHERE id = $2`, [customer.id, table_id]);
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
        } catch (e) { console.error('Push notification failed:', e); }

        emitToRestaurant(restaurant_id, 'table_updated', {
          type: 'table_ready', table_id, new_status: 'reserved',
          notified_customer: { id: customer.id, name: customer.customer_name, token: customer.token }
        });
        emitToCustomer(customer.id, 'status_updated', {
          type: 'table_ready',
          message: `Table ${table.table_label} is ready. Please head to the entrance now.`,
          table_label: table.table_label
        });

        return NextResponse.json({
          success: true, table_status: 'reserved',
          notified_customer: { id: customer.id, name: customer.customer_name, token: customer.token, party_size: customer.party_size }
        });
      }

      emitToRestaurant(restaurant_id, 'table_updated', { type: 'table_ready', table_id, new_status: 'free' });
      return NextResponse.json({ success: true, table_status: 'free' });

    } else if (action === 'occupy') {
      await query(
        `INSERT INTO table_sessions (restaurant_id, table_id, party_size, day_of_week, hour_of_day)
         VALUES ($1, $2, $3, $4, $5)`,
        [restaurant_id, table_id, party_size || 2, new Date().getDay(), new Date().getHours()]
      );
      await query(`UPDATE restaurant_tables SET status = 'occupied' WHERE id = $1`, [table_id]);

      const queueEntry = await query(
        `UPDATE queue_entries 
         SET status = 'seated', seated_at = NOW(), notified_at = NULL
         WHERE assigned_table_id = $1 AND status = 'waiting' AND notified_at IS NOT NULL
         RETURNING id, customer_name`,
        [table_id]
      );

      if (queueEntry.rows.length > 0) {
        const entry = queueEntry.rows[0];
        emitToCustomer(entry.id, 'status_updated', { type: 'seated', message: 'You are now seated. Enjoy your meal!' });
      }

      emitToRestaurant(restaurant_id, 'table_updated', { type: 'table_occupied', table_id, new_status: 'occupied' });
      return NextResponse.json({ success: true, table_status: 'occupied' });

    } else if (action === 'seat_customer') {
      if (!queue_entry_id) {
        return NextResponse.json({ error: 'queue_entry_id required' }, { status: 400 });
      }

      // Reserve table for this specific customer
      await query(
        `UPDATE restaurant_tables SET status = 'reserved', current_queue_entry_id = $1 WHERE id = $2`,
        [queue_entry_id, table_id]
      );

      // Notify customer — starts no-show timer
      await query(
        `UPDATE queue_entries SET notified_at = NOW(), assigned_table_id = $1 WHERE id = $2`,
        [table_id, queue_entry_id]
      );

      // Get table and customer details
      const tableResult = await query('SELECT * FROM restaurant_tables WHERE id = $1', [table_id]);
      const table = tableResult.rows[0];
      const entryResult = await query('SELECT * FROM queue_entries WHERE id = $1', [queue_entry_id]);
      const customer = entryResult.rows[0];

      // Push notification
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queue_entry_id,
            title: 'Your table is ready!',
            message: `Table ${table.table_label} is ready. Please head to the entrance now.`,
            type: 'table_ready'
          })
        });
      } catch (e) { console.error('Push failed:', e); }

      // Emit to customer
      emitToCustomer(queue_entry_id, 'status_updated', {
        type: 'table_ready',
        message: `Table ${table.table_label} is ready. Please head to the entrance now.`,
        table_label: table.table_label
      });

      // Emit to staff
      emitToRestaurant(restaurant_id, 'table_updated', {
        type: 'table_reserved', table_id, new_status: 'reserved',
        notified_customer: { id: queue_entry_id, name: customer?.customer_name, token: customer?.token }
      });

      return NextResponse.json({
        success: true, table_status: 'reserved',
        notified_customer: { id: queue_entry_id, name: customer?.customer_name, token: customer?.token }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Staff table update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}