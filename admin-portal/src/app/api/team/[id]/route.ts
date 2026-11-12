import { NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { entitlementError, hasEntitlement } from '@/lib/entitlements';
import {
  activateTechnician,
  scheduleTechnicianDeactivation,
} from '@/lib/seat-management';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/team/[id] — Set is_active for a team member.
 * Body: { is_active: boolean }
 * Caller must be same company; only admin/owner can change others.
 *
 * Paid per-seat: deactivation is scheduled until current_period_end (tech stays
 * active); activation may auto-increase Stripe quantity with proration.
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

  const client = supabase as unknown as CadenzaSupabaseClient;
  const adminClient = supabaseAdmin as unknown as CadenzaSupabaseClient;

  // Current user's profile (company + role)
  const { data: callerProfile, error: callerError } = await client
    .from('cadenza_profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  if (callerError || !callerProfile?.company_id) {
    return NextResponse.json({ error: 'Your profile could not be loaded.' }, { status: 403 });
  }

  const callerRole = callerProfile.role as string | undefined;

  // Target must be in same company
  const { data: targetProfile, error: targetError } = await client
    .from('cadenza_profiles')
    .select('id, company_id, role')
    .eq('id', targetId)
    .single();

  if (targetError || !targetProfile) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  if (targetProfile.company_id !== callerProfile.company_id) {
    return NextResponse.json({ error: 'You can only update team members in your company.' }, { status: 403 });
  }

  const isSelf = targetId === user.id;
  if (!isSelf && !hasEntitlement(callerRole, 'team', 'edit')) {
    return NextResponse.json(entitlementError('team', 'edit'), { status: 403 });
  }

  // Seat sync + deferred deactivation use service role for column updates
  if (body.is_active) {
    const result = await activateTechnician(adminClient as never, user.id, targetId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? 'Failed to activate team member', code: 'ACTIVATE_FAILED' },
        { status: 403 }
      );
    }
    return NextResponse.json({
      ok: true,
      is_active: true,
      scheduled_deactivation_at: null,
      seatAdded: result.seatAdded ?? false,
      notice: result.notice,
    });
  }

  const result = await scheduleTechnicianDeactivation(adminClient as never, user.id, targetId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? 'Failed to deactivate team member' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    is_active: result.is_active,
    pending: result.pending ?? false,
    scheduled_deactivation_at: result.scheduled_deactivation_at ?? null,
    quantity: result.quantity,
  });
}
