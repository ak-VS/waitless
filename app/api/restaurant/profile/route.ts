import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = verifyToken(token);
    const result = await query(
      `SELECT id, name, address, city, phone, email, subscription, 
              timezone, opening_time, closing_time, lat, lng
       FROM restaurants WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, restaurant: result.rows[0] });

  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = verifyToken(token);
    const body = await req.json();
    const { name, address, city, phone, timezone, opening_time, closing_time, lat, lng } = body;

    const result = await query(
      `UPDATE restaurants 
       SET name = COALESCE($1, name),
           address = COALESCE($2, address),
           city = COALESCE($3, city),
           phone = COALESCE($4, phone),
           timezone = COALESCE($5, timezone),
           opening_time = COALESCE($6, opening_time),
           closing_time = COALESCE($7, closing_time),
           lat = COALESCE($8, lat),
           lng = COALESCE($9, lng)
       WHERE id = $10
       RETURNING id, name, address, city, phone, email, subscription,
                 timezone, opening_time, closing_time, lat, lng`,
      [name, address, city, phone, timezone, opening_time, closing_time, lat, lng, decoded.id]
    );

    // Update localStorage data for staff
    return NextResponse.json({ success: true, restaurant: result.rows[0] });

  } catch (error) {
    console.error('Profile PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}