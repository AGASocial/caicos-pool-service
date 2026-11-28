/**
 * @jest-environment node
 */
import { GET } from '../route';
import { createFakeSupabase } from '@/test-utils/fake-supabase';
import { IDS, makeOpenIssueDb } from '@/test-utils/open-issues-fixtures';

jest.mock('@/lib/supabase-server', () => ({ createAuthenticatedRouteClient: jest.fn() }));

import { createAuthenticatedRouteClient } from '@/lib/supabase-server';

const mockAuth = createAuthenticatedRouteClient as jest.Mock;

function signIn(userId: string) {
  const db = makeOpenIssueDb();
  db.cadenza_monday_digest_sends = [
    { id: 's1', company_id: 'co-a', week_start: '2026-11-16', recipient_email: 'qa-billing-a@cadenzaops.com', sent_at: '2026-11-16T12:00:00.000Z' },
    { id: 's2', company_id: 'co-a', week_start: '2026-11-23', recipient_email: 'qa-billing-a@cadenzaops.com', sent_at: '2026-11-23T12:00:00.000Z' },
    { id: 's3', company_id: 'co-b', week_start: '2026-11-23', recipient_email: 'qa-billing-b@cadenzaops.com', sent_at: '2026-11-24T12:00:00.000Z' },
  ];
  mockAuth.mockResolvedValue({ supabase: createFakeSupabase(db), user: { id: userId } });
}

describe('GET /api/open-issues/digest-status', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ supabase: {}, user: null });
    expect((await GET()).status).toBe(401);
  });

  it('returns 403 for technicians', async () => {
    signIn(IDS.techLate);
    expect((await GET()).status).toBe(403);
  });

  it('returns the latest send for the caller\'s company only', async () => {
    signIn(IDS.officeA);
    expect(await (await GET()).json()).toEqual({ data: { last_sent_at: '2026-11-23T12:00:00.000Z' } });
    signIn(IDS.officeB);
    expect(await (await GET()).json()).toEqual({ data: { last_sent_at: '2026-11-24T12:00:00.000Z' } });
  });
});
