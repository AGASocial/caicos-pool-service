import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  defaultRollingMonthWindowUtc,
  ensureRouteJobsForDateRange,
} from '@/lib/generate-route-jobs-cron';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

/**
 * GET /api/cron/generate-route-jobs
 * Secured with Authorization: Bearer <CRON_SECRET> (Vercel Cron sends this automatically when CRON_SECRET is set).
 *
 * Optional query: start=YYYY-MM-DD&end=YYYY-MM-DD (inclusive) for manual runs; defaults to today through +1 calendar month.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = request.nextUrl;
  const startParam = url.searchParams.get('start');
  const endParam = url.searchParams.get('end');

  let startDate: string;
  let endDate: string;
  if (startParam && endParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startParam) || !/^\d{4}-\d{2}-\d{2}$/.test(endParam)) {
      return NextResponse.json(
        { error: 'start and end must be YYYY-MM-DD' },
        { status: 400 }
      );
    }
    if (startParam > endParam) {
      return NextResponse.json({ error: 'start must be on or before end' }, { status: 400 });
    }
    startDate = startParam;
    endDate = endParam;
  } else if (startParam || endParam) {
    return NextResponse.json(
      { error: 'Provide both start and end, or neither (for default window)' },
      { status: 400 }
    );
  } else {
    const w = defaultRollingMonthWindowUtc();
    startDate = w.startDate;
    endDate = w.endDate;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as CaicosSupabaseClient;

  try {
    const result = await ensureRouteJobsForDateRange(client, startDate, endDate);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('GET /api/cron/generate-route-jobs error:', e);
    const message = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
