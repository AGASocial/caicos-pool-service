import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

/**
 * List jobs for the current user's company.
 * Query: date_from, date_to (YYYY-MM-DD), technician_id, status
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const technicianId = searchParams.get('technician_id');
  const status = searchParams.get('status');
  const jobSource = searchParams.get('job_source');
  const routeId = searchParams.get('route_id');
  const dayOfWeekParam = searchParams.get('day_of_week');

  let query = (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_service_jobs')
    .select(`
      id,
      property_id,
      technician_id,
      route_id,
      scheduled_date,
      scheduled_time,
      status,
      route_order,
      notes,
      job_source,
      visit_kind_id,
      created_at,
      property:caicos_properties!property_id(id, customer_name, address),
      technician:caicos_profiles!technician_id(id, full_name),
      route:caicos_routes!route_id(id, name),
      visit_kind:caicos_visit_reasons!visit_kind_id(id, slug, label)
    `)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true, nullsFirst: false });

  if (dateFrom) query = query.gte('scheduled_date', dateFrom);
  if (dateTo) query = query.lte('scheduled_date', dateTo);
  if (technicianId) query = query.eq('technician_id', technicianId);
  if (status) query = query.eq('status', status);
  if (jobSource === 'route' || jobSource === 'ad_hoc') query = query.eq('job_source', jobSource);
  if (routeId) query = query.eq('route_id', routeId);

  const { data, error } = await query;

  if (error) {
    console.error('Supabase error fetching jobs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let rows = data || [];
  if (dayOfWeekParam !== null && dayOfWeekParam !== '') {
    const dow = Number(dayOfWeekParam);
    if (!Number.isNaN(dow) && dow >= 0 && dow <= 6) {
      rows = rows.filter((row: { scheduled_date: string }) => {
        const parts = row.scheduled_date?.split('-').map(Number);
        if (!parts || parts.length !== 3) return false;
        const [y, m, d] = parts;
        return new Date(y, m - 1, d).getDay() === dow;
      });
    }
  }

  return NextResponse.json(rows);
}

/**
 * Create a job. Requires company_id from profile, property_id, technician_id, scheduled_date.
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
      { error: 'User profile or company not found.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      property_id,
      technician_id,
      scheduled_date,
      scheduled_time,
      status,
      notes,
      estimated_duration_min,
      route_id,
      route_order,
      job_source: rawJobSource,
      visit_kind_id,
    } = body;

    if (!property_id || !scheduled_date) {
      return NextResponse.json(
        { error: 'property_id and scheduled_date are required' },
        { status: 400 }
      );
    }

    const jobSource =
      rawJobSource === 'route' ? 'route' : rawJobSource === 'ad_hoc' ? 'ad_hoc' : 'ad_hoc';

    const visitKindId: string | null =
      typeof visit_kind_id === 'string' && visit_kind_id.trim() ? visit_kind_id.trim() : null;
    if (visitKindId) {
      const { data: kindRow, error: kindErr } = await (supabase as unknown as CaicosSupabaseClient)
        .from('caicos_visit_reasons')
        .select('id')
        .eq('id', visitKindId)
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .maybeSingle();
      if (kindErr || !kindRow) {
        return NextResponse.json(
          { error: 'visit_kind_id must be an active reason in your company' },
          { status: 400 }
        );
      }
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped', 'cancelled'];
    const jobStatus = validStatuses.includes(status) ? status : 'pending';

    /** Route from pattern (caicos_route_stops) so ad-hoc jobs still link to the property's route for reporting. */
    const { data: stopRow, error: stopErr } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_route_stops')
      .select('route_id')
      .eq('property_id', property_id)
      .maybeSingle();

    if (stopErr) {
      console.error('Supabase error resolving route for property:', stopErr);
    }

    const routeFromStop =
      stopRow &&
      typeof (stopRow as { route_id: unknown }).route_id === 'string' &&
      (stopRow as { route_id: string }).route_id.trim() !== ''
        ? (stopRow as { route_id: string }).route_id
        : null;

    const routeIdResolved =
      routeFromStop ?? (typeof route_id === 'string' && route_id.trim() ? route_id.trim() : null);

    const row = {
      company_id: profile.company_id,
      property_id,
      technician_id: technician_id || null,
      scheduled_date: String(scheduled_date).slice(0, 10),
      scheduled_time: scheduled_time || null,
      status: jobStatus,
      notes: notes ? String(notes).trim() : null,
      estimated_duration_min: typeof estimated_duration_min === 'number' ? estimated_duration_min : 30,
      route_id: routeIdResolved,
      route_order: typeof route_order === 'number' ? route_order : null,
      job_source: jobSource,
      visit_kind_id: visitKindId,
    };

    const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_service_jobs')
      .insert(row)
      .select(
        'id, property_id, technician_id, route_id, scheduled_date, scheduled_time, status, job_source, visit_kind_id, created_at'
      )
      .single();

    if (error) {
      console.error('Supabase error creating job:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('POST /api/jobs error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
