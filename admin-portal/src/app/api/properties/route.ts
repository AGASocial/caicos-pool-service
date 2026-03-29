import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

const PROPERTY_BASE_FIELDS =
  'id, customer_name, customer_email, customer_phone, address, city, state, zip, gate_code, pool_type, pool_surface, notes, is_active, created_at';

function attachRouteFromStopRow(row: Record<string, unknown>): Record<string, unknown> {
  const stops = row.caicos_route_stops;
  const { caicos_route_stops: _, ...rest } = row;
  let stop: Record<string, unknown> | undefined;
  if (Array.isArray(stops)) {
    stop = stops[0] as Record<string, unknown> | undefined;
  } else if (stops && typeof stops === 'object') {
    stop = stops as Record<string, unknown>;
  }
  let route: { id: string; name: string } | null = null;
  if (stop) {
    const nested = stop.caicos_routes ?? stop.route;
    const routeObj = Array.isArray(nested)
      ? (nested[0] as Record<string, unknown> | undefined)
      : (nested as Record<string, unknown> | undefined);
    if (routeObj?.id != null && routeObj?.name != null) {
      route = { id: String(routeObj.id), name: String(routeObj.name) };
    }
  }
  return { ...rest, route };
}

/**
 * List properties for the current user's company.
 * Query: active_only=false to include inactive; include_route=1 to add route { id, name } | null (from caicos_route_stops).
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active_only') !== 'false';
  const includeRoute =
    searchParams.get('include_route') === '1' || searchParams.get('include_route') === 'true';

  const select = includeRoute
    ? `${PROPERTY_BASE_FIELDS}, caicos_route_stops(route_id, caicos_routes(id, name))`
    : PROPERTY_BASE_FIELDS;

  let query = (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_properties')
    .select(select)
    .order('customer_name', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Supabase error fetching properties:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown[];
  if (!includeRoute) {
    return NextResponse.json(rows);
  }

  return NextResponse.json(
    rows.map((r) => attachRouteFromStopRow(r as Record<string, unknown>))
  );
}

/**
 * Create a property for the current user's company.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.company_id) {
    return NextResponse.json(
      { error: 'User profile or company not found. Sign up with a Caicos company first.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      customer_name,
      address,
      customer_email,
      customer_phone,
      city,
      state,
      zip,
      gate_code,
      pool_type,
      pool_surface,
      equipment_notes,
      notes,
      is_active,
    } = body;

    if (!customer_name || !address) {
      return NextResponse.json(
        { error: 'customer_name and address are required' },
        { status: 400 }
      );
    }

    const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_properties')
      .insert({
        company_id: profile.company_id,
        customer_name: String(customer_name).trim(),
        address: String(address).trim(),
        customer_email: customer_email ? String(customer_email).trim() : null,
        customer_phone: customer_phone ? String(customer_phone).trim() : null,
        city: city ? String(city).trim() : null,
        state: state ? String(state).trim() : null,
        zip: zip ? String(zip).trim() : null,
        gate_code: gate_code ? String(gate_code).trim() : null,
        pool_type: ['residential', 'commercial', 'spa', 'other'].includes(pool_type) ? pool_type : null,
        pool_surface: ['plaster', 'pebble', 'tile', 'vinyl', 'fiberglass', 'other'].includes(pool_surface) ? pool_surface : null,
        equipment_notes: equipment_notes ? String(equipment_notes).trim() : null,
        notes: notes ? String(notes).trim() : null,
        is_active: is_active !== false,
      })
      .select('id, customer_name, address, city, is_active, created_at')
      .single();

    if (error) {
      console.error('Supabase error creating property:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('POST /api/properties error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
