import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurant_id = searchParams.get('restaurant_id');

    if (!restaurant_id) {
      return NextResponse.json(
        { error: 'restaurant_id required' },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT * FROM restaurant_tables 
       WHERE restaurant_id = $1 
       ORDER BY zone, table_label`,
      [restaurant_id]
    );

    return NextResponse.json({
      success: true,
      tables: result.rows
    });

  } catch (error) {
    console.error('Tables fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurant_id, tables } = body;

    if (!restaurant_id || !tables || !Array.isArray(tables)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Delete existing tables and re-insert (floor map save)
    await query(
      'DELETE FROM restaurant_tables WHERE restaurant_id = $1',
      [restaurant_id]
    );

    const inserted = [];
    for (const table of tables) {
      const result = await query(
        `INSERT INTO restaurant_tables 
         (restaurant_id, table_label, seats, zone, x_pos, y_pos, width, height, is_popular)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          restaurant_id,
          table.table_label,
          table.seats,
          table.zone,
          table.x_pos,
          table.y_pos,
          table.width,
          table.height,
          table.is_popular || false
        ]
      );
      inserted.push(result.rows[0]);
    }

    return NextResponse.json({
      success: true,
      tables: inserted
    });

  } catch (error) {
    console.error('Tables save error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}