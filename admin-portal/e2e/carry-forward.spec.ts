/**
 * Open-issue carry-forward E2E — KAN-153.
 *
 * Uses an ephemeral qa-billing-* tenant (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) and seeds
 * reports / voice-note rows directly, so no customer email is ever sent and nothing is charged.
 * Skips cleanly when env vars are missing or the KAN-153 migration is not applied.
 * Set RECORD_VIDEO=1 to save a video to test-results/kan153-video.
 *
 * AC coverage: AC-1 + AC-5 (carry-forward list + authorization), AC-2 (review Yes/No updates the
 * queue), AC-3 (dashboard / Jobs age, filters, order), AC-4 (voice-note problem with age; leaves
 * the queue after correction to routine — the "Yes" path is covered by AC-2 and by unit tests),
 * AC-6 (401 + company scoping).
 *
 * Seeded jobs are `pending` or `completed` with no customer emails, and no report is flagged
 * for sending, so the KAN-151 cron cannot act on them.
 */
import {
  test,
  expect,
  request as pwRequest,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { cleanupBillingQaUsers } from './helpers/billing-qa-cleanup';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

const HAS_SERVICE = Boolean(SUPABASE_URL && SERVICE_KEY);

const RUN_ID = `cf${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const OWNER_EMAIL = `qa-billing-${RUN_ID}@cadenzaops.com`;
const LATE_TECH_EMAIL = `qa-billing-${RUN_ID}-late@cadenzaops.com`;
const ORIGIN_TECH_EMAIL = `qa-billing-${RUN_ID}-origin@cadenzaops.com`;
const OTHER_EMAIL = `qa-billing-${RUN_ID}-other@cadenzaops.com`;
const COMPANY_NAME = `QA Billing Carry Forward ${RUN_ID}`;
const OTHER_COMPANY_NAME = `QA Billing Carry Forward Other ${RUN_ID}`;
const OWNER_NAME = 'QA Carry Owner';
const PASSWORD = `Qa!${crypto.randomBytes(18).toString('base64url')}`;

test.describe.configure({ mode: 'serial' });
test.skip(!HAS_SERVICE, 'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required to seed open issues');

let admin: SupabaseClient | undefined;
let lateTechId = '';
let originTechId = '';
let companyId = '';
let otherCompanyId = '';
let schemaReady = false;
let ownerApi: APIRequestContext;
let lateTechApi: APIRequestContext;
let otherApi: APIRequestContext;
const openContexts: BrowserContext[] = [];

type Scenario = { propertyId: string; originJobId: string; name: string };
const s = {} as Record<'p1' | 'p2' | 'p3' | 'p4', Scenario>;
let laterJobId = ''; // later visit at P1, assigned to the late technician
let p1ReportId = '';
let p1NoteId = '';
let p2NoteId = '';
let p3NoteId = '';
let p4ReportId = '';
let foreignJobId = '';
let foreignReportId = '';

const bypassHeaders: Record<string, string> = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? {
      'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      'x-vercel-set-bypass-cookie': 'true',
    }
  : {};

async function fillSecret(locator: Locator, value: string) {
  await locator.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value');
    desc?.set?.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function ownerPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    ...(process.env.RECORD_VIDEO
      ? {
          recordVideo: { dir: 'test-results/kan153-video', size: { width: 1280, height: 800 } },
          viewport: { width: 1280, height: 800 },
        }
      : {}),
  });
  openContexts.push(ctx);
  return ctx.newPage();
}

async function uiLogin(page: Page) {
  await page.goto(`${BASE_URL}/en/auth/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByLabel(/email/i).fill(OWNER_EMAIL);
  await fillSecret(page.getByLabel(/password/i), PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/auth'), { timeout: 30_000 });
}

async function createTenant(email: string, companyName: string, fullName: string) {
  const { data, error } = await admin!.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, company_name: companyName },
  });
  expect(error, error?.message).toBeNull();
  const userId = data.user!.id;
  const { data: profile } = await admin!
    .from('cadenza_profiles')
    .select('company_id, role')
    .eq('id', userId)
    .single();
  expect(profile?.role).toBe('owner');
  return { userId, companyId: profile!.company_id as string };
}

async function createTechnician(email: string, fullName: string, forCompany: string) {
  const { data, error } = await admin!.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, company_id: forCompany, role: 'technician' },
  });
  expect(error, error?.message).toBeNull();
  return data.user!.id;
}

/** Local-noon ISO timestamp `n` calendar days ago, so days_open === n in any time zone. */
function daysAgoIso(n: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, 12, 0, 0).toISOString();
}

