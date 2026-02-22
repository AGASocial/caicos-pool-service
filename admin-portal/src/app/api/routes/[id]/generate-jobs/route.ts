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
    const dateStr = body?.date;

    if (!dateStr || typeof dateStr !== 'string') {
      return NextResponse.json(
        { error: 'date is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(dateStr);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date' },
        { status: 400 }
      );
    }

    const dateOnly = dateStr.slice(0, 10);

    const { data: route, error: routeError } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_routes')
      .select('id, company_id, technician_id')
      .eq('id', routeId)
      .single();

    if (routeError || !route) {
      return NextResponse.json(
        { error: 'Route not found' },
        { status: 404 }
      );
    }

    const { data: stops, error: stopsError } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_route_stops')
      .select('id, property_id, stop_order')
      .eq('route_id', routeId)
      .order('stop_order', { ascending: true });

    if (stopsError || !stops?.length) {
      return NextResponse.json(
        { error: 'Route has no stops' },
        { status: 400 }
      );
    }

    const jobs = stops.map((stop: { property_id: string; stop_order: number }) => ({
      company_id: route.company_id,
      property_id: stop.property_id,
      technician_id: route.technician_id,
      route_id: routeId,
      scheduled_date: dateOnly,
      status: 'pending',
      route_order: stop.stop_order,
    }));

    const { data: inserted, error: insertError } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_service_jobs')
      .insert(jobs)
      .select('id, property_id, scheduled_date, route_order');

    if (insertError) {
      console.error('Supabase error creating jobs:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      created: inserted?.length ?? 0,
      date: dateOnly,
      jobs: inserted,
    });
  } catch (e) {
    console.error('POST /api/routes/[id]/generate-jobs error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
