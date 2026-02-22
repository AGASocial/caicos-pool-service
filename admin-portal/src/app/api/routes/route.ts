import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

export async function GET() {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: routes, error } = await (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_routes')
    .select(`
      id,
      name,
      technician_id,
      day_of_week,
      is_active,
      created_at,
      technician:caicos_profiles!technician_id(id, full_name),
      stops:caicos_route_stops(id)
    `)
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase error fetching routes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type RouteRow = { id: string; name: string; technician_id: string; stops?: unknown[] };
  const withCount = (routes || []).map((r: RouteRow) => ({
    ...r,
    stop_count: Array.isArray(r.stops) ? r.stops.length : 0,
  }));

  return NextResponse.json(withCount);
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, technician_id } = body;

    if (!name || !technician_id) {
      return NextResponse.json(
        { error: 'name and technician_id are required' },
        { status: 400 }
      );
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

    const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_routes')
      .insert({
        company_id: profile.company_id,
        name: String(name).trim(),
        technician_id,
        is_active: true,
      })
      .select('id, name, technician_id, day_of_week, is_active, created_at')
      .single();

    if (error) {
      console.error('Supabase error creating route:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('POST /api/routes error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
