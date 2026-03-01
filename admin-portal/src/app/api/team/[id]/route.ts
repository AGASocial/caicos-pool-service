import { NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/team/[id] — Set is_active for a team member.
 * Body: { is_active: boolean }
 * Caller must be same company; only admin/owner can change others.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: targetId } = await context.params;
  if (!targetId) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
  }

  let body: { is_active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: 'Body must include is_active (boolean)' }, { status: 400 });
  }

  const client = supabase as unknown as CaicosSupabaseClient;

  // Current user's profile (company + role)
  const { data: callerProfile, error: callerError } = await client
    .from('caicos_profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  if (callerError || !callerProfile?.company_id) {
    return NextResponse.json({ error: 'Your profile could not be loaded.' }, { status: 403 });
  }

  // Target must be in same company
  const { data: targetProfile, error: targetError } = await client
    .from('caicos_profiles')
    .select('id, company_id')
    .eq('id', targetId)
    .single();

  if (targetError || !targetProfile) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  if (targetProfile.company_id !== callerProfile.company_id) {
    return NextResponse.json({ error: 'You can only update team members in your company.' }, { status: 403 });
  }

  // Only admin or owner can change another user's is_active (users can update their own via profile)
  const isSelf = targetId === user.id;
  const role = (callerProfile.role as string)?.toLowerCase();
  const canUpdateOthers = role === 'admin' || role === 'owner';
  if (!isSelf && !canUpdateOthers) {
    return NextResponse.json({ error: 'Only admins can activate or deactivate other team members.' }, { status: 403 });
  }

  const { error: updateError } = await (supabaseAdmin as unknown as CaicosSupabaseClient)
    .from('caicos_profiles')
    .update({ is_active: body.is_active })
    .eq('id', targetId);

  if (updateError) {
    console.error('Team member is_active update error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, is_active: body.is_active });
}
