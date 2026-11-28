import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import { OFFICE_ROLES } from '@/lib/open-issues-review';

/**
 * GET /api/open-issues/digest-status — when the Monday digest was last emailed for the caller's
 * company (KAN-154). Office only. Read through the caller's client, so RLS applies on top of the
 * explicit company filter. A missing send-log table reads as "never sent".
 */
export async function GET() {
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

  const { data, error } = await client
    .from('cadenza_monday_digest_sends')
    .select('sent_at')
    .eq('company_id', String(profile.company_id))
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Table not applied yet (or any read problem): the screen simply hides the cue.
    return NextResponse.json({ data: { last_sent_at: null } });
  }
  return NextResponse.json({ data: { last_sent_at: data?.sent_at ? String(data.sent_at) : null } });
}
