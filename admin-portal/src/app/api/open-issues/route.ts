import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import { filterByMinDays, parseMinDays } from '@/lib/follow-up-jobs';
import { fetchOpenIssues, OpenIssuesSchemaPendingError } from '@/lib/open-issues';
import { OFFICE_ROLES } from '@/lib/open-issues-review';

/**
 * GET /api/open-issues — office queue of open issues (open follow-up reports plus unresolved
 * problem voice notes) for the caller's company, oldest first, with `days_open`.
 * Query: min_days (optional; keeps issues at least that many days old), job_id (optional; only
 * issues recorded on that job).
 */
export async function GET(request: NextRequest) {
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

  if (!profile?.company_id || !OFFICE_ROLES.has(String(profile.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const minDays = parseMinDays(searchParams.get('min_days'));
  const jobIdFilter = searchParams.get('job_id');

  try {
    const companyId = String(profile.company_id);
    const all = await fetchOpenIssues(client, companyId);
    const issues = filterByMinDays(
      jobIdFilter ? all.filter((issue) => issue.job_id === jobIdFilter) : all,
      minDays,
    );

    const propertyIds = [...new Set(issues.map((i) => i.property_id).filter((id): id is string => !!id))];
    const properties = new Map<string, { id: string; customer_name: string; address: string }>();
    if (propertyIds.length > 0) {
      const { data: rows } = await client
        .from('cadenza_properties')
        .select('id, customer_name, address')
        .eq('company_id', companyId)
        .in('id', propertyIds);
      for (const row of rows ?? []) {
        properties.set(String(row.id), {
          id: String(row.id),
          customer_name: String(row.customer_name),
          address: String(row.address ?? ''),
        });
      }
    }

    return NextResponse.json({
      data: issues.map((issue) => ({
        ...issue,
        property: issue.property_id ? (properties.get(issue.property_id) ?? null) : null,
      })),
    });
  } catch (error) {
    if (error instanceof OpenIssuesSchemaPendingError) {
      return NextResponse.json({ error: error.message, code: 'SCHEMA_PENDING' }, { status: 503 });
    }
    console.error('GET /api/open-issues failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to load open issues' }, { status: 500 });
  }
}
