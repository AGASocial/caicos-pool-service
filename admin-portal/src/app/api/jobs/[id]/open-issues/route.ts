import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import { fetchCarryForwardIssues, OpenIssuesSchemaPendingError } from '@/lib/open-issues';
import { OFFICE_ROLES } from '@/lib/open-issues-review';

/**
 * GET /api/jobs/[id]/open-issues — open issues to carry onto this job: same property, recorded
 * on a different job. Available to office roles and to the technician assigned to the job.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as SupabaseClient;
  const { data: profile } = await client
    .from('cadenza_profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const companyId = String(profile.company_id);

  const { data: job } = await client
    .from('cadenza_service_jobs')
    .select('id, company_id, property_id, technician_id, is_deleted')
    .eq('id', jobId)
    .maybeSingle();

  if (!job || job.is_deleted === true || String(job.company_id) !== companyId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const isOffice = OFFICE_ROLES.has(String(profile.role));
  if (!isOffice && String(job.technician_id ?? '') !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const issues = await fetchCarryForwardIssues(client, companyId, {
      id: String(job.id),
      property_id: job.property_id != null ? String(job.property_id) : null,
    });
    return NextResponse.json({ data: issues });
  } catch (error) {
    if (error instanceof OpenIssuesSchemaPendingError) {
      return NextResponse.json({ error: error.message, code: 'SCHEMA_PENDING' }, { status: 503 });
    }
    console.error('GET /api/jobs/[id]/open-issues failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to load open issues' }, { status: 500 });
  }
}
