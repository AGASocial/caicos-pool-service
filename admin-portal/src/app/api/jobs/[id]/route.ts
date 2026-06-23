import { NextRequest, NextResponse } from 'next/server';
import { softDeleteByIdForUser } from '@/lib/soft-delete';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import {
  REPORT_WITH_PHOTOS_SELECT,
  attachSignedPhotoUrls,
  extractReportPhotos,
  mapReportRow,
} from '@/lib/service-report';
import { jobMatchesTechnicianScope, resolveTechnicianScope } from '@/lib/technician-scope';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;

  const { data, error } = await client
    .from('cadenza_service_jobs')
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
      job_source,
      visit_kind_id,
      created_at,
      updated_at,
      property:cadenza_properties!property_id(id, customer_name, address, customer_phone, city),
      technician:cadenza_profiles!technician_id(id, full_name),
      route:cadenza_routes!route_id(id, name),
      visit_kind:cadenza_visit_reasons!visit_kind_id(id, slug, label)
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error?.message || 'Not found' }, { status: 500 });
  }

  const { data: profile } = await client
    .from('cadenza_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const technicianScope = profile
    ? await resolveTechnicianScope(client, user.id, profile.role as string)
    : null;

  if (
    technicianScope &&
    !jobMatchesTechnicianScope(
      data as { technician_id?: string | null; route_id?: string | null },
      user.id,
      technicianScope,
    )
  ) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { data: reportRow } = await client
    .from('cadenza_service_reports')
    .select(REPORT_WITH_PHOTOS_SELECT)
    .eq('job_id', id)
    .order('created_at', { ascending: false })
    .order('created_at', { foreignTable: 'cadenza_report_photos', ascending: false })
    .limit(1)
    .maybeSingle();

  if (!reportRow) {
    return NextResponse.json({
      ...data,
      service_report: null,
      report_photos: [],
    });
  }

  const row = reportRow as Record<string, unknown>;
  const { report_photos: rawPhotos, ...reportFields } = row;
  const service_report = mapReportRow(reportFields);
  const report_photos = await attachSignedPhotoUrls(supabase, extractReportPhotos(rawPhotos));

  return NextResponse.json({
    ...data,
    service_report,
    report_photos,
  });
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

  const client = supabase as unknown as CadenzaSupabaseClient;

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
    if (body.route_id !== undefined) updates.route_id = body.route_id || null;
    if (body.job_source !== undefined) {
      if (body.job_source !== 'route' && body.job_source !== 'ad_hoc') {
        return NextResponse.json({ error: 'job_source must be route or ad_hoc' }, { status: 400 });
      }
      updates.job_source = body.job_source;
    }
    if (body.visit_kind_id !== undefined) {
      if (body.visit_kind_id === null || body.visit_kind_id === '') {
        updates.visit_kind_id = null;
      } else {
        const { data: profile } = await client
          .from('cadenza_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();
        const companyId = profile?.company_id as string | undefined;
        if (!companyId) {
          return NextResponse.json({ error: 'Company not found' }, { status: 403 });
        }
        const { data: kindRow, error: kindErr } = await client
          .from('cadenza_visit_reasons')
          .select('id')
          .eq('id', body.visit_kind_id)
          .eq('company_id', companyId)
          .eq('is_active', true)
          .maybeSingle();
        if (kindErr || !kindRow) {
          return NextResponse.json(
            { error: 'visit_kind_id must be an active reason in your company' },
            { status: 400 }
          );
        }
        updates.visit_kind_id = body.visit_kind_id;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await client
      .from('cadenza_service_jobs')
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

  const client = supabase as unknown as CadenzaSupabaseClient;

  const { error, count, forbidden } = await softDeleteByIdForUser(
    client,
    user.id,
    'cadenza_service_jobs',
    id
  );

  if (forbidden) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (error) {
    console.error('Supabase error soft-deleting job:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
