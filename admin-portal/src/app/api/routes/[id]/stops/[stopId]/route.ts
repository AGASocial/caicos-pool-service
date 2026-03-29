import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

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

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const freq = updates.service_frequency;
    const ord = updates.week_ordinal;
    if (freq === 'weekly' && ord !== undefined && ord !== null) {
      return NextResponse.json(
        { error: 'weekly stops must have week_ordinal null' },
        { status: 400 }
      );
    }
    if (freq === 'monthly' && ord === null) {
      return NextResponse.json(
        { error: 'monthly stops require week_ordinal 1–4' },
        { status: 400 }
      );
    }

    const client = supabase as unknown as CaicosSupabaseClient;
    const { data: row, error: fetchErr } = await client
      .from('caicos_route_stops')
      .select('id, service_frequency, week_ordinal')
      .eq('id', stopId)
      .eq('route_id', routeId)
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    const r = row as { service_frequency: string; week_ordinal: number | null };
    const nextFreq = updates.service_frequency ?? r.service_frequency;
    const nextOrd =
      updates.week_ordinal !== undefined ? updates.week_ordinal : r.week_ordinal;
    if (nextFreq === 'weekly' && nextOrd != null) {
      return NextResponse.json(
        { error: 'weekly stops must have week_ordinal null' },
        { status: 400 }
      );
    }
    if (nextFreq === 'monthly' && (nextOrd == null || nextOrd < 1 || nextOrd > 4)) {
      return NextResponse.json(
        { error: 'monthly stops require week_ordinal 1–4' },
        { status: 400 }
      );
    }

    if (updates.service_frequency === 'weekly') {
      updates.week_ordinal = null;
    }

    const { data, error } = await client
      .from('caicos_route_stops')
      .update(updates)
      .eq('id', stopId)
      .eq('route_id', routeId)
      .select(
        'id, property_id, stop_order, day_of_week, service_frequency, week_ordinal, created_at'
      )
      .single();

    if (error) {
      console.error('Supabase error updating stop:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
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
