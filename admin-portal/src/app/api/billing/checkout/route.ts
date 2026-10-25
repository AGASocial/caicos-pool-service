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

    // Validate quantity server-side
    const parsedQuantity = parseInt(String(quantity), 10);
    if (isNaN(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 1000) {
      return errorResponse('Quantity must be between 1 and 1000', 400);
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

    // Prevent duplicate paid subscriptions
    const { supabase, user } = await (await import('@/lib/supabase-server')).createAuthenticatedRouteClient();
    if (!user?.email) {
      return errorResponse('Unable to identify user', 401);
    }

    const existingSub = await billingService.getUserSubscription(userId);
    if (existingSub && existingSub.planId !== 'plan_free') {
      return errorResponse('Active paid subscription already exists. Please manage your subscription from the billing page.', 400);
    }

    const customer = await billingService.getOrCreateCustomer(
      userId,
      user.email,
      user.user_metadata?.full_name || user.email
    );

    // Create checkout session via adapter
    const { StripeAdapter } = await import('@/lib/billing/adapters');
    const stripeAdapter = new StripeAdapter(process.env.STRIPE_SECRET_KEY!);

    // Build success/cancel URLs from NEXT_PUBLIC_APP_URL with allowlisted locale
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return errorResponse('Application URL not configured', 500);
    }
    
    // Allowlist locales to prevent open redirects
    const allowedLocales = ['en', 'es'];
    const requestedLocale = request.headers.get('x-locale') || 'en';
    const locale = allowedLocales.includes(requestedLocale) ? requestedLocale : 'en';

    const successUrl =
      mode === 'onboarding'
        ? `${appUrl}/${locale}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`
        : `${appUrl}/${locale}/billing?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      mode === 'onboarding'
        ? `${appUrl}/${locale}/onboarding`
        : `${appUrl}/${locale}/billing/plans`;

    // Map plan IDs to Stripe lookup keys
    // This allows dynamic price resolution without hardcoding Stripe price IDs
    const lookupKeyMap: Record<string, string> = {
      plan_necessary_month: 'cadenza_standard_monthly',
      plan_pro_month: 'cadenza_pro_monthly',
    };

    const checkoutSession = await stripeAdapter.createCheckoutSession({
      customer,
      plan,
      quantity: parsedQuantity,
      successUrl,
      cancelUrl,
      lookupKey: lookupKeyMap[planId], // Use lookup key if available
      metadata: {
        user_id: userId,
        plan_id: planId,
        quantity: String(parsedQuantity),
        mode,
      },
    });

    return successResponse({
      sessionId: checkoutSession.sessionId,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    // Don't leak raw Stripe errors to clients
    const message = error instanceof Error && !error.message.includes('Stripe')
      ? error.message
      : 'Failed to create checkout session. Please try again.';
    return errorResponse(message, 500);
  }
}
