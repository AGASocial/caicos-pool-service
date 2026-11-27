/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { createFakeSupabase } from '@/test-utils/fake-supabase';
import { IDS, makeOpenIssueDb } from '@/test-utils/open-issues-fixtures';

jest.mock('@/lib/supabase-server', () => ({ createAuthenticatedRouteClient: jest.fn() }));
jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }));

import { createAuthenticatedRouteClient } from '@/lib/supabase-server';

const mockAuth = createAuthenticatedRouteClient as jest.Mock;

function call(jobId: string) {
  return GET(new NextRequest(`http://localhost/api/jobs/${jobId}/open-issues`), {
    params: Promise.resolve({ id: jobId }),
  });
}

function signIn(userId: string) {
  mockAuth.mockResolvedValue({ supabase: createFakeSupabase(makeOpenIssueDb()), user: { id: userId } });
}

describe('GET /api/jobs/[id]/open-issues', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('AC-6: returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ supabase: {}, user: null });
    expect((await call(IDS.jobLate)).status).toBe(401);
  });

  it('AC-1 / AC-5: the technician assigned to the later job sees another technician\'s issues at the same property', async () => {
    signIn(IDS.techLate);
    const res = await call(IDS.jobLate);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.map((i: { id: string }) => i.id).sort()).toEqual(['note-open', 'report-open']);
    expect(data.every((i: { job_id: string }) => i.job_id === IDS.jobOrigin)).toBe(true);
  });

  it('does not carry an issue onto the job it was recorded on', async () => {
    signIn(IDS.officeA);
    const { data } = await (await call(IDS.jobOrigin)).json();
    expect(data).toEqual([]);
  });

  it('only returns issues for the same property', async () => {
    signIn(IDS.techLate);
    const { data } = await (await call(IDS.jobOtherProperty)).json();
    expect(data.map((i: { id: string }) => i.id)).toEqual(['note-voice-only']);
  });

  it('office can read any job in the company', async () => {
    signIn(IDS.officeA);
    expect((await call(IDS.jobLate)).status).toBe(200);
  });

  it('AC-5: a technician who is not assigned to the job gets 403', async () => {
    signIn(IDS.techUnassigned);
    expect((await call(IDS.jobLate)).status).toBe(403);
  });

  it('AC-5 / AC-6: another company\'s job is 404 and leaks nothing', async () => {
    signIn(IDS.officeA);
    expect((await call(IDS.jobCompanyB)).status).toBe(404);
    signIn(IDS.officeB);
    expect((await call(IDS.jobLate)).status).toBe(404);
  });
});
