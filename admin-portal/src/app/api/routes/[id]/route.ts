import { NextRequest, NextResponse } from 'next/server';
import { softDeleteByIdForUser } from '@/lib/soft-delete';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;

  const { data: route, error } = await client
    .from('cadenza_routes')
    .select(`
      id,
      name,
      technician_id,
      day_of_week,
      is_active,
      created_at,
      updated_at,
      technician:cadenza_profiles!technician_id(id, full_name),
      stops:cadenza_route_stops(
        id,
        property_id,
        stop_order,
        day_of_week,
        service_frequency,
        week_ordinal,
        property:cadenza_properties(id, customer_name, address)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !route) {
    if (error?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }
    console.error('Supabase error fetching route:', error);
    return NextResponse.json({ error: error?.message || 'Not found' }, { status: 500 });
  }

  const rawStops = route.stops || [];
  const stopIds = rawStops.map((s: { id: string }) => s.id);

  type ScheduleRow = {
    id: string;
    route_stop_id: string;
    effective_from: string;
    effective_until: string | null;
    day_of_week: number;
    service_frequency: string;
    week_ordinal: number | null;
  };

  const schedulesByStopId = new Map<string, Omit<ScheduleRow, 'route_stop_id'>[]>();

  if (stopIds.length > 0) {
    const { data: scheduleRows, error: schedError } = await client
      .from('cadenza_route_stop_schedules')
      .select(
        'id, route_stop_id, effective_from, effective_until, day_of_week, service_frequency, week_ordinal'
      )
      .in('route_stop_id', stopIds);

    if (schedError) {
      console.error('Supabase error fetching route stop schedules:', schedError);
      return NextResponse.json({ error: schedError.message }, { status: 500 });
    }

    for (const row of (scheduleRows || []) as ScheduleRow[]) {
      const { route_stop_id: sid, ...rest } = row;
      const list = schedulesByStopId.get(sid) ?? [];
      list.push(rest);
      schedulesByStopId.set(sid, list);
    }
  }

  const stops = rawStops
    .map((s: Record<string, unknown>) => {
      const sid = s.id as string;
      const schedules = (schedulesByStopId.get(sid) ?? []).sort((a, b) =>
        a.effective_from < b.effective_from ? -1 : a.effective_from > b.effective_from ? 1 : 0
      );
      return { ...s, schedules };
    })
    .sort((a, b) => (a as unknown as { stop_order: number }).stop_order - (b as unknown as { stop_order: number }).stop_order);

  return NextResponse.json({ ...route, stops });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.technician_id !== undefined) updates.technician_id = body.technician_id;
    if (body.day_of_week !== undefined) updates.day_of_week = body.day_of_week;
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await (supabase as unknown as CadenzaSupabaseClient)
      .from('cadenza_routes')
      .update(updates)
      .eq('id', id)
      .select('id, name, technician_id, day_of_week, is_active, updated_at')
      .single();

    if (error) {
      console.error('Supabase error updating route:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('PATCH /api/routes/[id] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;

  const { error, count, forbidden } = await softDeleteByIdForUser(
    client,
    user.id,
    'cadenza_routes',
    id
  );

  if (forbidden) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (error) {
    console.error('Supabase error soft-deleting route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
