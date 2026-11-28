/**
 * @jest-environment node
 */
import { createFakeSupabase, type FakeDb } from '@/test-utils/fake-supabase';

jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from '@supabase/supabase-js';
import { getOpenVoiceNoteProblems, markVoiceNoteProblemOpen } from '../open-problems';

const DAY = 24 * 60 * 60 * 1000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();

function makeDb(): FakeDb {
  const base = { company_id: 'co-a', status: 'done', job_id: 'job-1', property_id: 'prop-1', urgency: 'high' };
  return {
    cadenza_job_voice_notes: [
      { ...base, id: 'recent-open', category: 'problem', follow_up_status: 'open', created_at: iso(2), model_reason: 'pump' },
      { ...base, id: 'old-open', category: 'problem', follow_up_status: 'open', created_at: iso(45), model_reason: 'leak' },
      { ...base, id: 'old-unbackfilled', category: 'problem', follow_up_status: null, created_at: iso(20) },
      { ...base, id: 'resolved', category: 'problem', follow_up_status: 'resolved', created_at: iso(3) },
      { ...base, id: 'routine', category: 'routine', follow_up_status: null, created_at: iso(1) },
      { ...base, id: 'still-processing', category: 'problem', status: 'classifying', follow_up_status: null, created_at: iso(1) },
      { ...base, id: 'other-company', company_id: 'co-b', category: 'problem', follow_up_status: 'open', created_at: iso(1) },
    ],
  };
}

const client = (db: FakeDb) => createFakeSupabase(db) as unknown as SupabaseClient;

describe('getOpenVoiceNoteProblems (AC-4)', () => {
  it('keeps the 7-day default window for existing callers', async () => {
    const rows = await getOpenVoiceNoteProblems('co-a', undefined, { client: client(makeDb()) });
    expect(rows.map((r) => r.id)).toEqual(['recent-open']);
  });

  it('unbounded form drops the window so old open problems still appear', async () => {
    const rows = await getOpenVoiceNoteProblems('co-a', { unbounded: true }, { client: client(makeDb()) });
    expect(rows.map((r) => r.id).sort()).toEqual(['old-open', 'old-unbackfilled', 'recent-open']);
  });

  it('excludes resolved notes in both forms', async () => {
    const db = makeDb();
    const windowed = await getOpenVoiceNoteProblems('co-a', undefined, { client: client(db) });
    const unbounded = await getOpenVoiceNoteProblems('co-a', { unbounded: true }, { client: client(db) });
    expect(windowed.map((r) => r.id)).not.toContain('resolved');
    expect(unbounded.map((r) => r.id)).not.toContain('resolved');
  });

  it('ignores routine notes, unfinished notes, and other companies', async () => {
    const rows = await getOpenVoiceNoteProblems('co-a', { unbounded: true }, { client: client(makeDb()) });
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain('routine');
    expect(ids).not.toContain('still-processing');
    expect(ids).not.toContain('other-company');
  });

  it('a note corrected to routine leaves the list without any review', async () => {
    const db = makeDb();
    expect((await getOpenVoiceNoteProblems('co-a', { unbounded: true }, { client: client(db) })).map((r) => r.id)).toContain(
      'recent-open',
    );
    db.cadenza_job_voice_notes.find((n) => n.id === 'recent-open')!.category = 'routine';
    expect((await getOpenVoiceNoteProblems('co-a', { unbounded: true }, { client: client(db) })).map((r) => r.id)).not.toContain(
      'recent-open',
    );
  });

  it('still honours explicit from/to bounds when unbounded is set', async () => {
    const rows = await getOpenVoiceNoteProblems(
      'co-a',
      { unbounded: true, from: iso(30) },
      { client: client(makeDb()) },
    );
    expect(rows.map((r) => r.id).sort()).toEqual(['old-unbackfilled', 'recent-open']);
  });

  it('returns [] on error by default but throws when asked to', async () => {
    const failing = createFakeSupabase(makeDb(), { missingColumns: ['follow_up_status'] }) as unknown as SupabaseClient;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await getOpenVoiceNoteProblems('co-a', { unbounded: true }, { client: failing })).toEqual([]);
    await expect(
      getOpenVoiceNoteProblems('co-a', { unbounded: true }, { client: failing, throwOnError: true }),
    ).rejects.toMatchObject({ code: '42703' });
  });
});

describe('classification hook: markVoiceNoteProblemOpen (T7)', () => {
  it('sets follow_up_status = open when it is null', async () => {
    const db = makeDb();
    await markVoiceNoteProblemOpen('old-unbackfilled', client(db));
    expect(db.cadenza_job_voice_notes.find((n) => n.id === 'old-unbackfilled')!.follow_up_status).toBe('open');
  });

  it('never overrides an existing status (a resolved note stays resolved)', async () => {
    const db = makeDb();
    await markVoiceNoteProblemOpen('resolved', client(db));
    expect(db.cadenza_job_voice_notes.find((n) => n.id === 'resolved')!.follow_up_status).toBe('resolved');
  });

  it('does not throw when the column does not exist yet (migration pending)', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const pending = createFakeSupabase(makeDb(), { missingColumns: ['follow_up_status'] }) as unknown as SupabaseClient;
    await expect(markVoiceNoteProblemOpen('recent-open', pending)).resolves.toBeUndefined();
  });
});
