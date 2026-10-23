/**
 * Billing Checkout API
 * POST /api/billing/checkout - Create Stripe Checkout session
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBillingService,
  getAuthenticatedUserId,
  errorResponse,
  successResponse,
} from '@/lib/billing/server';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { planId, quantity = 1, mode = 'upgrade' } = body;

    if (!planId) {
      return errorResponse('Plan ID is required', 400);
    }

    const billingService = await getBillingService();
    const provider = billingService.getProviderName();

    if (provider !== 'stripe') {
      return errorResponse('Checkout is only available for Stripe', 400);
    }

    // Get plan details
    const plan = await billingService.getPlan(planId);

    // Free plan doesn't need checkout
    if (plan.amountCents === 0) {
      return errorResponse('Free plan does not require checkout', 400);
    }

    // Get or create Stripe customer
    const { supabase, user } = await (await import('@/lib/supabase-server')).createAuthenticatedRouteClient();
    if (!user?.email) {
      return errorResponse('Unable to identify user', 401);
    }

    const customer = await billingService.getOrCreateCustomer(
      userId,
      user.email,
      user.user_metadata?.full_name || user.email
    );

    // Create checkout session via adapter
    const { StripeAdapter } = await import('@/lib/billing/adapters');
    const stripeAdapter = new StripeAdapter(process.env.STRIPE_SECRET_KEY!);

    // Build success/cancel URLs based on mode
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
    const locale = request.headers.get('x-locale') || 'en';

    const successUrl =
      mode === 'onboarding'
        ? `${origin}/${locale}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`
        : `${origin}/${locale}/billing?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      mode === 'onboarding'
        ? `${origin}/${locale}/onboarding`
        : `${origin}/${locale}/billing/plans`;

    const checkoutSession = await stripeAdapter.createCheckoutSession({
      customer,
      plan,
      successUrl,
      cancelUrl,
      metadata: {
        user_id: userId,
        plan_id: planId,
        quantity: String(quantity),
        mode,
      },
    });

    return successResponse({
      sessionId: checkoutSession.sessionId,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to create checkout session',
      500
    );
  }
}
