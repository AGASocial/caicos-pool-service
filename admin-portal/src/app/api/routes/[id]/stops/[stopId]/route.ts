import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';
import { reconcilePendingRouteJobsForStop } from '@/lib/reconcile-route-jobs';
import { dayBeforeYmd, todayUtcYmd } from '@/lib/route-stop-schedule';
import {
  loadSchedulesByStopId,
  syncDenormalizedStopFromSchedules,
} from '@/lib/route-stop-schedules-db';

function parseSchedulePatch(body: Record<string, unknown>): {
  day_of_week?: number;
  service_frequency?: 'weekly' | 'monthly';
  week_ordinal?: number | null;
  stop_order?: number;
} {
  const out: {
    day_of_week?: number;
    service_frequency?: 'weekly' | 'monthly';
    week_ordinal?: number | null;
    stop_order?: number;
  } = {};
  if (body.day_of_week !== undefined) {
    const d = Number(body.day_of_week);
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      throw new Error('day_of_week must be an integer 0–6 (0=Sunday)');
    }
    out.day_of_week = d;
  }
  if (body.service_frequency !== undefined) {
    const f = String(body.service_frequency);
    if (f !== 'weekly' && f !== 'monthly') {
      throw new Error('service_frequency must be weekly or monthly');
    }
    out.service_frequency = f;
  }
  if (body.week_ordinal !== undefined) {
    if (body.week_ordinal === null) {
      out.week_ordinal = null;
    } else {
      const w = Number(body.week_ordinal);
      if (!Number.isInteger(w) || w < 1 || w > 4) {
        throw new Error('week_ordinal must be 1–4 or null');
      }
      out.week_ordinal = w;
    }
  }
  if (body.stop_order !== undefined) {
    const o = Number(body.stop_order);
    if (!Number.isFinite(o)) throw new Error('stop_order must be a number');
    out.stop_order = o;
  }
  return out;
}

