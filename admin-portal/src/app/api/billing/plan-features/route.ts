import { NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { getBillingService } from '@/lib/billing/server';

/**
 * GET /api/billing/plan-features
 * Returns current user's plan features (for feature gating)
 */
export async function GET() {
  const { supabase, user } = await createAuthenticatedRouteClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;
  const { data: profile } = await client
    .from('cadenza_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  try {
    const billingService = await getBillingService();
    const subscription = await billingService.getUserSubscription(user.id);

    let planId = 'plan_free';
    if (subscription && subscription.status === 'active') {
      planId = subscription.planId;
    }

    const plan = await billingService.getPlan(planId);
    const features = plan.features as Record<string, unknown>;

    return NextResponse.json({
      planId,
      features: {
        ...features,
        live_status_board: getLiveStatusBoardAccess(planId, features),
      },
    });
  } catch (error) {
    console.error('Failed to fetch plan features:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plan features' },
      { status: 500 }
    );
  }
}

/**
 * Determine live_status_board access based on plan and features
 * Default: true for Standard/Pro, false for Free (unless explicitly set in features)
 */
function getLiveStatusBoardAccess(planId: string, features: Record<string, unknown>): boolean {
  if ('live_status_board' in features) {
    return features.live_status_board as boolean;
  }

  if (planId === 'plan_free') {
    return false;
  }

  if (planId === 'plan_necessary_month' || planId === 'plan_pro_month') {
    return true;
  }

  return true;
}
