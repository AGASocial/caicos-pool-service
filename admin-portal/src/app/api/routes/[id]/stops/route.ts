import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DefaultStopSchedule = {
  day_of_week: number;
  service_frequency: 'weekly' | 'monthly';
  week_ordinal: number | null;
};

function parseDefaultStopSchedule(raw: unknown): DefaultStopSchedule | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const dow =
    typeof o.day_of_week === 'number'
      ? o.day_of_week
      : typeof o.day_of_week === 'string'
        ? Number(o.day_of_week)
        : NaN;
  if (!Number.isInteger(dow) || dow < 0 || dow > 6) return null;
  const freq = o.service_frequency === 'monthly' ? 'monthly' : 'weekly';
  let weekOrdinal: number | null = null;
  if (freq === 'monthly') {
    const w =
      typeof o.week_ordinal === 'number'
        ? o.week_ordinal
        : typeof o.week_ordinal === 'string'
          ? Number(o.week_ordinal)
          : NaN;
    if (!Number.isInteger(w) || w < 1 || w > 4) return null;
    weekOrdinal = w;
  }
  return {
    day_of_week: dow,
    service_frequency: freq,
    week_ordinal: weekOrdinal,
  };
}

/** Map Postgres 23505 to a clear message (unique on property_id vs on route+property). */
function routeStopsConflictError(error: { code?: string; message?: string }): string | null {
  if (error.code !== '23505') return null;
  const msg = error.message ?? '';
  if (msg.includes('caicos_route_stops_property_id_unique')) {
    return 'This property is already on another route. Remove it from that route first.';
  }
  if (msg.includes('route_id') && msg.includes('property_id')) {
    return 'This property is already on this route';
  }
  return 'This property is already assigned to a route';
}