async function seedProperty(forCompany: string, name: string, address: string): Promise<string> {
  const { data, error } = await admin!
    .from('cadenza_properties')
    .insert({
      company_id: forCompany,
      customer_name: name,
      address,
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      pool_type: 'residential',
      is_active: true,
    })
    .select('id')
    .single();
  expect(error, error?.message).toBeNull();
  return data!.id as string;
}

async function seedJob(
  forCompany: string,
  propertyId: string,
  technicianId: string | null,
  status: 'pending' | 'completed',
  scheduledDaysAgo: number,
): Promise<string> {
  const { data, error } = await admin!
    .from('cadenza_service_jobs')
    .insert({
      company_id: forCompany,
      property_id: propertyId,
      technician_id: technicianId,
      scheduled_date: daysAgoIso(scheduledDaysAgo).slice(0, 10),
      status,
      job_source: 'ad_hoc',
      estimated_duration_min: 30,
      has_paid_extras: false,
      send_paid_extra_report: false,
    })
    .select('id')
    .single();
  expect(error, error?.message).toBeNull();
  return data!.id as string;
}

async function seedReport(
  forCompany: string,
  jobId: string,
  technicianId: string | null,
  ageDays: number,
  categories: string[],
  notes: string,
): Promise<string> {
  const { data, error } = await admin!
    .from('cadenza_service_reports')
    .insert({
      job_id: jobId,
      company_id: forCompany,
      technician_id: technicianId,
      follow_up_needed: true,
      follow_up_notes: notes,
      follow_up_status: 'open',
      issue_categories: categories,
      notes: 'QA carry-forward seed',
      created_at: daysAgoIso(ageDays),
    })
    .select('id')
    .single();
  expect(error, error?.message).toBeNull();
  return data!.id as string;
}

async function seedProblemNote(
  forCompany: string,
  jobId: string,
  propertyId: string,
  createdBy: string,
  ageDays: number,
  reason: string,
): Promise<string> {
  const { data, error } = await admin!
    .from('cadenza_job_voice_notes')
    .insert({
      company_id: forCompany,
      job_id: jobId,
      property_id: propertyId,
      created_by: createdBy,
      storage_path: `${forCompany}/${jobId}/qa-seed.m4a`,
      status: 'done',
      transcript: reason,
      model_category: 'problem',
      model_urgency: 'high',
      model_reason: reason,
      category: 'problem',
      urgency: 'high',
      follow_up_status: 'open',
      created_at: daysAgoIso(ageDays),
    })
    .select('id')
    .single();
  expect(error, error?.message).toBeNull();
  return data!.id as string;
}

async function loginApi(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bypassHeaders });
  const login = await ctx.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(login.status(), await login.text()).toBe(200);
  return ctx;
}

