import {
  pickSegmentForDate,
  todayUtcYmd,
  type RouteStopScheduleSegment,
} from '@/lib/route-stop-schedule';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

function rowToSegment(row: Record<string, unknown>): RouteStopScheduleSegment {
  const sid = row.route_stop_id as string;
  return {
    id: row.id as string | undefined,
    route_stop_id: sid,
    effective_from: String(row.effective_from).slice(0, 10),
    effective_until:
      row.effective_until == null ? null : String(row.effective_until).slice(0, 10),
    day_of_week: Number(row.day_of_week),
    service_frequency: row.service_frequency === 'monthly' ? 'monthly' : 'weekly',
    week_ordinal: row.week_ordinal == null ? null : Number(row.week_ordinal),
  };
}

export async function loadSchedulesByStopId(
  client: CaicosSupabaseClient,
  stopIds: string[]
): Promise<Map<string, RouteStopScheduleSegment[]>> {
  const map = new Map<string, RouteStopScheduleSegment[]>();
  if (stopIds.length === 0) return map;

  const chunkSize = 300;
  for (let i = 0; i < stopIds.length; i += chunkSize) {
    const chunk = stopIds.slice(i, i + chunkSize);
    const { data, error } = await client
      .from('caicos_route_stop_schedules')
      .select(
        'id, route_stop_id, effective_from, effective_until, day_of_week, service_frequency, week_ordinal'
      )
      .in('route_stop_id', chunk)
      .order('effective_from', { ascending: true });

    if (error) {
      throw new Error(`loadSchedulesByStopId: ${error.message}`);
    }
    for (const row of data ?? []) {
      const seg = rowToSegment(row as Record<string, unknown>);
      const list = map.get(seg.route_stop_id!) ?? [];
      list.push(seg);
      map.set(seg.route_stop_id!, list);
    }
  }
  return map;
}

/** Sets caicos_route_stops.day_of_week / frequency from the segment active today (UTC). */
export async function syncDenormalizedStopFromSchedules(
  client: CaicosSupabaseClient,
  stopId: string
): Promise<void> {
  const map = await loadSchedulesByStopId(client, [stopId]);
  const segments = map.get(stopId) ?? [];
  const seg = pickSegmentForDate(segments, todayUtcYmd());
  if (!seg) return;

  const { error } = await client
    .from('caicos_route_stops')
    .update({
      day_of_week: seg.day_of_week,
      service_frequency: seg.service_frequency,
      week_ordinal: seg.week_ordinal,
    })
    .eq('id', stopId);

  if (error) {
    throw new Error(`syncDenormalizedStopFromSchedules: ${error.message}`);
  }
}
