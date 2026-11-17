import { NextRequest, NextResponse } from 'next/server';
import { getBillingService } from '@/lib/billing/server';

/**
 * GET /api/cron/process-grace-expirations
 * Secured with Authorization: Bearer <CRON_SECRET>.
 *
 * For past_due subscriptions past grace_period_ends_at: cancel in Stripe,
 * mark canceled in DB, set company tier to free (idempotent).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const billingService = await getBillingService();
    const result = await billingService.processExpiredGracePeriods();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('process-grace-expirations failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Grace expiry processing failed',
      },
      { status: 500 },
    );
  }
}
