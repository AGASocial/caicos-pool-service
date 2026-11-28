/**
 * @jest-environment node
 */
import { createFakeSupabase } from '@/test-utils/fake-supabase';
import { IDS, makeOpenIssueDb } from '@/test-utils/open-issues-fixtures';

jest.mock('@/lib/supabase-server', () => ({ createRouteClient: jest.fn() }));
jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }));
jest.mock('@/lib/company-counts', () => ({
  fetchCompanyCounts: jest.fn(async () => ({ totalJobs: 0, totalRoutes: 0, totalTeamMembers: 0, totalProperties: 0 })),
}));

import { createRouteClient } from '@/lib/supabase-server';
import { fetchDashboardServerData } from '../server-data';

const mockRouteClient = createRouteClient as jest.Mock;

function signIn(userId: string, opts: Parameters<typeof createFakeSupabase>[1] = {}, db = makeOpenIssueDb()) {
  const fake = createFakeSupabase(db, opts);
  mockRouteClient.mockResolvedValue({
    ...fake,
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
  });
  return db;
}

describe('fetchDashboardServerData issue list (AC-3 / AC-4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('uses the reports ∪ voice-notes union, attaches days_open and is oldest-first', async () => {
    signIn(IDS.officeA);
    const data = await fetchDashboardServerData();
    expect(data).not.toBeNull();
    const rows = data!.issueJobs;
    expect(rows.map((r) => [r.id, r.days_open])).toEqual([
      [IDS.jobOrigin, 20],
      [IDS.jobVoiceOnly, 5],
    ]);
    const origin = rows[0];
    expect(origin.issue_categories).toEqual(['motor']);
    expect(origin.has_voice_note_problem).toBe(true);
    expect(rows[1].has_voice_note_problem).toBe(true);
    expect(rows[1].issue_categories).toEqual([]);
    expect(data!.issuesSchemaPending).toBe(false);
  });

  it('never includes another company\'s jobs', async () => {
    signIn(IDS.officeA);
    const data = await fetchDashboardServerData();
    expect(data!.issueJobs.map((r) => r.id)).not.toContain(IDS.jobCompanyB);
  });

  it('degrades to reports only and flags schema-pending when the migration is missing', async () => {
    signIn(IDS.officeA, { missingColumns: ['last_reviewed_at'] });
    const data = await fetchDashboardServerData();
    expect(data!.issuesSchemaPending).toBe(true);
    expect(data!.issueJobs.map((r) => r.id)).toEqual([IDS.jobOrigin]);
  });
});
