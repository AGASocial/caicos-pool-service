import { NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';

/** Composite endpoint for new job form (US-B-014). */
export async function GET() {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;

  const [propertiesRes, routesRes, reasonsRes, teamRes] = await Promise.all([
    client
      .from('cadenza_properties')
      .select('id, customer_name, address, cadenza_route_stops(route_id, cadenza_routes(id, name))')
      .eq('is_active', true)
      .order('customer_name', { ascending: true })
      .limit(51),
    client.from('cadenza_routes').select('id, name').order('name', { ascending: true }).limit(51),
    client.from('cadenza_visit_reasons').select('id, slug, label, sort_order').eq('is_active', true)
      .order('sort_order', { ascending: true }),
    client.from('cadenza_profiles').select('id, full_name, role, is_active').order('full_name', { ascending: true }),
  ]);

  if (propertiesRes.error) {
    return NextResponse.json({ error: propertiesRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    properties: propertiesRes.data ?? [],
    routes: routesRes.data ?? [],
    visitReasons: reasonsRes.data ?? [],
    team: teamRes.data ?? [],
  });
}
