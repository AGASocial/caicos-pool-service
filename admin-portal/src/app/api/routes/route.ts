import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import {
  buildPaginatedResponse,
  decodeCursor,
  parsePaginationParams,
} from '@/lib/pagination';

type RouteRow = { id: string; name: string; technician_id: string; stops?: unknown[] };

function routeSortKey(row: RouteRow): string {
  return `${row.name}|${row.id}`;
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const { limit, cursor } = parsePaginationParams(searchParams);

  let query = (supabase as unknown as CadenzaSupabaseClient)
    .from('cadenza_routes')
    .select(`
      id,
      name,
      technician_id,
      day_of_week,
      is_active,
      created_at,
      technician:cadenza_profiles!technician_id(id, full_name),
      stops:cadenza_route_stops(id)
    `)
    .order('name', { ascending: true })
    .order('id', { ascending: true });

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      const [cursorName, cursorId] = decoded.sortKey.split('|');
      const id = cursorId || decoded.id;
      query = query.or(
        `name.gt.${cursorName},and(name.eq.${cursorName},id.gt.${id})`,
      );
    }
  }

  query = query.limit(limit + 1);

  const { data: routes, error } = await query;

  if (error) {
    console.error('Supabase error fetching routes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withCount = (routes || []).map((r: RouteRow) => ({
    ...r,
    stop_count: Array.isArray(r.stops) ? r.stops.length : 0,
    stops: undefined,
  }));

  return NextResponse.json(
    buildPaginatedResponse(withCount as RouteRow[], limit, routeSortKey),
  );
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

    const { data: profile, error: profileError } = await (supabase as unknown as CadenzaSupabaseClient)
      .from('cadenza_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json(
        { error: 'User profile or company not found. Sign up with a Cadenza company first.' },
        { status: 403 }
      );
    }

    const { data, error } = await (supabase as unknown as CadenzaSupabaseClient)
      .from('cadenza_routes')
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
