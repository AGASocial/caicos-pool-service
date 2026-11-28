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

function call(query = '') {
  return GET(new NextRequest(`http://localhost/api/open-issues${query}`));
}

function signIn(userId: string, opts: Parameters<typeof createFakeSupabase>[1] = {}) {
  const db = makeOpenIssueDb();
  mockAuth.mockResolvedValue({ supabase: createFakeSupabase(db, opts), user: { id: userId } });
  return db;
}

describe('GET /api/open-issues', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('AC-6: returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ supabase: {}, user: null });
    const res = await call();
    expect(res.status).toBe(401);
  });

  it('is office-only (technicians get 403)', async () => {
    signIn(IDS.techLate);
    expect((await call()).status).toBe(403);
  });

  it('AC-3 / AC-4: returns reports and voice-note problems with days_open, oldest first', async () => {
    signIn(IDS.officeA);
    const res = await call();
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.map((i: { source: string; id: string }) => `${i.source}:${i.id}`)).toEqual([
      'voice_note:note-open', // 20 days
      'service_report:report-open', // 10 days
      'voice_note:note-voice-only', // 5 days
    ]);
    expect(data.map((i: { days_open: number }) => i.days_open)).toEqual([20, 10, 5]);
    expect(data[0].property).toMatchObject({ customer_name: 'QA Billing Property 1' });
  });

  it('AC-3: min_days filters out newer issues', async () => {
    signIn(IDS.officeA);
    const ids = async (q: string) =>
      ((await (await call(q)).json()).data as Array<{ id: string }>).map((i) => i.id);
    expect(await ids('?min_days=7')).toEqual(['note-open', 'report-open']);
    expect(await ids('?min_days=14')).toEqual(['note-open']);
    expect(await ids('?min_days=30')).toEqual([]);
  });

  it('AC-6: never returns another company\'s issues (nor resolved/routine ones)', async () => {
    signIn(IDS.officeA);
    const ids = ((await (await call()).json()).data as Array<{ id: string }>).map((i) => i.id);
    expect(ids).not.toContain('report-company-b');
    expect(ids).not.toContain('note-company-b');
    expect(ids).not.toContain('report-resolved');
    expect(ids).not.toContain('note-routine');

    signIn(IDS.officeB);
    const b = ((await (await call()).json()).data as Array<{ id: string }>).map((i) => i.id);
    expect(b.sort()).toEqual(['note-company-b', 'report-company-b']);
  });

  it('KAN-154: attaches the origin job technician (id + name); no technician = unassigned', async () => {
    const db = signIn(IDS.officeA);
    db.cadenza_service_jobs.find((j) => j.id === IDS.jobVoiceOnly)!.technician_id = null;
    const { data } = await (await call()).json();
    const byId = Object.fromEntries(
      data.map((i: { id: string; technician_id: string | null; technician_name: string | null }) => [
        i.id,
        [i.technician_id, i.technician_name],
      ]),
    );
    expect(byId['note-open']).toEqual([IDS.techOrigin, 'Tech Origin']);
    expect(byId['report-open']).toEqual([IDS.techOrigin, 'Tech Origin']);
    expect(byId['note-voice-only']).toEqual([null, null]);
  });

  it('KAN-154: never resolves a technician name from another company\'s profile', async () => {
    const db = signIn(IDS.officeA);
    db.cadenza_profiles.find((p) => p.id === IDS.techOrigin)!.company_id = 'co-b';
    const { data } = await (await call()).json();
    const issue = data.find((i: { id: string }) => i.id === 'report-open');
    expect(issue.technician_name).toBeNull();
  });

  it('supports job_id to list one job\'s issues', async () => {
    signIn(IDS.officeA);
    const { data } = await (await call(`?job_id=${IDS.jobOrigin}`)).json();
    expect(data.map((i: { id: string }) => i.id).sort()).toEqual(['note-open', 'report-open']);
  });

  it('excludes issues on soft-deleted jobs', async () => {
    const db = signIn(IDS.officeA);
    db.cadenza_service_jobs.find((j) => j.id === IDS.jobVoiceOnly)!.is_deleted = true;
    const ids = ((await (await call()).json()).data as Array<{ id: string }>).map((i) => i.id);
    expect(ids).not.toContain('note-voice-only');
  });

  it('fails clearly with 503 SCHEMA_PENDING when the migration is missing', async () => {
    signIn(IDS.officeA, { missingColumns: ['last_reviewed_at'] });
    const res = await call();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('SCHEMA_PENDING');
  });
});