test.beforeAll(async () => {
  admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Schema probe: skip cleanly if the KAN-153 migration (columns + RPC) is not applied.
  const reportProbe = await admin
    .from('cadenza_service_reports')
    .select('id, last_reviewed_at, last_reviewed_job_id, last_reviewed_by')
    .limit(1);
  const noteProbe = await admin
    .from('cadenza_job_voice_notes')
    .select('id, follow_up_status, last_reviewed_at')
    .limit(1);
  // The service role has no auth.uid(), so an existing RPC errors with not_authenticated;
  // a missing one reports PGRST202 / 42883.
  const rpcProbe = await admin.rpc('review_open_issue', {
    p_source: 'service_report',
    p_id: crypto.randomUUID(),
    p_review_job_id: crypto.randomUUID(),
    p_resolved: false,
  });
  const rpcMissing = rpcProbe.error?.code === 'PGRST202' || rpcProbe.error?.code === '42883';
  schemaReady = !reportProbe.error && !noteProbe.error && !rpcMissing;
  if (!schemaReady) {
    console.warn('KAN-153 migration not applied; E2E tests will be skipped');
    return;
  }

  const owner = await createTenant(OWNER_EMAIL, COMPANY_NAME, OWNER_NAME);
  companyId = owner.companyId;
  lateTechId = await createTechnician(LATE_TECH_EMAIL, 'QA Carry Late Tech', companyId);
  originTechId = await createTechnician(ORIGIN_TECH_EMAIL, 'QA Carry Origin Tech', companyId);

  const other = await createTenant(OTHER_EMAIL, OTHER_COMPANY_NAME, 'QA Carry Other Owner');
  otherCompanyId = other.companyId;
  const otherOwnerId = other.userId;

  // P1: flagged report (15d) + problem voice note (20d) on the origin visit; later visit today.
  const p1 = await seedProperty(companyId, `QA Carry One ${RUN_ID}`, '101 Test Pool Lane');
  const p1Origin = await seedJob(companyId, p1, originTechId, 'completed', 20);
  p1ReportId = await seedReport(companyId, p1Origin, originTechId, 15, ['motor'], 'Motor hums on start');
  p1NoteId = await seedProblemNote(companyId, p1Origin, p1, originTechId, 20, 'Pump seal is leaking');
  laterJobId = await seedJob(companyId, p1, lateTechId, 'pending', 0);
  s.p1 = { propertyId: p1, originJobId: p1Origin, name: `QA Carry One ${RUN_ID}` };

  // P2: problem voice note only (5d) — job has no flagged report (AC-4).
  const p2 = await seedProperty(companyId, `QA Carry Two ${RUN_ID}`, '202 Test Pool Lane');
  const p2Origin = await seedJob(companyId, p2, originTechId, 'completed', 5);
  p2NoteId = await seedProblemNote(companyId, p2Origin, p2, originTechId, 5, 'Skimmer basket cracked');
  s.p2 = { propertyId: p2, originJobId: p2Origin, name: `QA Carry Two ${RUN_ID}` };

  // P3: problem voice note (3d) that is later corrected to routine.
  const p3 = await seedProperty(companyId, `QA Carry Three ${RUN_ID}`, '303 Sample Harbor Road');
  const p3Origin = await seedJob(companyId, p3, originTechId, 'completed', 3);
  p3NoteId = await seedProblemNote(companyId, p3Origin, p3, originTechId, 3, 'Water looks a bit cloudy');
  s.p3 = { propertyId: p3, originJobId: p3Origin, name: `QA Carry Three ${RUN_ID}` };

  // P4: flagged report only (9d).
  const p4 = await seedProperty(companyId, `QA Carry Four ${RUN_ID}`, '404 Sample Harbor Road');
  const p4Origin = await seedJob(companyId, p4, originTechId, 'completed', 9);
  p4ReportId = await seedReport(companyId, p4Origin, originTechId, 9, ['filter'], 'Filter pressure high');
  s.p4 = { propertyId: p4, originJobId: p4Origin, name: `QA Carry Four ${RUN_ID}` };

  // An open issue in another tenant that must never appear for the owner (AC-6).
  const foreignProperty = await seedProperty(otherCompanyId, `QA Carry Foreign ${RUN_ID}`, '999 Other Tenant Way');
  // Reports require a non-null technician_id; use the other tenant's owner on this fixture.
  foreignJobId = await seedJob(otherCompanyId, foreignProperty, otherOwnerId, 'completed', 40);
  foreignReportId = await seedReport(otherCompanyId, foreignJobId, otherOwnerId, 40, ['other'], 'foreign tenant issue');

  ownerApi = await loginApi(OWNER_EMAIL);
  lateTechApi = await loginApi(LATE_TECH_EMAIL);
  otherApi = await loginApi(OTHER_EMAIL);
});

test.beforeEach(() => {
  test.skip(!schemaReady, 'KAN-153 migration not applied (review columns / review_open_issue missing)');
});

test.afterAll(async () => {
  await Promise.all(openContexts.map((c) => c.close().catch(() => {})));
  await Promise.all([ownerApi?.dispose(), lateTechApi?.dispose(), otherApi?.dispose()]);
  if (!admin) return;
  await cleanupBillingQaUsers(admin, { emailPrefix: `qa-billing-${RUN_ID}` });
});

type QueueIssue = { source: string; id: string; job_id: string; days_open: number };

async function queue(api: APIRequestContext, qs = ''): Promise<QueueIssue[]> {
  const res = await api.get(`/api/open-issues${qs}`);
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).data as QueueIssue[];
}

test('AC-3: dashboard shows days open, oldest first', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await ownerPage(browser);
  await uiLogin(page);
  await page.goto(`${BASE_URL}/en/dashboard`, { waitUntil: 'networkidle' });

  const rows = page.getByTestId('issue-job-row');
  await expect(rows).toHaveCount(4, { timeout: 30_000 });
  // P1 20d (oldest voice note), P4 9d, P2 5d, P3 3d.
  await expect(rows.nth(0)).toHaveAttribute('data-job-id', s.p1.originJobId);
  await expect(rows.nth(1)).toHaveAttribute('data-job-id', s.p4.originJobId);
  await expect(rows.nth(2)).toHaveAttribute('data-job-id', s.p2.originJobId);
  await expect(rows.nth(3)).toHaveAttribute('data-job-id', s.p3.originJobId);
  await expect(rows.nth(0).getByTestId('issue-days-open')).toHaveText('20 days open');
  await expect(rows.nth(1).getByTestId('issue-days-open')).toHaveText('9 days open');
  await expect(rows.nth(3).getByTestId('issue-days-open')).toHaveText('3 days open');

  // Another tenant's issue is never listed.
  await expect(page.getByText(`QA Carry Foreign ${RUN_ID}`)).toHaveCount(0);
});

