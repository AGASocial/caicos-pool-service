import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import { parseReviewBody, reviewOpenIssue } from '@/lib/open-issues-review';

/**
 * POST /api/open-issues/review — body { source, id, review_job_id, resolved, note? }.
 * Records "Resolved? Yes/No" for a carry-forward issue through the review_open_issue RPC.
 * Office roles, or the technician assigned to the review job.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseReviewBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
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

  const result = await reviewOpenIssue(
    client,
    { userId: user.id, role: String(profile.role), companyId: String(profile.company_id) },
    parsed.input,
  );
  return NextResponse.json(result.body, { status: result.status });
}
