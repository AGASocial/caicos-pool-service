import { addMonths, eachDayOfInterval, format, startOfDay } from 'date-fns';
import { pickSegmentForDate, toScheduleRow } from '@/lib/route-stop-schedule';
import { loadSchedulesByStopId } from '@/lib/route-stop-schedules-db';
import { stopMatchesDate } from '@/lib/schedule';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

type RouteRow = {
  id: string;
  company_id: string;
  technician_id: string | null;
};

type StopRow = {
  id: string;
  route_id: string;
  property_id: string;
  stop_order: number;
};

function ymdInRange(start: string, end: string): string[] {
  const startParts = start.split('-').map(Number);
  const endParts = end.split('-').map(Number);
  if (startParts.length !== 3 || endParts.length !== 3) return [];
  const [sy, sm, sd] = startParts;
  const [ey, em, ed] = endParts;
  const d0 = startOfDay(new Date(sy, sm - 1, sd));
  const d1 = startOfDay(new Date(ey, em - 1, ed));
  if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime()) || d0 > d1) return [];
  return eachDayOfInterval({ start: d0, end: d1 }).map((d) => format(d, 'yyyy-MM-dd'));
}

function jobKey(routeId: string, propertyId: string, date: string): string {
  return `${routeId}\0${propertyId}\0${date}`;
}

/**
 * Calendar window: today (server local midnight, UTC on Vercel) through the same calendar day one month later, inclusive.
 */
export function defaultRollingMonthWindowUtc(): { startDate: string; endDate: string } {
  const start = startOfDay(new Date());
  const end = addMonths(start, 1);
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  };
}

export type EnsureRouteJobsResult = {
  created: number;
  routeCount: number;
  stopCount: number;
  dateCount: number;
  startDate: string;
  endDate: string;
};

/**
 * Idempotently inserts route-sourced `caicos_service_jobs` for every matching stop in [startDate, endDate] (YYYY-MM-DD, inclusive).
 */
export async function ensureRouteJobsForDateRange(
  client: CaicosSupabaseClient,
  startDate: string,
  endDate: string
): Promise<EnsureRouteJobsResult> {
  const dates = ymdInRange(startDate, endDate);
  if (dates.length === 0) {
    return {
      created: 0,
      routeCount: 0,
      stopCount: 0,
      dateCount: 0,
      startDate,
      endDate,
    };
  }

  const { data: routes, error: routesErr } = await client
    .from('caicos_routes')
    .select('id, company_id, technician_id');

  if (routesErr) {
    throw new Error(`Failed to load routes: ${routesErr.message}`);
  }

  const routeList = (routes ?? []) as RouteRow[];
  if (routeList.length === 0) {
    return {
      created: 0,
      routeCount: 0,
      stopCount: 0,
      dateCount: dates.length,
      startDate,
      endDate,
    };
  }

  const routeIds = routeList.map((r) => r.id);
  const { data: stops, error: stopsErr } = await client
    .from('caicos_route_stops')
    .select('id, route_id, property_id, stop_order')
    .in('route_id', routeIds);

  if (stopsErr) {
    throw new Error(`Failed to load route stops: ${stopsErr.message}`);
  }

  const stopList = (stops ?? []) as StopRow[];
  const stopsByRoute = new Map<string, StopRow[]>();
  for (const s of stopList) {
    const list = stopsByRoute.get(s.route_id) ?? [];
    list.push(s);
    stopsByRoute.set(s.route_id, list);
  }

  const scheduleByStop = await loadSchedulesByStopId(
    client,
    stopList.map((s) => s.id)
  );

  const existingKeys = new Set<string>();
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data: page, error: exErr } = await client
      .from('caicos_service_jobs')
      .select('route_id, property_id, scheduled_date')
      .eq('job_source', 'route')
      .not('route_id', 'is', null)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .range(offset, offset + pageSize - 1);

    if (exErr) {
      throw new Error(`Failed to load existing jobs: ${exErr.message}`);
    }
    const rows = page ?? [];
    for (const row of rows) {
      const rid = row.route_id as string;
      const pid = row.property_id as string;
      const sd = row.scheduled_date as string;
      existingKeys.add(jobKey(rid, pid, sd.slice(0, 10)));
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  type JobInsert = {
    company_id: string;
    property_id: string;
    technician_id: string | null;
    route_id: string;
    scheduled_date: string;
    status: string;
    route_order: number;
    job_source: string;
    visit_kind_id: null;
  };

  const toInsert: JobInsert[] = [];

  for (const route of routeList) {
    const routeStops = stopsByRoute.get(route.id);
    if (!routeStops?.length) continue;

    for (const dateStr of dates) {
      for (const stop of routeStops) {
        const segments = scheduleByStop.get(stop.id) ?? [];
        const seg = pickSegmentForDate(segments, dateStr);
        if (!seg) continue;
        const matches = stopMatchesDate(toScheduleRow(seg), dateStr);
        if (!matches) continue;

        const key = jobKey(route.id, stop.property_id, dateStr);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);

        toInsert.push({
          company_id: route.company_id,
          property_id: stop.property_id,
          technician_id: route.technician_id,
          route_id: route.id,
          scheduled_date: dateStr,
          status: 'pending',
          route_order: stop.stop_order,
          job_source: 'route',
          visit_kind_id: null,
        });
      }
    }
  }

  const chunkSize = 250;
  let created = 0;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    const { error: insErr } = await client.from('caicos_service_jobs').insert(chunk);
    if (insErr) {
      throw new Error(`Failed to insert jobs: ${insErr.message}`);
    }
    created += chunk.length;
  }

  return {
    created,
    routeCount: routeList.length,
    stopCount: stopList.length,
    dateCount: dates.length,
    startDate,
    endDate,
  };
}