test('AC-3 / AC-4: Jobs "Needs follow-up" shows age, sorts oldest-first, filters 7+/14+/30+', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await ownerPage(browser);
  await uiLogin(page);
  await page.goto(`${BASE_URL}/en/jobs?needs_follow_up=1`, { waitUntil: 'networkidle' });

  const rows = page.getByTestId('job-row');
  await expect(rows).toHaveCount(4, { timeout: 30_000 });
  await expect(rows.nth(0)).toHaveAttribute('data-job-id', s.p1.originJobId);
  await expect(rows.nth(0).getByTestId('job-days-open')).toHaveText('20 days open');
  await expect(rows.nth(1).getByTestId('job-days-open')).toHaveText('9 days open');
  // P2 has only a voice-note problem and still appears, with its age (AC-4).
  await expect(page.locator(`[data-testid="job-row"][data-job-id="${s.p2.originJobId}"]`)).toContainText('5 days open');

  await page.getByRole('button', { name: '7+ days' }).click();
  await expect(rows).toHaveCount(2);
  await expect(page.locator(`[data-testid="job-row"][data-job-id="${s.p2.originJobId}"]`)).toHaveCount(0);

  await page.getByRole('button', { name: '14+ days' }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-job-id', s.p1.originJobId);

  await page.getByRole('button', { name: '30+ days' }).click();
  await expect(rows).toHaveCount(0);

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(rows).toHaveCount(4);
});

test('AC-1 / AC-5: the later-job technician sees another technician\'s issues at the same property', async () => {
  const res = await lateTechApi.get(`/api/jobs/${laterJobId}/open-issues`);
  expect(res.status(), await res.text()).toBe(200);
  const { data } = (await res.json()) as { data: QueueIssue[] };
  expect(data.map((i) => `${i.source}:${i.id}`).sort()).toEqual(
    [`service_report:${p1ReportId}`, `voice_note:${p1NoteId}`].sort(),
  );
  expect(data.every((i) => i.job_id === s.p1.originJobId)).toBe(true);

  // Not on the job it was recorded on, and not at another property.
  const origin = await ownerApi.get(`/api/jobs/${s.p1.originJobId}/open-issues`);
  expect(((await origin.json()) as { data: unknown[] }).data).toEqual([]);
});

test('AC-5: review is rejected for other property, other company, and an unassigned technician', async () => {
  // Late tech reviewing P2's issue from the P1 job (different property).
  const wrongProperty = await lateTechApi.post('/api/open-issues/review', {
    data: { source: 'voice_note', id: p2NoteId, review_job_id: laterJobId, resolved: true },
  });
  expect(wrongProperty.status()).toBe(403);

  // The origin technician is not assigned to the later job.
  const originApi = await loginApi(ORIGIN_TECH_EMAIL);
  try {
    const unassigned = await originApi.post('/api/open-issues/review', {
      data: { source: 'service_report', id: p1ReportId, review_job_id: laterJobId, resolved: true },
    });
    expect(unassigned.status()).toBe(403);
  } finally {
    await originApi.dispose();
  }

  // Another company cannot touch this tenant's issue.
  const foreign = await otherApi.post('/api/open-issues/review', {
    data: { source: 'service_report', id: p1ReportId, review_job_id: laterJobId, resolved: true },
  });
  expect([403, 404]).toContain(foreign.status());

  // Nothing changed.
  const { data: report } = await admin!
    .from('cadenza_service_reports')
    .select('follow_up_status, last_reviewed_at')
    .eq('id', p1ReportId)
    .single();
  expect(report).toMatchObject({ follow_up_status: 'open', last_reviewed_at: null });
});

