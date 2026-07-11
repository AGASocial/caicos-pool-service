/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('@/lib/supabase-server', () => ({
  createRouteClient: jest.fn(),
}));
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterSec: 0 }),
  rateLimitResponse: jest.fn(
    (retryAfterSec: number) =>
      new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSec) },
      })
  ),
  RATE_LIMITS: { auth: { limit: 20, windowMs: 60_000 } },
}));

import { createRouteClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit } from '@/lib/rate-limit';

const mockCreateRouteClient = createRouteClient as jest.Mock;
const mockCheckRateLimit = checkRateLimit as jest.Mock;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost' },
  });
}

describe('POST /api/auth/register', () => {
  const mockSignUp = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSec: 0 });
    mockSignUp.mockResolvedValue({ error: null });
    mockCreateRouteClient.mockResolvedValue({
      auth: { signUp: mockSignUp },
    });
  });

  it('returns 400 when neither companyName nor invite is provided', async () => {
    const req = makeRequest({ email: 'a@b.com', password: 'password123' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/company name|invite code/i);
  });

  it('creates a new company when companyName is provided', async () => {
    const req = makeRequest({
      email: 'owner@example.com',
      password: 'password123',
      fullName: 'Jane Owner',
      companyName: '  Acme Pool Services  ',
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'owner@example.com',
        password: 'password123',
        options: expect.objectContaining({
          data: expect.objectContaining({
            company_name: 'Acme Pool Services',
          }),
        }),
      })
    );
  });

  it('does not set company_name metadata when joining via invite code', async () => {
    const mockSingle = jest.fn().mockResolvedValue({
      data: { company_id: '11111111-1111-1111-1111-111111111111', role: 'technician' },
      error: null,
    });
    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }),
    });

    const req = makeRequest({
      email: 'tech@example.com',
      password: 'password123',
      invite: 'ABC123',
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({
            company_id: '11111111-1111-1111-1111-111111111111',
            role: 'technician',
          }),
        }),
      })
    );
    const callArgs = mockSignUp.mock.calls[0][0];
    expect(callArgs.options.data.company_name).toBeUndefined();
  });

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSec: 42 });

    const req = makeRequest({ email: 'a@b.com', password: 'password123', companyName: 'Acme' });
    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(mockCreateRouteClient).not.toHaveBeenCalled();
  });
});
