/**
 * Tests for billing checkout quantity flow
 */

import { POST } from '../route';

// Mock Next.js Request - must be done before other imports
global.Request = class Request {
  constructor(public url: string, public init?: any) {}
  headers = {
    get: jest.fn(),
  };
  json = jest.fn();
} as any;

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
    it('should validate quantity is present and numeric', async () => {
      const { getAuthenticatedUserId } = require('@/lib/billing/server');
      getAuthenticatedUserId.mockResolvedValue('user-123');

      const mockRequest = {
        json: jest.fn().mockResolvedValue({ planId: 'plan_pro_month', quantity: 'invalid' }),
        headers: {
          get: jest.fn(() => 'en'),
        },
      };

      const response = await POST(mockRequest as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('between 1 and 1000');
    });
  });
});
