/**
 * Tests for billing checkout quantity flow
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/supabase-server', () => ({
  createAuthenticatedRouteClient: jest.fn(),
}));

jest.mock('@/lib/billing/server', () => ({
  getAuthenticatedUserId: jest.fn(),
  getBillingService: jest.fn(),
  errorResponse: jest.fn((message, status) => 
    new Response(JSON.stringify({ error: message }), { status })
  ),
  successResponse: jest.fn((data) => 
    new Response(JSON.stringify(data), { status: 200 })
  ),
}));

describe('/api/billing/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('quantity validation', () => {
    it('should validate quantity is a number', async () => {
      const { getAuthenticatedUserId } = require('@/lib/billing/server');
      getAuthenticatedUserId.mockResolvedValue('user-123');

      const request = new NextRequest('http://localhost:3000/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'plan_pro_month', quantity: 'invalid' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('between 1 and 1000');
    });

    it('should reject quantity less than 1', async () => {
      const { getAuthenticatedUserId } = require('@/lib/billing/server');
      getAuthenticatedUserId.mockResolvedValue('user-123');

      const request = new NextRequest('http://localhost:3000/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'plan_pro_month', quantity: 0 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('between 1 and 1000');
    });

    it('should reject quantity greater than 1000', async () => {
      const { getAuthenticatedUserId } = require('@/lib/billing/server');
      getAuthenticatedUserId.mockResolvedValue('user-123');

      const request = new NextRequest('http://localhost:3000/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'plan_pro_month', quantity: 1001 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('between 1 and 1000');
    });

    it('should accept valid quantity', async () => {
      const { getAuthenticatedUserId, getBillingService } = require('@/lib/billing/server');
      const { createAuthenticatedRouteClient } = require('@/lib/supabase-server');

      getAuthenticatedUserId.mockResolvedValue('user-123');
      
      const mockBillingService = {
        getProviderName: jest.fn().mockReturnValue('stripe'),
        getPlan: jest.fn().mockResolvedValue({
          id: 'plan_pro_month',
          amountCents: 2499,
          providerPriceMap: { stripe: 'price_xxx' },
        }),
        getUserSubscription: jest.fn().mockResolvedValue(null),
        getOrCreateCustomer: jest.fn().mockResolvedValue({
          provider: 'stripe',
          providerCustomerId: 'cus_xxx',
        }),
      };
      
      getBillingService.mockResolvedValue(mockBillingService);

      createAuthenticatedRouteClient.mockResolvedValue({
        supabase: {},
        user: { email: 'test@example.com' },
      });

      const mockStripeAdapter = {
        createCheckoutSession: jest.fn().mockResolvedValue({
          sessionId: 'cs_xxx',
          url: 'https://checkout.stripe.com/xxx',
        }),
      };

      jest.mock('@/lib/billing/adapters', () => ({
        StripeAdapter: jest.fn().mockImplementation(() => mockStripeAdapter),
      }));

      const request = new NextRequest('http://localhost:3000/api/billing/checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-locale': 'en',
        },
        body: JSON.stringify({ planId: 'plan_pro_month', quantity: 5 }),
      });

      process.env.NEXT_PUBLIC_APP_URL = 'https://app.cadenzaops.com';

      const response = await POST(request);
      
      // Should pass validation and attempt to create checkout
      expect(response.status).not.toBe(400);
    });
  });

  describe('duplicate subscription prevention', () => {
    it('should prevent duplicate paid subscriptions', async () => {
      const { getAuthenticatedUserId, getBillingService } = require('@/lib/billing/server');
      const { createAuthenticatedRouteClient } = require('@/lib/supabase-server');

      getAuthenticatedUserId.mockResolvedValue('user-123');

      const mockBillingService = {
        getProviderName: jest.fn().mockReturnValue('stripe'),
        getPlan: jest.fn().mockResolvedValue({
          id: 'plan_pro_month',
          amountCents: 2499,
        }),
        getUserSubscription: jest.fn().mockResolvedValue({
          id: 'sub-123',
          planId: 'plan_necessary_month', // Existing paid subscription
          status: 'active',
        }),
      };

      getBillingService.mockResolvedValue(mockBillingService);

      createAuthenticatedRouteClient.mockResolvedValue({
        supabase: {},
        user: { email: 'test@example.com' },
      });

      const request = new NextRequest('http://localhost:3000/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'plan_pro_month', quantity: 5 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Active paid subscription already exists');
    });
  });
});
