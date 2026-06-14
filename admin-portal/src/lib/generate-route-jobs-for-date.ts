import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { pickSegmentForDate, toScheduleRow } from '@/lib/route-stop-schedule';
import { loadSchedulesByStopId } from '@/lib/route-stop-schedules-db';
import { stopMatchesDate } from '@/lib/schedule';

export type GenerateRouteJobsResult = {
  created: number;
  skipped_already_scheduled: number;
  skipped_no_pattern_match: number;
  date: string;
  jobs: unknown[];
  message?: string;
};

/** Idempotent route job generation for a single date (US-B-009 shared lib). */
export async function generateRouteJobsForDate(
  client: CadenzaSupabaseClient,
  routeId: string,
  dateOnly: string,
): Promise<GenerateRouteJobsResult> {
  const { data: route, error: routeError } = await client
    .from('cadenza_routes')
    .select('id, company_id, technician_id')
    .eq('id', routeId)
    .single();

  if (routeError || !route) {
    throw new Error('Route not found');
  }

  const { data: stops, error: stopsError } = await client
    .from('cadenza_route_stops')
    .select('id, property_id, stop_order')
    .eq('route_id', routeId)
    .order('stop_order', { ascending: true });

  if (stopsError || !stops?.length) {
    throw new Error('Route has no stops');
  }

  const stopRows = stops as Array<{ id: string; property_id: string; stop_order: number }>;
  const scheduleByStop = await loadSchedulesByStopId(client, stopRows.map((s) => s.id));

  const matchingStops = stopRows.filter((s) => {
    const seg = pickSegmentForDate(scheduleByStop.get(s.id) ?? [], dateOnly);
    if (!seg) return false;
    return stopMatchesDate(toScheduleRow(seg), dateOnly);
  });

  if (matchingStops.length === 0) {
    return {
      created: 0,
      skipped_no_pattern_match: stops.length,
      skipped_already_scheduled: 0,
      date: dateOnly,
      jobs: [],
      message: 'No stops match this date (check each stop weekday and weekly/monthly pattern).',
    };
  }

  const { data: existingRows, error: existingErr } = await client
    .from('cadenza_service_jobs')
    .select('property_id')
    .eq('route_id', routeId)
    .eq('scheduled_date', dateOnly)
    .eq('job_source', 'route');

  if (existingErr) throw new Error(existingErr.message);

  const already = new Set((existingRows ?? []).map((r: { property_id: string }) => r.property_id));
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
  const chunkSize = 100;
  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize);
    const { data: ins, error: insertError } = await client
      .from('cadenza_service_jobs')
      .insert(chunk)
      .select('id, property_id, scheduled_date, route_order');
    if (insertError) throw new Error(insertError.message);
    inserted = inserted.concat(ins ?? []);
  }

  return {
    created: inserted.length,
    skipped_already_scheduled: skippedAlready,
    skipped_no_pattern_match: stops.length - matchingStops.length,
    date: dateOnly,
    jobs: inserted,
  };
}
