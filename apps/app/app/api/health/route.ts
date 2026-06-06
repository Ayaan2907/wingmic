import { NextResponse } from 'next/server';

/** Liveness probe for Railway — no DB or auth. */
export function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
