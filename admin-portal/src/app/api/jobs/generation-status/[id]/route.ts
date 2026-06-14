import { NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await (supabase as unknown as CadenzaSupabaseClient)
    .from('cadenza_job_generation_runs')
    .select('id, route_id, scheduled_date, status, result, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Generation run not found' }, { status: 404 });
  }

  return NextResponse.json({
    generation_id: data.id,
    route_id: data.route_id,
    scheduled_date: data.scheduled_date,
    status: data.status,
    result: data.result,
    created_at: data.created_at,
    updated_at: data.updated_at,
  });
}
