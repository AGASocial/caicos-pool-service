import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processDueTechnicianDeactivations } from '@/lib/seat-management';

/**
 * GET /api/cron/process-scheduled-deactivations
 * Secured with Authorization: Bearer <CRON_SECRET>.
 *
 * Flips is_active=false for technicians whose scheduled_deactivation_at has passed.
 * Stripe quantity was already lowered at schedule time with proration_behavior=none.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const result = await processDueTechnicianDeactivations(supabase);

  return NextResponse.json({ ok: true, ...result });
}
