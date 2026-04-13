import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    success: true, 
    message: 'Socket.io is handled by custom server' 
  });
}