import { NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

/**
 * List technicians (and admins/owners) for the current user's company.
 * Used for route assignment and job assignment.
 */
export async function GET() {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_profiles')
    .select('id, full_name, role, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Supabase error fetching technicians:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
