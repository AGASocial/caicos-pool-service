/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createFakeSupabase, type FakeDb, type Row } from '@/test-utils/fake-supabase';
import { IDS, makeOpenIssueDb } from '@/test-utils/open-issues-fixtures';
import type { OpenIssue } from '../follow-up-jobs';
import type { DigestEmailParams, DigestSendResult } from '@/lib/email/digest-mailer';
import { buildMondayDigest, runMondayDigest, weekStartMonday } from '../monday-digest';

jest.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: jest.fn(), supabaseAdmin: {} }));

const CO_A = '11111111-1111-4111-8111-111111111111';
const CO_B = '22222222-2222-4222-8222-222222222222';
const SENDS = 'cadenza_monday_digest_sends';
const NOW = new Date('2026-11-30T12:00:00Z'); // Monday 07:00 America/New_York

const QA_A_ADMIN = 'qa-billing-office-a@cadenzaops.com';
const QA_A_OPS = 'qa-billing-ops-a@cadenzaops.com';
const QA_B_OWNER = 'qa-billing-office-b@cadenzaops.com';

type TestEnv = Record<string, string | undefined>;
const env = (vars: TestEnv = {}) =>
  ({ MONDAY_DIGEST_ENABLED: '1', VERCEL_ENV: 'preview', ...vars }) as unknown as NodeJS.ProcessEnv;

function makeDb(): FakeDb {
  // Reuse the shared open-issue fixture, with UUID company ids and emails on the office users.
  const db = JSON.parse(JSON.stringify(makeOpenIssueDb()).replaceAll('"co-a"', `"${CO_A}"`).replaceAll('"co-b"', `"${CO_B}"`)) as FakeDb;
  db.cadenza_companies = [{ id: CO_A }, { id: CO_B }];
  db.cadenza_profiles = [
    { id: IDS.officeA, company_id: CO_A, role: 'admin', full_name: 'Office A', email: QA_A_ADMIN, is_active: true },
    { id: 'ops-a', company_id: CO_A, role: 'operations', full_name: 'Ops A', email: QA_A_OPS, is_active: true },
    { id: 'owner-a-real', company_id: CO_A, role: 'owner', full_name: 'Owner A', email: 'owner@example.com', is_active: true },
    { id: 'office-a-inactive', company_id: CO_A, role: 'admin', full_name: 'Gone', email: 'qa-billing-gone@cadenzaops.com', is_active: false },
    { id: IDS.techLate, company_id: CO_A, role: 'technician', full_name: 'Tech Late', email: 'qa-billing-tech-late@cadenzaops.com', is_active: true },
    { id: IDS.techOrigin, company_id: CO_A, role: 'technician', full_name: 'Tech Origin', email: 'qa-billing-tech-origin@cadenzaops.com', is_active: true },
    { id: IDS.techUnassigned, company_id: CO_A, role: 'technician', full_name: 'Tech Unassigned', email: null, is_active: true },
    { id: IDS.officeB, company_id: CO_B, role: 'owner', full_name: 'Office B', email: QA_B_OWNER, is_active: true },
  ];
  // Customer addresses must never be used.
  for (const property of db.cadenza_properties) property.customer_email = `customer-${String(property.id)}@example.com`;
  db[SENDS] = [];
  return db;
}

function makeClient(db: FakeDb, opts: { missingSends?: boolean } = {}): SupabaseClient {
  const fake = createFakeSupabase(db);
  const missing = {
    code: 'PGRST205',
    message: "Could not find the table 'public.cadenza_monday_digest_sends' in the schema cache",
  };
  const client = {
    from: (table: string) => {
      if (table === SENDS && opts.missingSends) {
        const failing: unknown = new Proxy(
          {},
          {
            get: (_t, prop) =>
              prop === 'then'
                ? (resolve: (v: unknown) => unknown) => resolve({ data: null, error: missing })
                : () => failing,
          },
        );
        return failing;
      }
      const builder = fake.from(table) as unknown as { insert: (row: Row) => unknown };
      if (table === SENDS) {
        const original = builder.insert.bind(builder);
        builder.insert = (row: Row) => {
          const duplicate = (db[SENDS] ?? []).some(
            (r) =>
              r.company_id === row.company_id &&
              r.week_start === row.week_start &&
              r.recipient_email === row.recipient_email,
          );
          return duplicate
            ? Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } })
            : original(row);
        };
      }
      return builder;
    },
    auth: {
      admin: {
        getUserById: jest.fn(async (id: string) => ({
          data: { user: { id, user_metadata: id === 'ops-a' ? { locale: 'es' } : {} } },
          error: null,
        })),
      },
    },
  };
  return client as unknown as SupabaseClient;
}

