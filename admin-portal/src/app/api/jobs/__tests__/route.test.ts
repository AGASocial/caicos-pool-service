/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

jest.mock('@/lib/supabase-server', () => ({
  createAuthenticatedRouteClient: jest.fn(),
}));

import { createAuthenticatedRouteClient } from '@/lib/supabase-server';

const mockCreateClient = createAuthenticatedRouteClient as jest.Mock;

function makeRequest(url: string, body?: unknown): NextRequest {
  if (body !== undefined) {
    return new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new NextRequest(url);
}

describe('GET /api/jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is null', async () => {
    mockCreateClient.mockResolvedValue({ supabase: {}, user: null });

    const req = makeRequest('http://localhost/api/jobs');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns jobs array when authenticated', async () => {
    const mockJobs = [
      { id: 'job-1', property_id: 'prop-1', status: 'pending', scheduled_date: '2026-03-10' },
      { id: 'job-2', property_id: 'prop-2', status: 'completed', scheduled_date: '2026-03-11' },
    ];

    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    // The route awaits the query directly — make the chain thenable
    (mockQuery as unknown as Promise<unknown>)[Symbol.toPrimitive] = undefined;
    Object.assign(mockQuery, {
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: mockJobs, error: null }).then(resolve),
    });

    const mockSupabase = { from: jest.fn().mockReturnValue(mockQuery) };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const req = makeRequest('http://localhost/api/jobs');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe('job-1');
  });

  it('applies date_from filter when provided', async () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };

    const mockSupabase = { from: jest.fn().mockReturnValue(mockQuery) };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const req = makeRequest('http://localhost/api/jobs?date_from=2026-03-01');
    await GET(req);

    expect(mockQuery.gte).toHaveBeenCalledWith('scheduled_date', '2026-03-01');
  });

  it('applies status filter when provided', async () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };

    const mockSupabase = { from: jest.fn().mockReturnValue(mockQuery) };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const req = makeRequest('http://localhost/api/jobs?status=completed');
    await GET(req);

    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'completed');
  });
});

describe('POST /api/jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is null', async () => {
    mockCreateClient.mockResolvedValue({ supabase: {}, user: null });

    const req = makeRequest('http://localhost/api/jobs', { property_id: 'prop-1', scheduled_date: '2026-03-10' });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when property_id missing', async () => {
    const mockProfileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { company_id: 'company-1' }, error: null }),
    };
    const mockSupabase = { from: jest.fn().mockReturnValue(mockProfileQuery) };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const req = makeRequest('http://localhost/api/jobs', { scheduled_date: '2026-03-10' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('property_id');
  });

  it('returns 400 when scheduled_date missing', async () => {
    const mockProfileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { company_id: 'company-1' }, error: null }),
    };
    const mockSupabase = { from: jest.fn().mockReturnValue(mockProfileQuery) };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const req = makeRequest('http://localhost/api/jobs', { property_id: 'prop-1' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('scheduled_date');
  });

  it('creates job successfully with valid data', async () => {
    const mockJob = {
      id: 'job-new',
      property_id: 'prop-1',
      technician_id: null,
      scheduled_date: '2026-03-10',
      scheduled_time: null,
      status: 'pending',
      created_at: '2026-03-10T00:00:00Z',
    };

    const mockInsertQuery = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockJob, error: null }),
    };

    const mockProfileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { company_id: 'company-1' }, error: null }),
    };

    const mockSupabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(mockProfileQuery)
        .mockReturnValueOnce(mockInsertQuery),
    };

    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const req = makeRequest('http://localhost/api/jobs', {
      property_id: 'prop-1',
      scheduled_date: '2026-03-10',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('job-new');
    expect(body.status).toBe('pending');
  });
});
