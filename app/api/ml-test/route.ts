import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const res = await fetch('http://127.0.0.1:8000/health');
    const data = await res.json();
    return NextResponse.json({ success: true, ml: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}