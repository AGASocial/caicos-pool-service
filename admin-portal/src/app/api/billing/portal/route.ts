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

    const { resolveAppUrl } = await import('@/lib/app-url');
    let appUrl: string;
    try {
      appUrl = resolveAppUrl({
        headers: request.headers,
        requestOrigin: request.headers.get('origin'),
      });
    } catch {
      return errorResponse('Application URL not configured', 500);
    }

    const allowedLocales = ['en', 'es'];
    const requestedLocale = request.headers.get('x-locale') || 'en';
    const locale = allowedLocales.includes(requestedLocale) ? requestedLocale : 'en';
    const returnUrl = `${appUrl}/${locale}/billing`;

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
