import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { softDeleteByIdForUser } from '@/lib/soft-delete';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> },
) {
  const { id: jobId, actionId } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;

  const { data: action } = await client
    .from('cadenza_job_follow_up_actions')
    .select('id, job_id')
    .eq('id', actionId)
    .eq('job_id', jobId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (!action) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 });
  }

  const { error, count, forbidden } = await softDeleteByIdForUser(
    client,
    user.id,
    'cadenza_job_follow_up_actions',
    actionId,
    { job_id: jobId },
  );

  if (forbidden) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (error) {
    console.error('DELETE follow-up action error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
