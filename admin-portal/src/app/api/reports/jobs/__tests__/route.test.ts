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

const mockStats = {
  total: 3,
  byStatus: { pending: 1, in_progress: 0, completed: 2, skipped: 0, cancelled: 0 },
  completionRate: 0.667,
  byTechnician: [
    { technicianId: 'tech-1', fullName: 'Alice', total: 2, completed: 1 },
    { technicianId: 'tech-2', fullName: 'Bob', total: 1, completed: 1 },
  ],
};

describe('GET /api/reports/jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue({ supabase: {}, user: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 404 when profile/company not found', async () => {
    const mockProfileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    };
    const mockSupabase = { from: jest.fn().mockReturnValue(mockProfileQuery), rpc: jest.fn() };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it('returns stats from RPC with correct shape', async () => {
    const mockProfileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { company_id: 'company-1' }, error: null }),
    };
    const mockSupabase = {
      from: jest.fn().mockReturnValue(mockProfileQuery),
      rpc: jest.fn().mockResolvedValue({ data: mockStats, error: null }),
    };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.byStatus.completed).toBe(2);
    expect(body.byTechnician).toHaveLength(2);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_job_report_stats', {
      p_company_id: 'company-1',
      p_date_from: null,
      p_date_to: null,
    });
  });

  it('completionRate is 0 when total is 0', async () => {
    const mockProfileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { company_id: 'company-1' }, error: null }),
    };
    const emptyStats = { ...mockStats, total: 0, completionRate: 0, byTechnician: [] };
    const mockSupabase = {
      from: jest.fn().mockReturnValue(mockProfileQuery),
      rpc: jest.fn().mockResolvedValue({ data: emptyStats, error: null }),
    };
    mockCreateClient.mockResolvedValue({ supabase: mockSupabase, user: { id: 'user-1' } });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.completionRate).toBe(0);
  });
});