function parseUuidArray(
  value: unknown,
  field: string
): { ok: true; ids: string[] } | { ok: false; response: NextResponse } {
  if (value === undefined || value === null) {
    return { ok: true, ids: [] };
  }
  if (!Array.isArray(value)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `${field} must be an array of UUID strings` },
        { status: 400 }
      ),
    };
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `${field} must contain only string UUIDs` },
          { status: 400 }
        ),
      };
    }
    const id = item.trim();
    if (!UUID_RE.test(id)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Invalid UUID in ${field}: ${id}` },
          { status: 400 }
        ),
      };
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return { ok: true, ids };
}

/**
 * Bulk add/remove stops on a route.
 *
 * - add_property_ids: properties to append (order preserved; skips if already on this route or on another route).
 * - remove_stop_ids: caicos_route_stops.id rows to delete (scoped to this route).
 * Response may include skipped_property_ids and property_ids_on_other_routes.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: routeId } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected a JSON object' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const addParsed = parseUuidArray(raw.add_property_ids, 'add_property_ids');
  if (!addParsed.ok) return addParsed.response;
  const removeParsed = parseUuidArray(raw.remove_stop_ids, 'remove_stop_ids');
  if (!removeParsed.ok) return removeParsed.response;

  const addPropertyIds = addParsed.ids;
  const removeStopIds = removeParsed.ids;
  const defaultSchedule =
    parseDefaultStopSchedule((raw as Record<string, unknown>).default_stop_schedule) ?? {
      day_of_week: 1,
      service_frequency: 'weekly' as const,
      week_ordinal: null as number | null,
    };

  if (addPropertyIds.length === 0 && removeStopIds.length === 0) {
    return NextResponse.json(
      {
        error:
          'Provide add_property_ids and/or remove_stop_ids with at least one UUID',
      },
      { status: 400 }
    );
  }

  const client = supabase as unknown as CaicosSupabaseClient;

  try {
    let removedStopIds: string[] = [];
    if (removeStopIds.length > 0) {
      const { data: deleted, error: deleteError } = await client
        .from('caicos_route_stops')
        .delete()
        .eq('route_id', routeId)
        .in('id', removeStopIds)
        .select('id');

      if (deleteError) {
        console.error('Supabase error bulk removing stops:', deleteError);
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
      removedStopIds = (deleted ?? []).map((r: { id: string }) => r.id);
    }

    const skippedPropertyIds: string[] = [];
    const propertyIdsOnOtherRoutes: string[] = [];
    const addedStops: Array<{
      id: string;
      route_id: string;
      property_id: string;
      stop_order: number;
      day_of_week: number;
      service_frequency: string;
      week_ordinal: number | null;
      created_at: string;
    }> = [];

    if (addPropertyIds.length > 0) {
      const { data: existingRows, error: existingError } = await client
        .from('caicos_route_stops')
        .select('property_id, stop_order')
        .eq('route_id', routeId);

      if (existingError) {
        console.error('Supabase error reading stops for bulk add:', existingError);
        return NextResponse.json({ error: existingError.message }, { status: 500 });
      }

      const existingPropertyIds = new Set(
        (existingRows ?? []).map((r: { property_id: string }) => r.property_id)
      );
      const maxOrder = (existingRows ?? []).reduce(
        (m: number, r: { stop_order: number }) =>
          typeof r.stop_order === 'number' && r.stop_order > m ? r.stop_order : m,
        0
      );

      const { data: conflictRows, error: conflictError } = await client
        .from('caicos_route_stops')
        .select('property_id, route_id')
        .in('property_id', addPropertyIds);

      if (conflictError) {
        console.error('Supabase error checking route stop conflicts:', conflictError);
        return NextResponse.json({ error: conflictError.message }, { status: 500 });
      }

      const onAnotherRoute = new Set<string>();
      for (const row of conflictRows ?? []) {
        const r = row as { property_id: string; route_id: string };
        if (r.route_id !== routeId) {
          onAnotherRoute.add(r.property_id);
        }
      }

      const toInsert: Array<{
        route_id: string;
        property_id: string;
        stop_order: number;
        day_of_week: number;
        service_frequency: 'weekly' | 'monthly';
        week_ordinal: number | null;
      }> = [];
      let nextOrder = maxOrder;
      for (const propertyId of addPropertyIds) {
        if (existingPropertyIds.has(propertyId)) {
          skippedPropertyIds.push(propertyId);
          continue;
        }
        if (onAnotherRoute.has(propertyId)) {
          propertyIdsOnOtherRoutes.push(propertyId);
          continue;
        }
        nextOrder += 1;
        toInsert.push({
          route_id: routeId,
          property_id: propertyId,
          stop_order: nextOrder,
          day_of_week: defaultSchedule.day_of_week,
          service_frequency: defaultSchedule.service_frequency,
          week_ordinal: defaultSchedule.week_ordinal,
        });
        existingPropertyIds.add(propertyId);
      }

      if (toInsert.length > 0) {
        const { data: inserted, error: insertError } = await client
          .from('caicos_route_stops')
          .insert(toInsert)
          .select(
            'id, route_id, property_id, stop_order, day_of_week, service_frequency, week_ordinal, created_at'
          );

        if (insertError) {
          if (insertError.code === '23505') {
            const conflict = routeStopsConflictError(insertError);
            return NextResponse.json(
              {
                error:
                  conflict ??
                  'One or more properties are already assigned to a route',
              },
              { status: 409 }
            );
          }
          console.error('Supabase error bulk inserting stops:', insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
        addedStops.push(
          ...(inserted as typeof addedStops)
        );
      }
    }

    return NextResponse.json({
      added: addedStops,
      removed_stop_ids: removedStopIds,
      skipped_property_ids: skippedPropertyIds,
      property_ids_on_other_routes: propertyIdsOnOtherRoutes,
    });
  } catch (e) {
    console.error('PATCH /api/routes/[id]/stops error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const { property_id, stop_order } = body;

    if (!property_id) {
      return NextResponse.json(
        { error: 'property_id is required' },
        { status: 400 }
      );
    }

    const order = typeof stop_order === 'number' ? stop_order : 0;
    const sched =
      parseDefaultStopSchedule(body.default_stop_schedule) ??
      parseDefaultStopSchedule({
        day_of_week: body.day_of_week,
        service_frequency: body.service_frequency,
        week_ordinal: body.week_ordinal,
      }) ?? {
        day_of_week: 1,
        service_frequency: 'weekly' as const,
        week_ordinal: null as number | null,
      };

    const client = supabase as unknown as CaicosSupabaseClient;
    const { data: existingForProperty, error: existingErr } = await client
      .from('caicos_route_stops')
      .select('route_id')
      .eq('property_id', property_id)
      .maybeSingle();

    if (existingErr) {
      console.error('Supabase error checking route stop:', existingErr);
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    if (existingForProperty) {
      const row = existingForProperty as { route_id: string };
      if (row.route_id === routeId) {
        return NextResponse.json(
          { error: 'This property is already on this route' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error:
            'This property is already on another route. Remove it from that route first.',
        },
        { status: 409 }
      );
    }

    const { data, error } = await client
      .from('caicos_route_stops')
      .insert({
        route_id: routeId,
        property_id,
        stop_order: order,
        day_of_week: sched.day_of_week,
        service_frequency: sched.service_frequency,
        week_ordinal: sched.week_ordinal,
      })
      .select(
        'id, route_id, property_id, stop_order, day_of_week, service_frequency, week_ordinal, created_at'
      )
      .single();

    if (error) {
      if (error.code === '23505') {
        const conflict = routeStopsConflictError(error);
        return NextResponse.json(
          { error: conflict ?? 'This property is already assigned to a route' },
          { status: 409 }
        );
      }
      console.error('Supabase error adding stop:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('POST /api/routes/[id]/stops error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
