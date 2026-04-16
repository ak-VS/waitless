import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { queue_entry_id, title, message, type } = body;

    if (!queue_entry_id) {
      return NextResponse.json({ error: 'Missing queue_entry_id' }, { status: 400 });
    }

    // Get subscription for this queue entry
    const subResult = await query(
      'SELECT * FROM push_subscriptions WHERE queue_entry_id = $1',
      [queue_entry_id]
    );

    if (subResult.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No push subscription found' 
      });
    }

    const sub = subResult.rows[0];
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };

    const payload = JSON.stringify({
      title: title || 'Waitless',
      body: message || 'Your table update',
      type: type || 'update',
      icon: '/icon.png',
      badge: '/badge.png',
    });

    await webpush.sendNotification(pushSubscription, payload);

    return NextResponse.json({ success: true, sent: true });

  } catch (error: any) {
    console.error('Push send error:', error);
    // If subscription expired, clean it up
    if (error.statusCode === 410) {
      const body = await req.json().catch(() => ({}));
      if (body.queue_entry_id) {
        await query(
          'DELETE FROM push_subscriptions WHERE queue_entry_id = $1',
          [body.queue_entry_id]
        );
      }
    }
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}