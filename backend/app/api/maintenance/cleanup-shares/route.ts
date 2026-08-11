import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredShares } from '@/lib/shareStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const deletedShares = await cleanupExpiredShares();
    return NextResponse.json({ ok: true, deletedShares });
  } catch (error) {
    console.error('Expired share cleanup failed:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
