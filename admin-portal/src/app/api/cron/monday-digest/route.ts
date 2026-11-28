import { NextRequest, NextResponse } from 'next/server';
import { runMondayDigest } from '@/lib/monday-digest';

/**
 * GET /api/cron/monday-digest
 * Secured with Authorization: Bearer <CRON_SECRET>. Scheduled in vercel.json (Mondays 12:00 UTC).
 *
 * KAN-154: emails each company's office users a digest of open issues grouped by technician.
 * Does nothing unless MONDAY_DIGEST_ENABLED is 1 / true / yes; there is no other way to trigger
 * a send, and the response never includes recipient addresses.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runMondayDigest();
    return NextResponse.json(result);
  } catch (error) {
    console.error('monday-digest failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Monday digest failed' }, { status: 500 });
  }
}
