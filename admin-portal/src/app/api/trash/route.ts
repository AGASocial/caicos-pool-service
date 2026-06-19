import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';

const TRASH_ROLES = new Set(['owner', 'admin', 'operations']);

export async function GET() {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;
  const { data: profile, error: profileError } = await client
    .from('cadenza_profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  const companyId = profile && typeof profile.company_id === 'string' ? profile.company_id : null;
  const role = profile && typeof profile.role === 'string' ? profile.role : null;

  if (profileError || !companyId || !role || !TRASH_ROLES.has(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  const [jobsResult, routesResult, photosResult] = await Promise.all([
    admin
      .from('cadenza_service_jobs')
      .select(
        'id, scheduled_date, status, updated_at, property:cadenza_properties(customer_name, address)'
      )
      .eq('company_id', companyId)
      .eq('is_deleted', true)
      .order('updated_at', { ascending: false })
      .limit(50),
    admin
      .from('cadenza_routes')
      .select('id, name, updated_at')
      .eq('company_id', companyId)
      .eq('is_deleted', true)
      .order('updated_at', { ascending: false })
      .limit(50),
    admin
      .from('cadenza_report_photos')
      .select('id, photo_type, caption, created_at')
      .eq('company_id', companyId)
      .eq('is_deleted', true)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (jobsResult.error || routesResult.error || photosResult.error) {
    console.error('Trash API errors:', jobsResult.error, routesResult.error, photosResult.error);
    return NextResponse.json({ error: 'Failed to load trash' }, { status: 500 });
  }

  return NextResponse.json({
    jobs: jobsResult.data ?? [],
    routes: routesResult.data ?? [],
    photos: photosResult.data ?? [],
  });
}
