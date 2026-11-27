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

type JobOut = { id: string; days_open?: number };

async function list(query: string, userId: string = IDS.officeA, opts: Parameters<typeof createFakeSupabase>[1] = {}) {
  mockAuth.mockResolvedValue({ supabase: createFakeSupabase(makeOpenIssueDb(), opts), user: { id: userId } });
  const res = await GET(new NextRequest(`http://localhost/api/jobs?${query}`));
  return { res, body: res.status === 200 ? await res.json() : await res.json().catch(() => ({})) };
}

describe('GET /api/jobs?needs_follow_up=true (KAN-153)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('AC-6: 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ supabase: {}, user: null });
    const res = await GET(new NextRequest('http://localhost/api/jobs?needs_follow_up=true'));
    expect(res.status).toBe(401);
  });

  it('AC-4: includes a job whose only open issue is a voice-note problem', async () => {
    const { body } = await list('needs_follow_up=true');
    const ids = (body.data as JobOut[]).map((j) => j.id);
    expect(ids).toContain(IDS.jobVoiceOnly);
    expect(ids).toContain(IDS.jobOrigin);
  });

  it('AC-3: returns days_open (oldest issue per job) and sorts oldest-first', async () => {
    const { body } = await list('needs_follow_up=true');
    const rows = body.data as JobOut[];
    // job-origin: voice note 20d / report 10d => 20; job-voice-only: 5d.
    expect(rows.map((r) => [r.id, r.days_open])).toEqual([
      [IDS.jobOrigin, 20],
      [IDS.jobVoiceOnly, 5],
    ]);
  });

  it('AC-3: min_days keeps only jobs whose oldest issue is old enough', async () => {
    expect(((await list('needs_follow_up=true&min_days=7')).body.data as JobOut[]).map((r) => r.id)).toEqual([
      IDS.jobOrigin,
    ]);
    expect(((await list('needs_follow_up=true&min_days=14')).body.data as JobOut[]).map((r) => r.id)).toEqual([
      IDS.jobOrigin,
    ]);
    expect((await list('needs_follow_up=true&min_days=30')).body.data).toEqual([]);
    expect(((await list('needs_follow_up=true&min_days=0')).body.data as JobOut[]).length).toBe(2);
  });

  it('AC-6: never includes another company\'s jobs', async () => {
    const { body } = await list('needs_follow_up=true');
    expect((body.data as JobOut[]).map((j) => j.id)).not.toContain(IDS.jobCompanyB);
    const b = await list('needs_follow_up=true', IDS.officeB);
    expect((b.body.data as JobOut[]).map((j) => j.id)).toEqual([IDS.jobCompanyB]);
  });

  it('a job drops out once both of its issues are resolved, but not when only one is', async () => {
    const db = makeOpenIssueDb();
    db.cadenza_service_reports.find((r) => r.id === 'report-open')!.follow_up_status = 'resolved';
    mockAuth.mockResolvedValue({ supabase: createFakeSupabase(db), user: { id: IDS.officeA } });
    let body = await (await GET(new NextRequest('http://localhost/api/jobs?needs_follow_up=true'))).json();
    expect((body.data as JobOut[]).map((j) => j.id)).toContain(IDS.jobOrigin); // voice note still open

    db.cadenza_job_voice_notes.find((n) => n.id === 'note-open')!.follow_up_status = 'resolved';
    mockAuth.mockResolvedValue({ supabase: createFakeSupabase(db), user: { id: IDS.officeA } });
    body = await (await GET(new NextRequest('http://localhost/api/jobs?needs_follow_up=true'))).json();
    expect((body.data as JobOut[]).map((j) => j.id)).not.toContain(IDS.jobOrigin);
  });

  it('a note corrected to routine leaves the queue', async () => {
    const db = makeOpenIssueDb();
    db.cadenza_job_voice_notes.find((n) => n.id === 'note-voice-only')!.category = 'routine';
    mockAuth.mockResolvedValue({ supabase: createFakeSupabase(db), user: { id: IDS.officeA } });
    const body = await (await GET(new NextRequest('http://localhost/api/jobs?needs_follow_up=true'))).json();
    expect((body.data as JobOut[]).map((j) => j.id)).not.toContain(IDS.jobVoiceOnly);
  });

  it('paginates the oldest-first order with a cursor', async () => {
    const first = await list('needs_follow_up=true&limit=1');
    expect((first.body.data as JobOut[]).map((j) => j.id)).toEqual([IDS.jobOrigin]);
    expect(first.body.pagination.hasMore).toBe(true);

    const second = await list(`needs_follow_up=true&limit=1&cursor=${first.body.pagination.nextCursor}`);
    expect((second.body.data as JobOut[]).map((j) => j.id)).toEqual([IDS.jobVoiceOnly]);
    expect(second.body.pagination.hasMore).toBe(false);
  });

  it('fails clearly (503 SCHEMA_PENDING) instead of returning an empty list when the migration is missing', async () => {
    const { res, body } = await list('needs_follow_up=true', IDS.officeA, { missingColumns: ['last_reviewed_at'] });
    expect(res.status).toBe(503);
    expect(body.code).toBe('SCHEMA_PENDING');
  });

  it('does not add days_open to the regular (non follow-up) list', async () => {
    const { body } = await list('');
    expect((body.data as JobOut[]).every((j) => j.days_open === undefined)).toBe(true);
  });
});
