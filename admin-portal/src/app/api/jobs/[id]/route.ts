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

  const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
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
      estimated_duration_min,
      notes,
      created_at,
      updated_at,
      property:caicos_properties!property_id(id, customer_name, address, customer_phone, city),
      technician:caicos_profiles!technician_id(id, full_name)
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error?.message || 'Not found' }, { status: 500 });
  }

  return NextResponse.json(data);
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
    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped', 'cancelled'];
    const updates: Record<string, unknown> = {};

    if (body.property_id !== undefined) updates.property_id = body.property_id;
    if (body.technician_id !== undefined) updates.technician_id = body.technician_id;
    if (body.scheduled_date !== undefined) updates.scheduled_date = String(body.scheduled_date).slice(0, 10);
    if (body.scheduled_time !== undefined) updates.scheduled_time = body.scheduled_time;
    if (body.status !== undefined && validStatuses.includes(body.status)) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : null;
    if (body.estimated_duration_min !== undefined) updates.estimated_duration_min = Number(body.estimated_duration_min);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_service_jobs')
      .update(updates)
      .eq('id', id)
      .select('id, property_id, technician_id, scheduled_date, scheduled_time, status, updated_at')
      .single();

    if (error) {
      console.error('Supabase error updating job:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('PATCH /api/jobs/[id] error:', e);
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

  const { error, count } = await (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_service_jobs')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) {
    console.error('Supabase error deleting job:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
