import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { isFollowUpActionType } from '@/lib/follow-up-jobs';

const OFFICE_ROLES = new Set(['owner', 'admin', 'operations']);

const ACTION_SELECT = `
  id,
  job_id,
  report_id,
  author_id,
  action_type,
  body,
  metadata,
  created_at,
  author:cadenza_profiles!author_id(id, full_name)
`;

type Relation<T> = T | T[] | null | undefined;

function firstRelation<T>(value: Relation<T>): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapActionRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    job_id: String(row.job_id),
    report_id: row.report_id != null ? String(row.report_id) : null,
    author_id: String(row.author_id),
    action_type: String(row.action_type),
    body: row.body != null ? String(row.body) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    author: firstRelation(row.author as Relation<{ id: string; full_name: string }>),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;

  const { data, error } = await client
    .from('cadenza_job_follow_up_actions')
    .select(ACTION_SELECT)
    .eq('job_id', jobId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('GET follow-up actions error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map((row) => mapActionRow(row as Record<string, unknown>)));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;

  const { data: profile } = await client
    .from('cadenza_profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.company_id || !OFFICE_ROLES.has(String(profile.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { action_type?: string; body?: string; metadata?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const actionType = body.action_type?.trim();
  if (!actionType || !isFollowUpActionType(actionType)) {
    return NextResponse.json(
      { error: 'action_type must be note, email_sent, resolved, or call' },
      { status: 400 },
    );
  }

  const noteBody = body.body != null ? String(body.body).trim() : '';
  if (actionType === 'note' && !noteBody) {
    return NextResponse.json({ error: 'body is required for notes' }, { status: 400 });
  }

  const { data: job } = await client
    .from('cadenza_service_jobs')
    .select('id, company_id')
    .eq('id', jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { data: report } = await client
    .from('cadenza_service_reports')
    .select('id')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = {
    company_id: profile.company_id,
    job_id: jobId,
    report_id: report?.id ?? null,
    author_id: user.id,
    action_type: actionType,
    body: noteBody || null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  };

  const { data: inserted, error: insertErr } = await client
    .from('cadenza_job_follow_up_actions')
    .insert(row)
    .select(ACTION_SELECT)
    .single();

  if (insertErr) {
    console.error('POST follow-up action error:', insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  if (actionType === 'resolved' && report?.id) {
    const { error: resolveErr } = await client
      .from('cadenza_service_reports')
      .update({ follow_up_status: 'resolved', updated_at: new Date().toISOString() })
      .eq('id', report.id);

    if (resolveErr) {
      console.error('Failed to mark report resolved:', resolveErr);
    }
  }

  return NextResponse.json(mapActionRow(inserted as Record<string, unknown>), { status: 201 });
}
