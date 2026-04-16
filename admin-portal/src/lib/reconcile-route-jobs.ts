import {
  nextMatchingDateFrom,
  pickSegmentForDate,
  toScheduleRow,
  type RouteStopScheduleSegment,
} from '@/lib/route-stop-schedule';
import { stopMatchesDate } from '@/lib/schedule';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

export type ReconcileRouteJobsResult = {
  examined: number;
  updated: number;
  deleted_as_duplicate: number;
  unchanged: number;
};

/**
 * Aligns pending route jobs from `fromDate` onward with effective-dated schedule segments.
 * Jobs on dates that no longer match the active segment are moved to the next matching date,
 * or removed if another pending job already occupies that date.
 */
export async function reconcilePendingRouteJobsForStop(
  client: CaicosSupabaseClient,
  params: {
    routeId: string;
    propertyId: string;
    fromDate: string;
    segments: RouteStopScheduleSegment[];
  }
): Promise<ReconcileRouteJobsResult> {
  const { routeId, propertyId, fromDate, segments } = params;
  const sorted = [...segments].sort((a, b) => a.effective_from.localeCompare(b.effective_from));

  const { data: jobs, error: jobsErr } = await client
    .from('caicos_service_jobs')
    .select('id, scheduled_date')
    .eq('route_id', routeId)
    .eq('property_id', propertyId)
    .eq('job_source', 'route')
    .eq('status', 'pending')
    .gte('scheduled_date', fromDate);

  if (jobsErr) {
    throw new Error(`reconcile: failed to load jobs: ${jobsErr.message}`);
  }

  let updated = 0;
  let deleted_as_duplicate = 0;
  let unchanged = 0;
  const rows = (jobs ?? []) as { id: string; scheduled_date: string }[];

  for (const job of rows) {
    const d = String(job.scheduled_date).slice(0, 10);
    const seg = pickSegmentForDate(sorted, d);
    if (!seg) {
      unchanged += 1;
      continue;
    }
    if (stopMatchesDate(toScheduleRow(seg), d)) {
      unchanged += 1;
      continue;
    }

    const newDate = nextMatchingDateFrom(sorted, d);
    if (!newDate || newDate === d) {
      unchanged += 1;
      continue;
    }

    const { data: clash } = await client
      .from('caicos_service_jobs')
      .select('id')
      .eq('route_id', routeId)
      .eq('property_id', propertyId)
      .eq('job_source', 'route')
      .eq('scheduled_date', newDate)
      .maybeSingle();

    const clashId = clash && typeof (clash as { id: string }).id === 'string'
      ? (clash as { id: string }).id
      : null;

    if (clashId && clashId !== job.id) {
      const { error: delErr } = await client.from('caicos_service_jobs').delete().eq('id', job.id);
      if (delErr) {
        throw new Error(`reconcile: failed to delete stale job: ${delErr.message}`);
      }
      deleted_as_duplicate += 1;
      continue;
    }

    const { error: updErr } = await client
      .from('caicos_service_jobs')
      .update({ scheduled_date: newDate, updated_at: new Date().toISOString() })
      .eq('id', job.id);

    if (updErr) {
      throw new Error(`reconcile: failed to move job: ${updErr.message}`);
    }
    updated += 1;
  }

  return {
    examined: rows.length,
    updated,
    deleted_as_duplicate,
    unchanged,
  };
}
