/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, PATCH, DELETE } from '../route';

jest.mock('@/lib/supabase-server', () => ({
  createAuthenticatedRouteClient: jest.fn(),
}));

import { createAuthenticatedRouteClient } from '@/lib/supabase-server';

const mockCreateClient = createAuthenticatedRouteClient as jest.Mock;

const TEST_ID = 'test-job-id';
const routeParams = { params: Promise.resolve({ id: TEST_ID }) };

function makeRequest(url: string, method = 'GET', body?: unknown): NextRequest {
  if (body !== undefined) {
    return new NextRequest(url, {
      method,
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new NextRequest(url, { method });
}

describe('GET /api/jobs/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue({ supabase: {}, user: null });

    const req = makeRequest(`http://localhost/api/jobs/${TEST_ID}`);
    const res = await GET(req, routeParams);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when not found (error code PGRST116)', async () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Row not found' },
      }),
    };
    const mockSupabase = { from: jest.fn().mockReturnValue(mockQuery) };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const req = makeRequest(`http://localhost/api/jobs/${TEST_ID}`);
    const res = await GET(req, routeParams);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Job not found');
  });

  it('returns job data when found', async () => {
    const mockJob = {
      id: TEST_ID,
      property_id: 'prop-1',
      technician_id: 'tech-1',
      scheduled_date: '2026-03-10',
      status: 'pending',
    };

    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockJob, error: null }),
    };
    const mockSupabase = { from: jest.fn().mockReturnValue(mockQuery) };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const req = makeRequest(`http://localhost/api/jobs/${TEST_ID}`);
    const res = await GET(req, routeParams);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(TEST_ID);
    expect(body.status).toBe('pending');
  });
});

describe('PATCH /api/jobs/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue({ supabase: {}, user: null });

    const req = makeRequest(`http://localhost/api/jobs/${TEST_ID}`, 'PATCH', { status: 'completed' });
    const res = await PATCH(req, routeParams);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when no valid fields provided', async () => {
    const mockSupabase = { from: jest.fn() };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    // Send a body with no recognized updatable fields
    const req = makeRequest(`http://localhost/api/jobs/${TEST_ID}`, 'PATCH', { unknown_field: 'value' });
    const res = await PATCH(req, routeParams);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('No valid fields');
  });

  it('updates job successfully', async () => {
    const mockUpdatedJob = {
      id: TEST_ID,
      property_id: 'prop-1',
      technician_id: 'tech-1',
      scheduled_date: '2026-03-10',
      scheduled_time: null,
      status: 'completed',
      updated_at: '2026-03-10T12:00:00Z',
    };

    const mockQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockUpdatedJob, error: null }),
    };
    const mockSupabase = { from: jest.fn().mockReturnValue(mockQuery) };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const req = makeRequest(`http://localhost/api/jobs/${TEST_ID}`, 'PATCH', { status: 'completed' });
    const res = await PATCH(req, routeParams);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(TEST_ID);
    expect(body.status).toBe('completed');
  });
});

describe('DELETE /api/jobs/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue({ supabase: {}, user: null });

    const req = makeRequest(`http://localhost/api/jobs/${TEST_ID}`, 'DELETE');
    const res = await DELETE(req, routeParams);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 204 on successful delete', async () => {
    const mockQuery = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null, count: 1 }),
    };
    const mockSupabase = { from: jest.fn().mockReturnValue(mockQuery) };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const req = makeRequest(`http://localhost/api/jobs/${TEST_ID}`, 'DELETE');
    const res = await DELETE(req, routeParams);

    expect(res.status).toBe(204);
  });

  it('returns 404 when job not found (count 0)', async () => {
    const mockQuery = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null, count: 0 }),
    };
    const mockSupabase = { from: jest.fn().mockReturnValue(mockQuery) };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const req = makeRequest(`http://localhost/api/jobs/${TEST_ID}`, 'DELETE');
    const res = await DELETE(req, routeParams);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Job not found');
  });
});
