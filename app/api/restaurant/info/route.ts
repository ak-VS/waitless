import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const result = await query(
      `SELECT id, name, address, city, phone, timezone, 
              opening_time, closing_time 
       FROM restaurants WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const seatedToday = await query(
      `SELECT COUNT(*) FROM queue_entries 
       WHERE restaurant_id = $1 
       AND status = 'seated'
       AND DATE(joined_at) = CURRENT_DATE`,
      [id]
    );

    return NextResponse.json({
      success: true,
      restaurant: {
        ...result.rows[0],
        seated_today: parseInt(seatedToday.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Restaurant info error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}