import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { queue_entry_id, restaurant_id, subscription } = body;

    if (!queue_entry_id || !restaurant_id || !subscription) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    // Upsert subscription
    await query(
      `INSERT INTO push_subscriptions 
       (queue_entry_id, restaurant_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [queue_entry_id, restaurant_id, endpoint, p256dh, auth]
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}