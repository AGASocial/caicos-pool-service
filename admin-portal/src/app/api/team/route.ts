import { NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';

/**
 * List technicians (and admins/owners) for the current user's company.
 * Used for route assignment and job assignment.
 * email_confirmed is read from denormalized cadenza_profiles.email_confirmed_at (US-B-005).
 */
export async function GET() {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await (supabase as unknown as CadenzaSupabaseClient)
    .from('cadenza_profiles')
    .select('id, full_name, role, is_active, email_confirmed_at')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Supabase error fetching technicians:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = (data ?? []).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    email_confirmed: row.email_confirmed_at != null,
  }));

  return NextResponse.json(enriched);
}
