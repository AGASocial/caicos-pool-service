import { NextRequest, NextResponse } from 'next/server';
import { processPendingCustomerReports } from '@/lib/customer-reports/process';

/**
 * GET /api/cron/process-customer-reports
 * Secured with Authorization: Bearer <CRON_SECRET>.
 *
 * Processes completed jobs that still need a customer report decision
 * (covers technician-app completions that update Supabase directly).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processPendingCustomerReports(50);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('process-customer-reports failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Customer report processing failed',
      },
      { status: 500 },
    );
  }
}
