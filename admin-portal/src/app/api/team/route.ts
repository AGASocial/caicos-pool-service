import { NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

/**
 * List technicians (and admins/owners) for the current user's company.
 * Used for route assignment and job assignment.
 * Adds email_confirmed from auth (service role) so the team UI can show pending confirmation.
 */
export async function GET() {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_profiles')
    .select('id, full_name, role, is_active')
    // .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Supabase error fetching technicians:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profiles = data || [];
  const enriched = await Promise.all(
    profiles.map(async (row) => {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(row.id);
      if (authError || !authData?.user) {
        console.error('admin.getUserById failed for team member', row.id, authError?.message);
        return { ...row };
      }
      return {
        ...row,
        email_confirmed: authData.user.email_confirmed_at != null,
      };
    }),
  );

  return NextResponse.json(enriched);
}
