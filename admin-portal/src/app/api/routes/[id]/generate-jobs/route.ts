import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';
import { pickSegmentForDate, toScheduleRow } from '@/lib/route-stop-schedule';
import { loadSchedulesByStopId } from '@/lib/route-stop-schedules-db';
import { stopMatchesDate } from '@/lib/schedule';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: routeId } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const dateStr = body?.date;

    if (!dateStr || typeof dateStr !== 'string') {
      return NextResponse.json(
        { error: 'date is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(dateStr);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date' },
        { status: 400 }
      );
    }

    const dateOnly = dateStr.slice(0, 10);

    const { data: route, error: routeError } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_routes')
      .select('id, company_id, technician_id')
      .eq('id', routeId)
      .single();

    if (routeError || !route) {
      return NextResponse.json(
        { error: 'Route not found' },
        { status: 404 }
      );
    }

    const { data: stops, error: stopsError } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_route_stops')
      .select('id, property_id, stop_order')
      .eq('route_id', routeId)
      .order('stop_order', { ascending: true });

    if (stopsError || !stops?.length) {
      return NextResponse.json(
        { error: 'Route has no stops' },
        { status: 400 }
      );
    }

    const client = supabase as unknown as CaicosSupabaseClient;
    const stopRows = stops as Array<{ id: string; property_id: string; stop_order: number }>;
    const scheduleByStop = await loadSchedulesByStopId(
      client,
      stopRows.map((s) => s.id)
    );

    const matchingStops = stopRows.filter((s) => {
      const seg = pickSegmentForDate(scheduleByStop.get(s.id) ?? [], dateOnly);
      if (!seg) return false;
      return stopMatchesDate(toScheduleRow(seg), dateOnly);
    });

    if (matchingStops.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped_no_pattern_match: stops.length,
        date: dateOnly,
        jobs: [],
        message:
          'No stops match this date (check each stop weekday and weekly/monthly pattern).',
      });
    }

    const { data: existingRows, error: existingErr } = await client
      .from('caicos_service_jobs')
      .select('property_id')
      .eq('route_id', routeId)
      .eq('scheduled_date', dateOnly)
      .eq('job_source', 'route');

    if (existingErr) {
      console.error('Supabase error checking existing route jobs:', existingErr);
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    const already = new Set(
      (existingRows ?? []).map((r: { property_id: string }) => r.property_id)
    );
    const skippedAlready = matchingStops.filter((s) => already.has(s.property_id)).length;

    const jobs = matchingStops
      .filter((stop) => !already.has(stop.property_id))
      .map((stop) => ({
        company_id: route.company_id,
        property_id: stop.property_id,
        technician_id: route.technician_id,
        route_id: routeId,
        scheduled_date: dateOnly,
        status: 'pending',
        route_order: stop.stop_order,
        job_source: 'route',
        visit_kind_id: null,
      }));

    let inserted: unknown[] = [];
    if (jobs.length > 0) {
      const { data: ins, error: insertError } = await client
        .from('caicos_service_jobs')
        .insert(jobs)
        .select('id, property_id, scheduled_date, route_order');

      if (insertError) {
        console.error('Supabase error creating jobs:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      inserted = ins ?? [];
    }

    return NextResponse.json({
      created: inserted.length,
      skipped_already_scheduled: skippedAlready,
      skipped_no_pattern_match: stops.length - matchingStops.length,
      date: dateOnly,
      jobs: inserted,
    });
  } catch (e) {
    console.error('POST /api/routes/[id]/generate-jobs error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
