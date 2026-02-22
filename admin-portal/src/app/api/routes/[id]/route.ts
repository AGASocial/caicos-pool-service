import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: route, error } = await (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_routes')
    .select(`
      id,
      name,
      technician_id,
      day_of_week,
      is_active,
      created_at,
      updated_at,
      technician:caicos_profiles!technician_id(id, full_name),
      stops:caicos_route_stops(
        id,
        property_id,
        stop_order,
        property:caicos_properties(id, customer_name, address)
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

  const stops = (route.stops || []).sort(
    (a: { stop_order: number }, b: { stop_order: number }) => a.stop_order - b.stop_order
  );

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

    const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_routes')
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

  const { error } = await (supabase as unknown as CaicosSupabaseClient).from('caicos_routes').delete().eq('id', id);

  if (error) {
    console.error('Supabase error deleting route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
