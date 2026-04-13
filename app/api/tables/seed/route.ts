import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';

export async function POST(req: NextRequest) {
  try {
    const { restaurant_id } = await req.json();

    await query(
      'DELETE FROM restaurant_tables WHERE restaurant_id = $1',
      [restaurant_id]
    );

    const tables = [
      { label:'W1', seats:2, zone:'window', x:14, y:16, w:22, h:22, pop:true },
      { label:'W2', seats:2, zone:'window', x:42, y:16, w:22, h:22, pop:false },
      { label:'W3', seats:4, zone:'window', x:80, y:13, w:28, h:28, pop:true },
      { label:'W4', seats:4, zone:'window', x:118, y:13, w:28, h:28, pop:false },
      { label:'W5', seats:2, zone:'window', x:164, y:16, w:22, h:22, pop:false },
      { label:'W6', seats:4, zone:'window', x:198, y:13, w:28, h:28, pop:false },
      { label:'W7', seats:6, zone:'window', x:234, y:11, w:34, h:34, pop:true },
      { label:'I1', seats:4, zone:'indoor', x:56, y:98, w:28, h:28, pop:false },
      { label:'I2', seats:4, zone:'indoor', x:96, y:98, w:28, h:28, pop:false },
      { label:'I3', seats:6, zone:'indoor', x:138, y:96, w:34, h:34, pop:true },
      { label:'I4', seats:4, zone:'indoor', x:184, y:98, w:28, h:28, pop:false },
      { label:'I5', seats:4, zone:'indoor', x:220, y:98, w:28, h:28, pop:false },
      { label:'I6', seats:8, zone:'indoor', x:50, y:144, w:42, h:42, pop:true },
      { label:'I7', seats:4, zone:'indoor', x:104, y:150, w:28, h:28, pop:false },
      { label:'I8', seats:10, zone:'indoor', x:142, y:143, w:50, h:46, pop:false },
      { label:'I9', seats:4, zone:'indoor', x:202, y:150, w:28, h:28, pop:false },
      { label:'P1', seats:6, zone:'private', x:52, y:212, w:36, h:36, pop:false },
      { label:'P2', seats:8, zone:'private', x:104, y:208, w:44, h:44, pop:false },
      { label:'P3', seats:10, zone:'private', x:160, y:207, w:54, h:46, pop:true },
      { label:'P4', seats:6, zone:'private', x:224, y:212, w:36, h:36, pop:false },
      { label:'O1', seats:2, zone:'outdoor', x:6, y:82, w:20, h:20, pop:false },
      { label:'O2', seats:4, zone:'outdoor', x:4, y:112, w:26, h:26, pop:false },
      { label:'O3', seats:2, zone:'outdoor', x:8, y:150, w:20, h:20, pop:true },
      { label:'O4', seats:4, zone:'outdoor', x:4, y:178, w:26, h:26, pop:false },
      { label:'OB1', seats:4, zone:'outdoor', x:14, y:280, w:28, h:28, pop:false },
      { label:'OB2', seats:4, zone:'outdoor', x:56, y:280, w:28, h:28, pop:false },
      { label:'OB3', seats:6, zone:'outdoor', x:98, y:278, w:36, h:36, pop:true },
      { label:'OB4', seats:6, zone:'outdoor', x:148, y:278, w:36, h:36, pop:false },
    ];

    for (const t of tables) {
      await query(
        `INSERT INTO restaurant_tables
         (restaurant_id, table_label, seats, zone, x_pos, y_pos, width, height, is_popular)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [restaurant_id, t.label, t.seats, t.zone, t.x, t.y, t.w, t.h, t.pop]
      );
    }

    return NextResponse.json({ success: true, count: tables.length });

  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}