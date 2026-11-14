/**
 * POST /api/billing/subscriptions/free
 * Idempotently create an active Free subscription for the authenticated user
 * (onboarding / "start with Free").
 */

import {
  getBillingService,
  getAuthenticatedUserId,
  errorResponse,
  successResponse,
} from '@/lib/billing/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { data: profile } = await supabaseAdmin
      .from('cadenza_profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.role !== 'owner') {
      return errorResponse('Only company owners can start the Free plan', 403);
    }

    const billingService = await getBillingService();
    const subscription = await billingService.ensureFreeSubscription(userId);

    return successResponse({ subscription }, 200);
  } catch (error) {
    console.error('Error ensuring free subscription:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to start Free plan',
      500,
    );
  }
}
