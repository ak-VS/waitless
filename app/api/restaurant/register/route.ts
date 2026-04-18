import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { hashPassword, generateToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, address, city, phone, email, password,
      subscription, timezone, opening_time, closing_time, lat, lng
    } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await query(
      'SELECT id FROM restaurants WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Restaurant already registered with this email' },
        { status: 409 }
      );
    }

    const password_hash = await hashPassword(password);

    const result = await query(
      `INSERT INTO restaurants 
       (name, address, city, phone, email, password_hash, subscription, timezone, opening_time, closing_time, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, name, email, city, subscription, timezone, opening_time, closing_time`,
      [
        name,
        address || '',
        city || '',
        phone || '',
        email,
        password_hash,
        subscription || 'base',
        timezone || 'Asia/Kolkata',
        opening_time || '11:00',
        closing_time || '23:00',
        lat || null,
        lng || null
      ]
    );

    const restaurant = result.rows[0];

    const token = generateToken({
      id: restaurant.id,
      email: restaurant.email,
      role: 'restaurant'
    });

    return NextResponse.json({
      success: true,
      token,
      restaurant
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}