/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { createFakeSupabase } from '@/test-utils/fake-supabase';
import { LS, makeLastServiceDb } from '@/test-utils/last-service-fixtures';

jest.mock('@/lib/supabase-server', () => ({ createAuthenticatedRouteClient: jest.fn() }));

import { createAuthenticatedRouteClient } from '@/lib/supabase-server';

const mockAuth = createAuthenticatedRouteClient as jest.Mock;

function call(propertyId: string, query = '') {
  return GET(new NextRequest(`http://localhost/api/properties/${propertyId}/last-service${query}`), {
    params: Promise.resolve({ id: propertyId }),
  });
}

function signIn(userId: string, opts: Parameters<typeof createFakeSupabase>[1] = {}) {
  mockAuth.mockResolvedValue({
    supabase: createFakeSupabase(makeLastServiceDb(), opts),
    user: { id: userId },
  });
}

describe('GET /api/properties/[id]/last-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('AC-4: 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ supabase: {}, user: null });
    expect((await call(LS.sharedProp)).status).toBe(401);
  });

  it('AC-4: 404 for another company\'s property (no summary leaked)', async () => {
    signIn(LS.techA);
    const res = await call(LS.foreignProp);
    expect(res.status).toBe(404);
    expect(JSON.stringify(await res.json())).not.toMatch(/999|QA Billing Foreign/);
  });

  it('404 for a missing or malformed property id', async () => {
    signIn(LS.techA);
    expect((await call('00000000-0000-4000-8000-00000000ffff')).status).toBe(404);
    expect((await call('not-a-uuid')).status).toBe(404);
  });

  it('AC-2: technician sees the previous visit on a shared property, allow-listed only', async () => {
    signIn(LS.techB);
    const res = await call(LS.sharedProp, `?job_id=${LS.jobCurrent}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      is_shared: true,
      last_service: {
        job_id: LS.jobPrev,
        scheduled_date: '2026-11-10',
        technician_name: 'Tech A',
        cleaned_filter: true,
        backwashed: true,
        salt_level: 3100,
        service_event_types: ['filter_cleaning', 'salt_addition'],
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/private|example\.invalid/);
  });

  it('office roles can read it too', async () => {
    signIn(LS.officeA);
    const body = await (await call(LS.sharedProp)).json();
    expect(body.last_service.job_id).toBe(LS.jobPrev);
  });

  it('AC-3: non-shared property => { is_shared: false, last_service: null }', async () => {
    signIn(LS.techA);
    const res = await call(LS.plainProp);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ is_shared: false, last_service: null });
  });

  it('AC-3: shared property whose only visit is the current job => last_service null', async () => {
    signIn(LS.techA);
    const res = await call(LS.emptySharedProp, `?job_id=${LS.jobOnlyCurrent}`);
    expect(await res.json()).toEqual({ is_shared: true, last_service: null });
  });

  it('rejects a malformed job_id without querying', async () => {
    signIn(LS.techA);
    expect((await call(LS.sharedProp, '?job_id=nope')).status).toBe(404);
  });

  it('503 SCHEMA_PENDING when the is_shared column is missing', async () => {
    signIn(LS.techA, { missingColumns: ['is_shared'] });
    const res = await call(LS.sharedProp);
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('SCHEMA_PENDING');
  });

  it('403 when the user has no company profile', async () => {
    mockAuth.mockResolvedValue({
      supabase: createFakeSupabase(makeLastServiceDb()),
      user: { id: 'no-profile' },
    });
    expect((await call(LS.sharedProp)).status).toBe(403);
  });
});
