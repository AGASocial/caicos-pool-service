import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

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

    const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_route_stops')
      .insert({
        route_id: routeId,
        property_id,
        stop_order: order,
      })
      .select('id, route_id, property_id, stop_order, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This property is already on the route' },
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