type SendMock = jest.Mock<Promise<DigestSendResult>, [DigestEmailParams]>;
const okSend = (): SendMock =>
  jest.fn<Promise<DigestSendResult>, [DigestEmailParams]>(async () => ({ sent: true, messageId: 'msg_1' }));
const recipientsOf = (send: SendMock) => send.mock.calls.map((c) => c[0].to).sort();

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('buildMondayDigest grouping (AC-1 / AC-2)', () => {
  const issue = (over: Partial<OpenIssue> & { id: string }): OpenIssue => ({
    source: 'service_report',
    job_id: `job-${over.id}`,
    property_id: null,
    created_at: '2026-11-01T12:00:00.000Z',
    summary: null,
    issue_categories: [],
    urgency: null,
    last_reviewed_at: null,
    days_open: 1,
    technician_id: null,
    technician_name: null,
    ...over,
  });

  it('groups by technician, oldest first inside each group, unassigned last', () => {
    const groups = buildMondayDigest([
      issue({ id: 'a1', days_open: 3, technician_id: 'tb', technician_name: 'Bea' }),
      issue({ id: 'u1', days_open: 40 }),
      issue({ id: 'a2', days_open: 9, technician_id: 'ta', technician_name: 'Al' }),
      issue({ id: 'a3', days_open: 21, technician_id: 'tb', technician_name: 'Bea' }),
      issue({ id: 'a4', days_open: 2, technician_id: 'ta', technician_name: 'Al' }),
    ]);
    expect(groups.map((g) => g.technician_name)).toEqual(['Al', 'Bea', null]);
    expect(groups[0].issues.map((i) => i.id)).toEqual(['a2', 'a4']);
    expect(groups[1].issues.map((i) => i.id)).toEqual(['a3', 'a1']);
    expect(groups[2]).toMatchObject({ technician_id: null, issues: [{ id: 'u1' }] });
  });

  it('returns no groups for no issues', () => {
    expect(buildMondayDigest([])).toEqual([]);
  });
});

