/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../route';

jest.mock('@/lib/supabase-server', () => ({
  createAuthenticatedRouteClient: jest.fn(),
}));

import { createAuthenticatedRouteClient } from '@/lib/supabase-server';

const mockCreateClient = createAuthenticatedRouteClient as jest.Mock;

function makeRequest(url = 'http://localhost/api/reports/jobs'): NextRequest {
  return new NextRequest(url);
}

describe('GET /api/reports/jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue({ supabase: {}, user: null });

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when profile/company not found', async () => {
    const mockProfileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    };
    const mockSupabase = { from: jest.fn().mockReturnValue(mockProfileQuery) };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const res = await GET(makeRequest());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Company not found');
  });

  it('returns stats object with correct shape', async () => {
    const mockJobs = [
      { id: 'j1', status: 'completed', technician_id: 'tech-1', technician: { id: 'tech-1', full_name: 'Alice' } },
      { id: 'j2', status: 'pending', technician_id: 'tech-1', technician: { id: 'tech-1', full_name: 'Alice' } },
      { id: 'j3', status: 'completed', technician_id: 'tech-2', technician: { id: 'tech-2', full_name: 'Bob' } },
    ];

    const mockProfileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { company_id: 'company-1' }, error: null }),
    };

    const mockJobsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: mockJobs, error: null }).then(resolve),
    };

    const mockSupabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(mockProfileQuery)
        .mockReturnValueOnce(mockJobsQuery),
    };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('byStatus');
    expect(body).toHaveProperty('completionRate');
    expect(body).toHaveProperty('byTechnician');

    expect(body.total).toBe(3);
    expect(body.byStatus.completed).toBe(2);
    expect(body.byStatus.pending).toBe(1);
  });

  it('completionRate is 0 when total is 0', async () => {
    const mockProfileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { company_id: 'company-1' }, error: null }),
    };

    const mockJobsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };

    const mockSupabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(mockProfileQuery)
        .mockReturnValueOnce(mockJobsQuery),
    };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.completionRate).toBe(0);
  });

  it('correctly aggregates byTechnician counts', async () => {
    const mockJobs = [
      { id: 'j1', status: 'completed', technician_id: 'tech-1', technician: { id: 'tech-1', full_name: 'Alice' } },
      { id: 'j2', status: 'completed', technician_id: 'tech-1', technician: { id: 'tech-1', full_name: 'Alice' } },
      { id: 'j3', status: 'pending', technician_id: 'tech-1', technician: { id: 'tech-1', full_name: 'Alice' } },
      { id: 'j4', status: 'completed', technician_id: 'tech-2', technician: { id: 'tech-2', full_name: 'Bob' } },
      { id: 'j5', status: 'pending', technician_id: null, technician: null },
    ];

    const mockProfileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { company_id: 'company-1' }, error: null }),
    };

    const mockJobsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: mockJobs, error: null }).then(resolve),
    };

    const mockSupabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(mockProfileQuery)
        .mockReturnValueOnce(mockJobsQuery),
    };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.byTechnician).toHaveLength(2);

    const alice = body.byTechnician.find((t: { technicianId: string }) => t.technicianId === 'tech-1');
    expect(alice).toBeDefined();
    expect(alice.total).toBe(3);
    expect(alice.completed).toBe(2);
    expect(alice.fullName).toBe('Alice');

    const bob = body.byTechnician.find((t: { technicianId: string }) => t.technicianId === 'tech-2');
    expect(bob).toBeDefined();
    expect(bob.total).toBe(1);
    expect(bob.completed).toBe(1);

    // Job with null technician_id should not appear in byTechnician
    expect(body.byTechnician).toHaveLength(2);
  });
});