function parseEffectiveFrom(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

type StopRow = {
  id: string;
  route_id: string;
  property_id: string;
  stop_order: number;
  day_of_week: number;
  service_frequency: string;
  week_ordinal: number | null;
};

async function persistScheduleSegment(
  client: CaicosSupabaseClient,
  args: {
    routeStopId: string;
    routeId: string;
    propertyId: string;
    effectiveFrom: string;
    day_of_week: number;
    service_frequency: 'weekly' | 'monthly';
    week_ordinal: number | null;
  }
): Promise<void> {
  const { routeStopId, routeId, propertyId, effectiveFrom, ...pattern } = args;

  const { data: atDate, error: selErr } = await client
    .from('caicos_route_stop_schedules')
    .select('id')
    .eq('route_stop_id', routeStopId)
    .eq('effective_from', effectiveFrom)
    .maybeSingle();

  if (selErr) {
    throw new Error(selErr.message);
  }

  if (atDate && typeof (atDate as { id: string }).id === 'string') {
    const { error } = await client
      .from('caicos_route_stop_schedules')
      .update({
        day_of_week: pattern.day_of_week,
        service_frequency: pattern.service_frequency,
        week_ordinal: pattern.week_ordinal,
      })
      .eq('id', (atDate as { id: string }).id);
    if (error) throw new Error(error.message);
  } else {
    const before = dayBeforeYmd(effectiveFrom);
    if (before) {
      const { error: closeErr } = await client
        .from('caicos_route_stop_schedules')
        .update({ effective_until: before })
        .eq('route_stop_id', routeStopId)
        .is('effective_until', null)
        .lt('effective_from', effectiveFrom);
      if (closeErr) throw new Error(closeErr.message);
    }
    const { error: insErr } = await client.from('caicos_route_stop_schedules').insert({
      route_stop_id: routeStopId,
      effective_from: effectiveFrom,
      effective_until: null,
      day_of_week: pattern.day_of_week,
      service_frequency: pattern.service_frequency,
      week_ordinal: pattern.week_ordinal,
    });
    if (insErr) throw new Error(insErr.message);
  }

  await syncDenormalizedStopFromSchedules(client, routeStopId);
  const map = await loadSchedulesByStopId(client, [routeStopId]);
  const segments = map.get(routeStopId) ?? [];
  await reconcilePendingRouteJobsForStop(client, {
    routeId,
    propertyId,
    fromDate: effectiveFrom,
    segments,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stopId: string }> }
) {
  const { id: routeId, stopId } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    let updates: ReturnType<typeof parseSchedulePatch>;
    try {
      updates = parseSchedulePatch(body);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid body' },
        { status: 400 }
      );
    }

    const scheduleObj =
      body.schedule && typeof body.schedule === 'object' && !Array.isArray(body.schedule)
        ? (body.schedule as Record<string, unknown>)
        : null;

    const client = supabase as unknown as CaicosSupabaseClient;
    const { data: row, error: fetchErr } = await client
      .from('caicos_route_stops')
      .select(
        'id, route_id, property_id, stop_order, day_of_week, service_frequency, week_ordinal'
      )
      .eq('id', stopId)
      .eq('route_id', routeId)
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    const stop = row as StopRow;

    const hasNestedSchedule =
      scheduleObj &&
      (scheduleObj.effective_from !== undefined ||
        scheduleObj.day_of_week !== undefined ||
        scheduleObj.service_frequency !== undefined ||
        scheduleObj.week_ordinal !== undefined);

    const hasLegacyScheduleChange =
      updates.day_of_week !== undefined ||
      updates.service_frequency !== undefined ||
      updates.week_ordinal !== undefined;

    const onlyStopOrder =
      Object.keys(updates).length === 1 && updates.stop_order !== undefined;

    if (
      !hasNestedSchedule &&
      !hasLegacyScheduleChange &&
      Object.keys(updates).length === 0
    ) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    if (!hasNestedSchedule && !hasLegacyScheduleChange && onlyStopOrder) {
      const { data, error } = await client
        .from('caicos_route_stops')
        .update({ stop_order: updates.stop_order })
        .eq('id', stopId)
        .eq('route_id', routeId)
        .select(
          'id, property_id, stop_order, day_of_week, service_frequency, week_ordinal, created_at'
        )
        .single();
      if (error) {
        console.error('Supabase error updating stop order:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    if (hasNestedSchedule) {
      const eff = parseEffectiveFrom(scheduleObj!.effective_from);
      if (!eff) {
        return NextResponse.json(
          { error: 'schedule.effective_from is required (YYYY-MM-DD) when using schedule object' },
          { status: 400 }
        );
      }
      let nestedPatch: ReturnType<typeof parseSchedulePatch>;
      try {
        nestedPatch = parseSchedulePatch(scheduleObj!);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Invalid schedule' },
          { status: 400 }
        );
      }
      const day =
        nestedPatch.day_of_week !== undefined ? nestedPatch.day_of_week : stop.day_of_week;
      const freq =
        nestedPatch.service_frequency !== undefined
          ? nestedPatch.service_frequency
          : stop.service_frequency === 'monthly'
            ? 'monthly'
            : 'weekly';
      let ord =
        nestedPatch.week_ordinal !== undefined ? nestedPatch.week_ordinal : stop.week_ordinal;
      if (freq === 'weekly') ord = null;
      if (freq === 'monthly' && (ord == null || ord < 1 || ord > 4)) {
        return NextResponse.json(
          { error: 'monthly stops require week_ordinal 1–4' },
          { status: 400 }
        );
      }

      try {
        await persistScheduleSegment(client, {
          routeStopId: stopId,
          routeId,
          propertyId: stop.property_id,
          effectiveFrom: eff,
          day_of_week: day,
          service_frequency: freq,
          week_ordinal: ord,
        });
      } catch (e) {
        console.error('persistScheduleSegment:', e);
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Failed to update schedule' },
          { status: 500 }
        );
      }

      if (updates.stop_order !== undefined) {
        const { error: ordErr } = await client
          .from('caicos_route_stops')
          .update({ stop_order: updates.stop_order })
          .eq('id', stopId)
          .eq('route_id', routeId);
        if (ordErr) {
          return NextResponse.json({ error: ordErr.message }, { status: 500 });
        }
      }

      const { data: out, error: outErr } = await client
        .from('caicos_route_stops')
        .select(
          'id, property_id, stop_order, day_of_week, service_frequency, week_ordinal, created_at'
        )
        .eq('id', stopId)
        .single();
      if (outErr) {
        return NextResponse.json({ error: outErr.message }, { status: 500 });
      }
      return NextResponse.json(out);
    }

    if (hasLegacyScheduleChange) {
      const eff =
        parseEffectiveFrom(body.schedule_effective_from) ?? todayUtcYmd();
      const nextFreq =
        updates.service_frequency !== undefined
          ? updates.service_frequency
          : stop.service_frequency === 'monthly'
            ? 'monthly'
            : 'weekly';
      const nextDay =
        updates.day_of_week !== undefined ? updates.day_of_week : stop.day_of_week;
      let nextOrd =
        updates.week_ordinal !== undefined ? updates.week_ordinal : stop.week_ordinal;
      if (nextFreq === 'weekly') nextOrd = null;
      if (nextFreq === 'monthly' && (nextOrd == null || nextOrd < 1 || nextOrd > 4)) {
        return NextResponse.json(
          { error: 'monthly stops require week_ordinal 1–4' },
          { status: 400 }
        );
      }

      try {
        await persistScheduleSegment(client, {
          routeStopId: stopId,
          routeId,
          propertyId: stop.property_id,
          effectiveFrom: eff,
          day_of_week: nextDay,
          service_frequency: nextFreq,
          week_ordinal: nextOrd,
        });
      } catch (e) {
        console.error('persistScheduleSegment (legacy):', e);
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Failed to update schedule' },
          { status: 500 }
        );
      }

      if (updates.stop_order !== undefined) {
        const { error: ordErr } = await client
          .from('caicos_route_stops')
          .update({ stop_order: updates.stop_order })
          .eq('id', stopId)
          .eq('route_id', routeId);
        if (ordErr) {
          return NextResponse.json({ error: ordErr.message }, { status: 500 });
        }
      }

      const { data: out, error: outErr } = await client
        .from('caicos_route_stops')
        .select(
          'id, property_id, stop_order, day_of_week, service_frequency, week_ordinal, created_at'
        )
        .eq('id', stopId)
        .single();
      if (outErr) {
        return NextResponse.json({ error: outErr.message }, { status: 500 });
      }
      return NextResponse.json(out);
    }

    if (updates.stop_order !== undefined) {
      const { data, error } = await client
        .from('caicos_route_stops')
        .update({ stop_order: updates.stop_order })
        .eq('id', stopId)
        .eq('route_id', routeId)
        .select(
          'id, property_id, stop_order, day_of_week, service_frequency, week_ordinal, created_at'
        )
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  } catch (e) {
    console.error('PATCH /api/routes/[id]/stops/[stopId] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; stopId: string }> }
) {
  const { id: routeId, stopId } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error, count } = await (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_route_stops')
    .delete({ count: 'exact' })
    .eq('id', stopId)
    .eq('route_id', routeId);

  if (error) {
    console.error('Supabase error deleting stop:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