describe('runMondayDigest', () => {
  it('AC-3: disabled returns skipped immediately and touches nothing', async () => {
    const db = makeDb();
    const from = jest.fn();
    const send = okSend();
    for (const value of [undefined, '', '0', 'false', 'off']) {
      const result = await runMondayDigest({
        now: NOW,
        env: env({ MONDAY_DIGEST_ENABLED: value }),
        client: { from } as unknown as SupabaseClient,
        send,
      });
      expect(result).toEqual({ ok: true, skipped: true, reason: 'disabled' });
    }
    expect(from).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(db[SENDS]).toHaveLength(0);
  });

  it('AC-4: enabled emails only office QA recipients, with grouping + counts, and logs each send', async () => {
    const db = makeDb();
    const send = okSend();
    // The shared fixture ages issues from the real clock, so run "now" to keep days_open exact.
    const now = new Date();
    const week = weekStartMonday(now);
    const result = await runMondayDigest({ now, env: env(), client: makeClient(db), send });

    expect(result).toMatchObject({
      ok: true,
      week_start: week,
      companies_considered: 2,
      companies_emailed: 2,
      emails_sent: 3,
      recipients_not_allowed: 1, // the non-QA owner in company A
      errors: 0,
    });
    // Company A: admin + operations (QA). Company B: owner (QA). No technicians, no customers,
    // no inactive user, no non-QA owner.
    expect(recipientsOf(send)).toEqual([QA_A_ADMIN, QA_A_OPS, QA_B_OWNER].sort());

    const call = (to: string) => send.mock.calls.map((c) => c[0]).find((p) => p.to === to)!;
    const a = call(QA_A_ADMIN);
    expect(a).toMatchObject({ companyId: CO_A, weekStart: week, issueCount: 3 });
    expect(a.groups.map((g) => g.technician_name)).toEqual(['Tech Origin']);
    expect(a.groups[0].issues.map((i) => [i.id, i.days_open])).toEqual([
      ['note-open', 20],
      ['report-open', 10],
      ['note-voice-only', 5],
    ]);
    expect(a.groups[0].issues[0].property).toMatchObject({ customer_name: 'QA Billing Property 1' });
    expect(call(QA_A_OPS).locale).toBe('es');

    // AC-5: company B only sees its own issues, in its own email.
    const b = call(QA_B_OWNER);
    expect(b).toMatchObject({ companyId: CO_B, issueCount: 2 });
    expect(b.groups).toHaveLength(1);
    expect(b.groups[0].technician_id).toBeNull();
    expect(b.groups.flatMap((g) => g.issues.map((i) => i.id)).sort()).toEqual([
      'note-company-b',
      'report-company-b',
    ]);

    expect(db[SENDS].map((r) => [r.company_id, r.week_start, r.recipient_email, r.issue_count, r.resend_message_id])).toEqual(
      expect.arrayContaining([
        [CO_A, week, QA_A_ADMIN, 3, 'msg_1'],
        [CO_A, week, QA_A_OPS, 3, 'msg_1'],
        [CO_B, week, QA_B_OWNER, 2, 'msg_1'],
      ]),
    );
    expect(db[SENDS]).toHaveLength(3);
  });

  it('AC-5: never uses customer / property emails as recipients', async () => {
    const db = makeDb();
    const send = okSend();
    await runMondayDigest({ now: NOW, env: env({ VERCEL_ENV: 'production' }), client: makeClient(db), send });
    expect(recipientsOf(send).every((to) => !to.startsWith('customer-'))).toBe(true);
    // In production the non-QA office owner is a valid office recipient; technicians still never are.
    expect(recipientsOf(send)).toEqual([QA_A_ADMIN, QA_A_OPS, QA_B_OWNER, 'owner@example.com'].sort());
    expect(recipientsOf(send)).not.toContain('qa-billing-tech-late@cadenzaops.com');
  });

  it('AC-4: in non-production a non-QA office user is dropped without failing the QA recipients', async () => {
    const db = makeDb();
    const send = okSend();
    await runMondayDigest({ now: NOW, env: env({ VERCEL_ENV: 'development' }), client: makeClient(db), send });
    expect(recipientsOf(send)).not.toContain('owner@example.com');
    expect(recipientsOf(send)).toContain(QA_A_ADMIN);
    expect(db[SENDS].map((r) => r.recipient_email)).not.toContain('owner@example.com');
  });

  it('AC-4: a second run in the same week sends nothing (idempotent)', async () => {
    const db = makeDb();
    const client = makeClient(db);
    const send = okSend();
    await runMondayDigest({ now: NOW, env: env(), client, send });
    expect(send).toHaveBeenCalledTimes(3);

    const again = await runMondayDigest({ now: new Date('2026-12-02T15:00:00Z'), env: env(), client, send });
    expect(send).toHaveBeenCalledTimes(3);
    expect(again).toMatchObject({ emails_sent: 0, recipients_already_sent: 3, errors: 0 });
    expect(db[SENDS]).toHaveLength(3);

    // The next Monday is a new week and sends again.
    await runMondayDigest({ now: new Date('2026-12-07T12:00:00Z'), env: env(), client, send });
    expect(send).toHaveBeenCalledTimes(6);
    expect(db[SENDS].filter((r) => r.week_start === '2026-12-07')).toHaveLength(3);
  });

  it('treats a duplicate send-log insert (parallel run) as success, not an error', async () => {
    const db = makeDb();
    const client = makeClient(db);
    const send = jest.fn(async (params: DigestEmailParams): Promise<DigestSendResult> => {
      // Another run logs the same recipient while this one is sending.
      db[SENDS].push({
        company_id: params.companyId,
        week_start: params.weekStart,
        recipient_email: params.to.toLowerCase(),
      });
      return { sent: true, messageId: 'msg_2' };
    });
    const result = await runMondayDigest({ now: NOW, env: env(), client, send });
    expect(result.errors).toBe(0);
    expect(db[SENDS]).toHaveLength(3);
  });

  it('skips companies with zero open issues without sending an empty digest', async () => {
    const db = makeDb();
    db.cadenza_service_reports = [];
    db.cadenza_job_voice_notes = db.cadenza_job_voice_notes.filter((n) => n.company_id === CO_B);
    const send = okSend();
    const result = await runMondayDigest({ now: NOW, env: env(), client: makeClient(db), send });
    expect(result).toMatchObject({ companies_without_issues: 1, companies_emailed: 1 });
    expect(recipientsOf(send)).toEqual([QA_B_OWNER]);
  });

  it('skips a company with open issues but no allowed office recipient, and keeps going', async () => {
    const db = makeDb();
    db.cadenza_profiles = db.cadenza_profiles.filter((p) => p.company_id !== CO_A || p.role === 'technician');
    const send = okSend();
    const result = await runMondayDigest({ now: NOW, env: env(), client: makeClient(db), send });
    expect(result).toMatchObject({ companies_without_recipients: 1, companies_emailed: 1, errors: 0 });
    expect(recipientsOf(send)).toEqual([QA_B_OWNER]);
  });

  it('respects the MONDAY_DIGEST_COMPANY_IDS allow-list', async () => {
    const db = makeDb();
    const send = okSend();
    const result = await runMondayDigest({
      now: NOW,
      env: env({ MONDAY_DIGEST_COMPANY_IDS: CO_B }),
      client: makeClient(db),
      send,
    });
    expect(result).toMatchObject({ companies_considered: 1, companies_emailed: 1 });
    expect(recipientsOf(send)).toEqual([QA_B_OWNER]);
  });

  it('fails closed when the allow-list is set but contains no valid company id', async () => {
    const send = okSend();
    const result = await runMondayDigest({
      now: NOW,
      env: env({ MONDAY_DIGEST_COMPANY_IDS: 'not-a-uuid' }),
      client: makeClient(makeDb()),
      send,
    });
    expect(result).toMatchObject({ ok: true, companies_considered: 0, emails_sent: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not log a send or count a company when the mailer no-ops (no API key)', async () => {
    const db = makeDb();
    const send = jest.fn(async (): Promise<DigestSendResult> => ({ sent: false, messageId: null, reason: 'no_api_key' }));
    const result = await runMondayDigest({ now: NOW, env: env(), client: makeClient(db), send });
    expect(result).toMatchObject({ emails_sent: 0, companies_emailed: 0 });
    expect(db[SENDS]).toHaveLength(0);
  });

  it('counts a failed send and leaves no send-log row, so the next run retries', async () => {
    const db = makeDb();
    const send = jest.fn(async (): Promise<DigestSendResult> => ({ sent: false, messageId: null, reason: 'send_failed' }));
    const result = await runMondayDigest({ now: NOW, env: env(), client: makeClient(db), send });
    expect(result.errors).toBe(3);
    expect(db[SENDS]).toHaveLength(0);
  });

  it('schema pending: a missing send-log table sends nothing at all', async () => {
    const db = makeDb();
    const send = okSend();
    const result = await runMondayDigest({
      now: NOW,
      env: env(),
      client: makeClient(db, { missingSends: true }),
      send,
    });
    expect(result).toMatchObject({ ok: false, skipped: true, reason: 'schema_pending' });
    expect(send).not.toHaveBeenCalled();
  });

  it('schema pending: missing KAN-153 columns skip the company without sending or throwing', async () => {
    const db = makeDb();
    const fake = createFakeSupabase(db, { missingColumns: ['last_reviewed_at'] });
    const client = {
      from: (t: string) => (t === SENDS ? createFakeSupabase(db).from(t) : fake.from(t)),
      auth: { admin: { getUserById: jest.fn(async () => ({ data: { user: null }, error: null })) } },
    } as unknown as SupabaseClient;
    const send = okSend();
    const result = await runMondayDigest({ now: NOW, env: env(), client, send });
    expect(send).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, emails_sent: 0, errors: 2 });
  });
});
