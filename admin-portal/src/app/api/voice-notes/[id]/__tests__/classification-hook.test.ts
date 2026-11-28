/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { PATCH } from '../route';
import { createFakeSupabase } from '@/test-utils/fake-supabase';
import { IDS, makeOpenIssueDb } from '@/test-utils/open-issues-fixtures';
import { getOpenVoiceNoteProblems } from '@/lib/voice-notes/open-problems';
import type { SupabaseClient } from '@supabase/supabase-js';

jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }));
jest.mock('@/lib/voice-notes/auth', () => ({ createVoiceNotesRouteClient: jest.fn() }));

import { createVoiceNotesRouteClient } from '@/lib/voice-notes/auth';

const mockAuth = createVoiceNotesRouteClient as jest.Mock;

function patch(noteId: string, body: unknown) {
  return PATCH(
    new NextRequest(`http://localhost/api/voice-notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: noteId }) },
  );
}

describe('PATCH /api/voice-notes/[id] correction hook (AC-4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('correcting routine → problem opens the follow-up (status was null)', async () => {
    const db = makeOpenIssueDb();
    const client = createFakeSupabase(db);
    mockAuth.mockResolvedValue({ supabase: client, user: { id: IDS.officeA } });

    const res = await patch('note-routine', { category: 'problem', urgency: 'high' });
    expect(res.status).toBe(200);

    const note = db.cadenza_job_voice_notes.find((n) => n.id === 'note-routine')!;
    expect(note).toMatchObject({ category: 'problem', follow_up_status: 'open' });
    const open = await getOpenVoiceNoteProblems('co-a', { unbounded: true }, { client: client as unknown as SupabaseClient });
    expect(open.map((n) => n.id)).toContain('note-routine');
  });

  it('correcting problem → routine removes it from the open list without any review', async () => {
    const db = makeOpenIssueDb();
    const client = createFakeSupabase(db);
    mockAuth.mockResolvedValue({ supabase: client, user: { id: IDS.officeA } });

    const res = await patch('note-open', { category: 'routine' });
    expect(res.status).toBe(200);

    const open = await getOpenVoiceNoteProblems('co-a', { unbounded: true }, { client: client as unknown as SupabaseClient });
    expect(open.map((n) => n.id)).not.toContain('note-open');
    // No review was recorded.
    expect(db.cadenza_job_follow_up_actions).toHaveLength(0);
  });

  it('a note that was already resolved stays resolved when corrected back to problem', async () => {
    const db = makeOpenIssueDb();
    db.cadenza_job_voice_notes.find((n) => n.id === 'note-open')!.follow_up_status = 'resolved';
    mockAuth.mockResolvedValue({ supabase: createFakeSupabase(db), user: { id: IDS.officeA } });

    await patch('note-open', { category: 'problem', urgency: 'low' });
    expect(db.cadenza_job_voice_notes.find((n) => n.id === 'note-open')!.follow_up_status).toBe('resolved');
  });
});
