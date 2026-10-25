/**
 * Billing Portal API
 * POST /api/billing/portal - Create Stripe Customer Portal session
 */

import { NextRequest } from 'next/server';
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

    const billingService = await getBillingService();
    const provider = billingService.getProviderName();

    if (provider !== 'stripe') {
      return errorResponse('Customer portal is only available for Stripe', 400);
    }

    // Get user details
    const { user } = await (await import('@/lib/supabase-server')).createAuthenticatedRouteClient();
    if (!user?.email) {
      return errorResponse('Unable to identify user', 401);
    }

    // Get or create Stripe customer
    const customer = await billingService.getOrCreateCustomer(
      userId,
      user.email,
      user.user_metadata?.full_name || user.email
    );

    // Create portal session via adapter
    const { StripeAdapter } = await import('@/lib/billing/adapters');
    const stripeAdapter = new StripeAdapter(process.env.STRIPE_SECRET_KEY!);

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
    const locale = request.headers.get('x-locale') || 'en';
    const returnUrl = `${origin}/${locale}/billing`;

    const portalSession = await stripeAdapter.createPortalSession({
      customer,
      returnUrl,
    });

    return successResponse({
      url: portalSession.url,
    });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to create portal session',
      500
    );
  }
}
