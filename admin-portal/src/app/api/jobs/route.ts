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

  let query = (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_service_jobs')
    .select(`
      id,
      property_id,
      technician_id,
      scheduled_date,
      scheduled_time,
      status,
      route_order,
      notes,
      created_at,
      property:caicos_properties!property_id(id, customer_name, address),
      technician:caicos_profiles!technician_id(id, full_name)
    `)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true, nullsFirst: false });

  if (dateFrom) query = query.gte('scheduled_date', dateFrom);
  if (dateTo) query = query.lte('scheduled_date', dateTo);
  if (technicianId) query = query.eq('technician_id', technicianId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    console.error('Supabase error fetching jobs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
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
    } = body;

    if (!property_id || !scheduled_date) {
      return NextResponse.json(
        { error: 'property_id and scheduled_date are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped', 'cancelled'];
    const jobStatus = validStatuses.includes(status) ? status : 'pending';

    const row = {
      company_id: profile.company_id,
      property_id,
      technician_id: technician_id || null,
      scheduled_date: String(scheduled_date).slice(0, 10),
      scheduled_time: scheduled_time || null,
      status: jobStatus,
      notes: notes ? String(notes).trim() : null,
      estimated_duration_min: typeof estimated_duration_min === 'number' ? estimated_duration_min : 30,
      route_id: route_id || null,
      route_order: typeof route_order === 'number' ? route_order : null,
    };

    const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_service_jobs')
      .insert(row)
      .select('id, property_id, technician_id, scheduled_date, scheduled_time, status, created_at')
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
