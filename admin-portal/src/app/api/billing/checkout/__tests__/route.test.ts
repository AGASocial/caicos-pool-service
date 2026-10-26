/**
 * Tests for billing checkout quantity flow
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/billing/server';

// Mock dependencies
jest.mock('@/lib/supabase-server', () => ({
  createAuthenticatedRouteClient: jest.fn(),
}));

jest.mock('@/lib/billing/server', () => ({
  getAuthenticatedUserId: jest.fn(),
  getBillingService: jest.fn(),
  errorResponse: jest.fn((message: string, status: number) => ({
    json: jest.fn().mockResolvedValue({ error: message }),
    status,
  })),
  successResponse: jest.fn((data: unknown) => ({
    json: jest.fn().mockResolvedValue(data),
    status: 200,
  })),
}));

const mockGetAuthenticatedUserId = getAuthenticatedUserId as jest.MockedFunction<typeof getAuthenticatedUserId>;

describe('/api/billing/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('quantity validation', () => {
    it('should validate quantity is present and numeric', async () => {
      mockGetAuthenticatedUserId.mockResolvedValue('user-123');

      const mockRequest = {
        json: jest.fn().mockResolvedValue({ planId: 'plan_pro_month', quantity: 'invalid' }),
        headers: {
          get: jest.fn(() => 'en'),
        },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('between 1 and 1000');
    });
  });
});
