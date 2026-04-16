import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { emitToRestaurant, emitToCustomer } from '@/lib/socket';

export async function POST(req: NextRequest) {
  try {
    const { restaurant_id } = await req.json();
    if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 });

    // 1. Get all waiting customers
    const waitingCustomers = await query(
      `SELECT id, customer_name, token FROM queue_entries
       WHERE restaurant_id = $1 AND status = 'waiting'`,
      [restaurant_id]
    );

    // 2. Skip all waiting customers and notify them
    await query(
      `UPDATE queue_entries 
       SET status = 'skipped', no_show_at = NOW()
       WHERE restaurant_id = $1 AND status = 'waiting'`,
      [restaurant_id]
    );

    for (const customer of waitingCustomers.rows) {
      emitToCustomer(customer.id, 'status_updated', {
        type: 'skipped',
        message: 'The restaurant is closing for the night. Thank you for your patience.'
      });
    }

    // 3. Clear all reserved tables
    await query(
      `UPDATE restaurant_tables 
       SET status = 'free', current_queue_entry_id = NULL
       WHERE restaurant_id = $1 AND status = 'reserved'`,
      [restaurant_id]
    );

    // 4. Close all open table sessions
    await query(
      `UPDATE table_sessions
       SET cleared_at = NOW(),
           dwell_minutes = EXTRACT(EPOCH FROM (NOW() - seated_at))/60
       WHERE restaurant_id = $1 AND cleared_at IS NULL`,
      [restaurant_id]
    );

    // 5. Mark all tables as free
    await query(
      `UPDATE restaurant_tables 
       SET status = 'free', current_queue_entry_id = NULL
       WHERE restaurant_id = $1`,
      [restaurant_id]
    );

    // 6. Notify staff dashboard
    emitToRestaurant(restaurant_id, 'restaurant_closed', {
      message: 'Restaurant closed for the night. All tables cleared.'
    });

    return NextResponse.json({
      success: true,
      customers_notified: waitingCustomers.rows.length,
      message: 'Restaurant closed. All queues cleared and tables freed.'
    });

  } catch (error) {
    console.error('Close night error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}