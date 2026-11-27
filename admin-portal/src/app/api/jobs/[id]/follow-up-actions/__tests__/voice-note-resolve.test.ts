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

function post(jobId: string, body: unknown) {
  return POST(
    new NextRequest(`http://localhost/api/jobs/${jobId}/follow-up-actions`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: jobId }) },
  );
}

function setup(userId: string = IDS.officeA) {
  const db = makeOpenIssueDb();
  mockAuth.mockResolvedValue({ supabase: createFakeSupabase(db), user: { id: userId } });
  return db;
}

const noteOf = (db: ReturnType<typeof makeOpenIssueDb>, id: string) =>
  db.cadenza_job_voice_notes.find((n) => n.id === id)!;
const reportOf = (db: ReturnType<typeof makeOpenIssueDb>, id: string) =>
  db.cadenza_service_reports.find((r) => r.id === id)!;

describe('POST follow-up-actions resolving sources independently (requirement 7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('resolving a voice note leaves the report on the same job open', async () => {
    const db = setup();
    const res = await post(IDS.jobOrigin, { action_type: 'resolved', voice_note_id: 'note-open' });
    expect(res.status).toBe(201);

    expect(noteOf(db, 'note-open')).toMatchObject({
      follow_up_status: 'resolved',
      last_reviewed_job_id: IDS.jobOrigin,
      last_reviewed_by: IDS.officeA,
    });
    expect(reportOf(db, 'report-open').follow_up_status).toBe('open');
    expect(db.cadenza_job_follow_up_actions).toHaveLength(1);
    expect(db.cadenza_job_follow_up_actions[0]).toMatchObject({
      action_type: 'resolved',
      report_id: null,
      metadata: { source: 'voice_note', source_id: 'note-open', origin_job_id: IDS.jobOrigin },
    });
  });

  it('resolving the report (no voice_note_id) leaves the voice note open', async () => {
    const db = setup();
    // The job's latest report is resolved through the existing path.
    const res = await post(IDS.jobOrigin, { action_type: 'resolved' });
    expect(res.status).toBe(201);
    expect(noteOf(db, 'note-open').follow_up_status).toBe('open');
  });

  it('rejects a voice note from another job or company, and non-office callers', async () => {
    setup();
    expect((await post(IDS.jobLate, { action_type: 'resolved', voice_note_id: 'note-open' })).status).toBe(404);
    expect((await post(IDS.jobCompanyB, { action_type: 'resolved', voice_note_id: 'note-open' })).status).toBe(404);
    setup(IDS.techOrigin);
    expect((await post(IDS.jobOrigin, { action_type: 'resolved', voice_note_id: 'note-open' })).status).toBe(403);
  });

  it('rejects routine / already resolved notes and non-resolve actions', async () => {
    const db = setup();
    expect((await post(IDS.jobOrigin, { action_type: 'resolved', voice_note_id: 'note-routine' })).status).toBe(409);
    noteOf(db, 'note-open').follow_up_status = 'resolved';
    expect((await post(IDS.jobOrigin, { action_type: 'resolved', voice_note_id: 'note-open' })).status).toBe(409);
    expect((await post(IDS.jobOrigin, { action_type: 'call', voice_note_id: 'note-open' })).status).toBe(400);
  });
});
