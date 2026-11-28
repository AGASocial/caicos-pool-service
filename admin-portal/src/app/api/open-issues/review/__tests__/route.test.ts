/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { createFakeSupabase } from '@/test-utils/fake-supabase';
import { IDS, makeOpenIssueDb } from '@/test-utils/open-issues-fixtures';

jest.mock('@/lib/supabase-server', () => ({ createAuthenticatedRouteClient: jest.fn() }));
jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }));

import { createAuthenticatedRouteClient } from '@/lib/supabase-server';

const mockAuth = createAuthenticatedRouteClient as jest.Mock;

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/open-issues/review', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

const valid = { source: 'service_report', id: 'report-open', review_job_id: IDS.jobLate, resolved: true };

function signIn(userId: string) {
  const rpc = jest.fn(async () => ({ data: { ok: true, follow_up_status: 'resolved' }, error: null }));
  mockAuth.mockResolvedValue({
    supabase: createFakeSupabase(makeOpenIssueDb(), { rpc }),
    user: { id: userId },
  });
  return rpc;
}

describe('POST /api/open-issues/review', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('AC-6: returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ supabase: {}, user: null });
    expect((await post(valid)).status).toBe(401);
  });

  it('returns 400 for invalid JSON and invalid bodies', async () => {
    signIn(IDS.techLate);
    expect((await post('{nope')).status).toBe(400);
    expect((await post({ ...valid, resolved: 'yes' })).status).toBe(400);
    expect((await post({ ...valid, source: 'x' })).status).toBe(400);
  });

  it('AC-2 / AC-5: the technician assigned to the later job can answer Yes and No', async () => {
    const rpc = signIn(IDS.techLate);
    const yes = await post(valid);
    expect(yes.status).toBe(200);
    const no = await post({ ...valid, source: 'voice_note', id: 'note-open', resolved: false });
    expect(no.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith(
      'review_open_issue',
      expect.objectContaining({ p_resolved: false, p_source: 'voice_note' }),
    );
  });

  it('AC-5: rejects an unassigned technician, another property, and another company', async () => {
    const rpc = signIn(IDS.techUnassigned);
    expect((await post(valid)).status).toBe(403);

    signIn(IDS.techLate);
    expect((await post({ ...valid, review_job_id: IDS.jobOtherProperty })).status).toBe(403);

    // A company-B user cannot see company A's report, review job, or issue.
    const rpcB = signIn(IDS.officeB);
    const res = await post(valid);
    expect([403, 404]).toContain(res.status);
    expect(rpcB).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('AC-5: office can review any issue in the company', async () => {
    const rpc = signIn(IDS.officeA);
    expect((await post(valid)).status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
