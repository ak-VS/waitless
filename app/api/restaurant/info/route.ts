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
      'SELECT id, name, address, city, phone FROM restaurants WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, restaurant: result.rows[0] });

  } catch (error) {
    console.error('Restaurant info error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}