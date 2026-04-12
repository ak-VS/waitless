import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { hashPassword, generateToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, address, city, phone, email, password } = body;

    // Validate
    if (!name || !address || !city || !phone || !email || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
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

    // Hash password
    const password_hash = await hashPassword(password);

    // Insert restaurant
    const result = await query(
      `INSERT INTO restaurants (name, address, city, phone, email, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, city`,
      [name, address, city, phone, email, password_hash]
    );

    const restaurant = result.rows[0];

    // Generate JWT
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}