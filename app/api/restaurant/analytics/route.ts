import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurant_id = searchParams.get('restaurant_id');

    if (!restaurant_id) {
      return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 });
    }

    // Today's stats
    const todayStats = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'seated') as seated_today,
        COUNT(*) FILTER (WHERE status = 'skipped') as skipped_today,
        COUNT(*) FILTER (WHERE status = 'left') as left_today,
        COUNT(*) FILTER (WHERE status = 'waiting') as currently_waiting,
        ROUND(AVG(estimated_wait)) as avg_estimated_wait
       FROM queue_entries
       WHERE restaurant_id = $1
       AND joined_at > NOW() - INTERVAL '24 hours'`,
      [restaurant_id]
    );

    // This week's stats
    const weekStats = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'seated') as seated_week,
        COUNT(*) as total_week
       FROM queue_entries
       WHERE restaurant_id = $1
       AND joined_at > NOW() - INTERVAL '7 days'`,
      [restaurant_id]
    );

    // Avg dwell time from sessions
    const dwellStats = await query(
      `SELECT
        ROUND(AVG(dwell_minutes)) as avg_dwell,
        ROUND(MIN(dwell_minutes)) as min_dwell,
        ROUND(MAX(dwell_minutes)) as max_dwell
       FROM table_sessions
       WHERE restaurant_id = $1
       AND cleared_at IS NOT NULL
       AND dwell_minutes > 0
       AND seated_at > NOW() - INTERVAL '7 days'`,
      [restaurant_id]
    );

    // Peak hours — last 7 days
    const peakHours = await query(
      `SELECT
        hour_of_day as hour,
        COUNT(*) as count
       FROM queue_entries
       WHERE restaurant_id = $1
       AND joined_at > NOW() - INTERVAL '7 days'
       GROUP BY hour_of_day
       ORDER BY hour_of_day`,
      [restaurant_id]
    );

    // Peak days
    const peakDays = await query(
      `SELECT
        EXTRACT(DOW FROM joined_at) as day,
        COUNT(*) as count
       FROM queue_entries
       WHERE restaurant_id = $1
       AND joined_at > NOW() - INTERVAL '30 days'
       GROUP BY day
       ORDER BY day`,
      [restaurant_id]
    );

    // Table utilization
    const tableUtil = await query(
      `SELECT
        rt.table_label,
        rt.zone,
        rt.seats,
        COUNT(ts.id) as session_count,
        ROUND(AVG(ts.dwell_minutes)) as avg_dwell
       FROM restaurant_tables rt
       LEFT JOIN table_sessions ts ON ts.table_id = rt.id
         AND ts.cleared_at IS NOT NULL
         AND ts.seated_at > NOW() - INTERVAL '7 days'
       WHERE rt.restaurant_id = $1
       GROUP BY rt.id, rt.table_label, rt.zone, rt.seats
       ORDER BY session_count DESC
       LIMIT 10`,
      [restaurant_id]
    );

    // No show rate
    const noShowStats = await query(
      `SELECT
        COUNT(*) FILTER (WHERE no_show_at IS NOT NULL) as no_shows,
        COUNT(*) as total_notified
       FROM queue_entries
       WHERE restaurant_id = $1
       AND notified_at IS NOT NULL
       AND joined_at > NOW() - INTERVAL '7 days'`,
      [restaurant_id]
    );

    // Last 7 days daily trend
    const dailyTrend = await query(
      `SELECT
        DATE(joined_at AT TIME ZONE 'Asia/Kolkata') as date,
        COUNT(*) FILTER (WHERE status = 'seated') as seated,
        COUNT(*) as total
       FROM queue_entries
       WHERE restaurant_id = $1
       AND joined_at > NOW() - INTERVAL '7 days'
       GROUP BY date
       ORDER BY date`,
      [restaurant_id]
    );

    return NextResponse.json({
      success: true,
      today: todayStats.rows[0],
      week: weekStats.rows[0],
      dwell: dwellStats.rows[0],
      peak_hours: peakHours.rows,
      peak_days: peakDays.rows,
      table_utilization: tableUtil.rows,
      no_show: noShowStats.rows[0],
      daily_trend: dailyTrend.rows,
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}