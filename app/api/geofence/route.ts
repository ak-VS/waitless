import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { isWithinGeofence, getDistanceMeters } from '@/lib/geofence';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurant_id, lat, lng } = body;

    if (!restaurant_id || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'Missing restaurant_id, lat or lng' },
        { status: 400 }
      );
    }

    // Get restaurant coordinates
    const result = await query(
      'SELECT lat, lng, name FROM restaurants WHERE id = $1',
      [restaurant_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const restaurant = result.rows[0];

    // If restaurant has no coordinates set, allow access
    if (!restaurant.lat || !restaurant.lng) {
      return NextResponse.json({
        allowed: true,
        reason: 'no_coordinates',
        distance_meters: null
      });
    }

    const distance = Math.round(getDistanceMeters(
      lat, lng,
      restaurant.lat, restaurant.lng
    ));

    const allowed = isWithinGeofence(
      lat, lng,
      restaurant.lat, restaurant.lng,
      100 // 100 metre radius
    );

    return NextResponse.json({
      allowed,
      distance_meters: distance,
      radius_meters: 100,
      reason: allowed ? 'within_range' : 'too_far',
      restaurant_name: restaurant.name
    });

  } catch (error) {
    console.error('Geofence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}