test('AC-2: Yes resolves and leaves the queue; No keeps it with a still-open review', async () => {
  // Yes on the report (technician assigned to the later job).
  const yes = await lateTechApi.post('/api/open-issues/review', {
    data: { source: 'service_report', id: p1ReportId, review_job_id: laterJobId, resolved: true },
  });
  expect(yes.status(), await yes.text()).toBe(200);

  // No on the voice note.
  const no = await lateTechApi.post('/api/open-issues/review', {
    data: { source: 'voice_note', id: p1NoteId, review_job_id: laterJobId, resolved: false, note: 'Still dripping' },
  });
  expect(no.status(), await no.text()).toBe(200);

  const after = await queue(ownerApi);
  expect(after.map((i) => i.id)).not.toContain(p1ReportId);
  expect(after.map((i) => i.id)).toContain(p1NoteId);
  // Resolving the report did not resolve the distinct voice note on the same job.
  expect(after.find((i) => i.id === p1NoteId)?.days_open).toBe(20);

  const { data: report } = await admin!
    .from('cadenza_service_reports')
    .select('follow_up_status, last_reviewed_at, last_reviewed_job_id, last_reviewed_by')
    .eq('id', p1ReportId)
    .single();
  expect(report).toMatchObject({
    follow_up_status: 'resolved',
    last_reviewed_job_id: laterJobId,
    last_reviewed_by: lateTechId,
  });
  expect(report?.last_reviewed_at).toBeTruthy();

  const { data: note } = await admin!
    .from('cadenza_job_voice_notes')
    .select('follow_up_status, last_reviewed_at, last_reviewed_job_id')
    .eq('id', p1NoteId)
    .single();
  expect(note).toMatchObject({ follow_up_status: 'open', last_reviewed_job_id: laterJobId });
  expect(note?.last_reviewed_at).toBeTruthy();

  const { data: actions } = await admin!
    .from('cadenza_job_follow_up_actions')
    .select('action_type, job_id, metadata')
    .eq('job_id', laterJobId);
  expect((actions ?? []).map((a) => a.action_type).sort()).toEqual(['resolved', 'still_open']);
  const still = (actions ?? []).find((a) => a.action_type === 'still_open');
  expect(still?.metadata).toMatchObject({
    source: 'voice_note',
    source_id: p1NoteId,
    origin_job_id: s.p1.originJobId,
  });
});

test('AC-4: a problem voice note leaves the queue after correction to routine', async ({ browser }) => {
  test.setTimeout(120_000);

  const before = await queue(ownerApi);
  const p3Note = before.find((i) => i.id === p3NoteId);
  expect(p3Note).toMatchObject({ source: 'voice_note', days_open: 3 });

  const page = await ownerPage(browser);
  await uiLogin(page);
  await page.goto(`${BASE_URL}/en/jobs?needs_follow_up=1`, { waitUntil: 'networkidle' });
  await expect(page.locator(`[data-testid="job-row"][data-job-id="${s.p3.originJobId}"]`)).toContainText('3 days open');

  const patch = await ownerApi.patch(`/api/voice-notes/${p3NoteId}`, { data: { category: 'routine' } });
  expect(patch.status(), await patch.text()).toBe(200);

  expect((await queue(ownerApi)).map((i) => i.id)).not.toContain(p3NoteId);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator(`[data-testid="job-row"][data-job-id="${s.p3.originJobId}"]`)).toHaveCount(0);
  // P2's untouched voice-note problem is still there.
  await expect(page.locator(`[data-testid="job-row"][data-job-id="${s.p2.originJobId}"]`)).toHaveCount(1);
});

test('AC-3: min_days on the queue API', async () => {
  const ids = async (qs: string) => (await queue(ownerApi, qs)).map((i) => i.id);
  // After AC-2/AC-4: the 15d P1 report is resolved and the 3d P3 note is routine.
  // Remaining >= 7 days: P1 voice note (20d) then P4 report (9d), oldest first.
  expect(await ids('?min_days=7')).toEqual([p1NoteId, p4ReportId]);
  expect(await ids('?min_days=30')).toEqual([]);
  expect((await ids('')).length).toBeGreaterThanOrEqual(3);
});

test('AC-6: unauthenticated calls return 401 and company scoping holds', async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bypassHeaders });
  try {
    expect((await anon.get('/api/open-issues')).status()).toBe(401);
    expect((await anon.get(`/api/jobs/${laterJobId}/open-issues`)).status()).toBe(401);
    const review = await anon.post('/api/open-issues/review', {
      data: { source: 'service_report', id: p1ReportId, review_job_id: laterJobId, resolved: true },
    });
    expect(review.status()).toBe(401);
  } finally {
    await anon.dispose();
  }

  const mine = await queue(ownerApi);
  expect(mine.map((i) => i.id)).not.toContain(foreignReportId);

  const theirs = await queue(otherApi);
  expect(theirs.map((i) => i.id)).toEqual([foreignReportId]);

  // The other company cannot read this tenant's carry-forward items.
  const cross = await otherApi.get(`/api/jobs/${laterJobId}/open-issues`);
  expect(cross.status()).toBe(404);
  const foreignOwn = await ownerApi.get(`/api/jobs/${foreignJobId}/open-issues`);
  expect(foreignOwn.status()).toBe(404);
});
