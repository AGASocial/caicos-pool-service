/**
 * Monday digest of open issues E2E — KAN-154.
 *
 * Uses ephemeral qa-billing-* tenants (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) and seeds
 * reports / voice-note rows directly. No email is sent and nothing is charged: the cron is only
 * ever called while the digest flag is off (see the AC-3 guard below), and the send path (AC-4)
 * is covered by mocked unit tests (src/lib/__tests__/monday-digest.test.ts).
 * Skips cleanly when env vars are missing or a required migration is not applied.
 * Set RECORD_VIDEO=1 to save a video to test-results/kan154-video.
 *
 * AC coverage: AC-1 + AC-2 (office screen grouped by technician, days open, property / issue
 * identity, job link), AC-3 (unauthenticated cron 401; authorized cron with the flag off =>
 * 200 skipped and no send-log row), AC-5 (company scoping; technicians cannot load the data).
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
const CRON_SECRET = process.env.CRON_SECRET;

const HAS_SERVICE = Boolean(SUPABASE_URL && SERVICE_KEY);

const RUN_ID = `md${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const OWNER_EMAIL = `qa-billing-${RUN_ID}@cadenzaops.com`;
const ALPHA_EMAIL = `qa-billing-${RUN_ID}-alpha@cadenzaops.com`;
const BRAVO_EMAIL = `qa-billing-${RUN_ID}-bravo@cadenzaops.com`;
const OTHER_EMAIL = `qa-billing-${RUN_ID}-other@cadenzaops.com`;
const COMPANY_NAME = `QA Billing Monday Digest ${RUN_ID}`;
const OTHER_COMPANY_NAME = `QA Billing Monday Digest Other ${RUN_ID}`;
const ALPHA_NAME = 'QA Digest Alpha';
const BRAVO_NAME = 'QA Digest Bravo';
const PASSWORD = `Qa!${crypto.randomBytes(18).toString('base64url')}`;

test.describe.configure({ mode: 'serial' });
test.skip(!HAS_SERVICE, 'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required to seed open issues');

let admin: SupabaseClient | undefined;
let companyId = '';
let otherCompanyId = '';
let schemaReady = false;
let ownerApi: APIRequestContext;
let alphaApi: APIRequestContext;
let otherApi: APIRequestContext;
const openContexts: BrowserContext[] = [];

type Scenario = { propertyId: string; jobId: string; name: string; address: string };
const s = {} as Record<'alpha' | 'bravo' | 'unassigned', Scenario>;
let alphaReportId = '';
let alphaNoteId = '';
let bravoNoteId = '';
let unassignedNoteId = '';
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

async function newPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    ...(process.env.RECORD_VIDEO
      ? {
          recordVideo: { dir: 'test-results/kan154-video', size: { width: 1280, height: 800 } },
          viewport: { width: 1280, height: 800 },
        }
      : {}),
  });
  openContexts.push(ctx);
  return ctx.newPage();
}

async function uiLogin(page: Page, email: string) {
  await page.goto(`${BASE_URL}/en/auth/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByLabel(/email/i).fill(email);
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
  // No customer email on purpose: the digest must never need one.
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
  ageDays: number,
): Promise<string> {
  const { data, error } = await admin!
    .from('cadenza_service_jobs')
    .insert({
      company_id: forCompany,
      property_id: propertyId,
      technician_id: technicianId,
      scheduled_date: daysAgoIso(ageDays).slice(0, 10),
      status: 'completed',
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
  technicianId: string,
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
      notes: 'QA monday digest seed',
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

  // Schema probe: skip cleanly if the KAN-153 columns or the KAN-154 send-log table are missing.
  const reportProbe = await admin
    .from('cadenza_service_reports')
    .select('id, last_reviewed_at')
    .limit(1);
  const noteProbe = await admin
    .from('cadenza_job_voice_notes')
    .select('id, follow_up_status')
    .limit(1);
  const sendLogProbe = await admin.from('cadenza_monday_digest_sends').select('id').limit(1);
  schemaReady = !reportProbe.error && !noteProbe.error && !sendLogProbe.error;
  if (!schemaReady) {
    console.warn('KAN-153 / KAN-154 migrations not applied; E2E tests will be skipped');
    return;
  }

  const owner = await createTenant(OWNER_EMAIL, COMPANY_NAME, 'QA Digest Owner');
  companyId = owner.companyId;
  const alphaId = await createTechnician(ALPHA_EMAIL, ALPHA_NAME, companyId);
  const bravoId = await createTechnician(BRAVO_EMAIL, BRAVO_NAME, companyId);

  const other = await createTenant(OTHER_EMAIL, OTHER_COMPANY_NAME, 'QA Digest Other Owner');
  otherCompanyId = other.companyId;

  // Alpha: flagged report (12d) + problem voice note (6d), on two properties' jobs.
  const alphaName = `QA Digest Alpha Pool ${RUN_ID}`;
  const alphaAddress = '101 Test Pool Lane';
  const alphaProperty = await seedProperty(companyId, alphaName, alphaAddress);
  const alphaJob = await seedJob(companyId, alphaProperty, alphaId, 12);
  alphaReportId = await seedReport(companyId, alphaJob, alphaId, 12, ['motor'], 'Motor hums on start');
  const alphaNoteJob = await seedJob(companyId, alphaProperty, alphaId, 6);
  alphaNoteId = await seedProblemNote(companyId, alphaNoteJob, alphaProperty, alphaId, 6, 'Skimmer basket cracked');
  s.alpha = { propertyId: alphaProperty, jobId: alphaJob, name: alphaName, address: alphaAddress };

  // Bravo: problem voice note (20d).
  const bravoName = `QA Digest Bravo Pool ${RUN_ID}`;
  const bravoAddress = '202 Test Pool Lane';
  const bravoProperty = await seedProperty(companyId, bravoName, bravoAddress);
  const bravoJob = await seedJob(companyId, bravoProperty, bravoId, 20);
  bravoNoteId = await seedProblemNote(companyId, bravoJob, bravoProperty, bravoId, 20, 'Pump seal is leaking');
  s.bravo = { propertyId: bravoProperty, jobId: bravoJob, name: bravoName, address: bravoAddress };

  // Unassigned: the origin job has no technician (voice note authored by the owner).
  const unName = `QA Digest Unassigned Pool ${RUN_ID}`;
  const unAddress = '303 Sample Harbor Road';
  const unProperty = await seedProperty(companyId, unName, unAddress);
  const unJob = await seedJob(companyId, unProperty, null, 4);
  unassignedNoteId = await seedProblemNote(companyId, unJob, unProperty, owner.userId, 4, 'Water looks cloudy');
  s.unassigned = { propertyId: unProperty, jobId: unJob, name: unName, address: unAddress };

  // An open issue in another tenant that must never appear for the owner (AC-5).
  const foreignProperty = await seedProperty(otherCompanyId, `QA Digest Foreign ${RUN_ID}`, '999 Other Tenant Way');
  const foreignJob = await seedJob(otherCompanyId, foreignProperty, other.userId, 40);
  foreignReportId = await seedReport(otherCompanyId, foreignJob, other.userId, 40, ['other'], 'foreign tenant issue');

  ownerApi = await loginApi(OWNER_EMAIL);
  alphaApi = await loginApi(ALPHA_EMAIL);
  otherApi = await loginApi(OTHER_EMAIL);
});

test.beforeEach(() => {
  test.skip(!schemaReady, 'KAN-153 / KAN-154 migrations not applied (open-issue columns / send-log table missing)');
});

test.afterAll(async () => {
  await Promise.all(openContexts.map((c) => c.close().catch(() => {})));
  await Promise.all([ownerApi?.dispose(), alphaApi?.dispose(), otherApi?.dispose()]);
  if (!admin) return;
  await cleanupBillingQaUsers(admin, { emailPrefix: `qa-billing-${RUN_ID}` });
});

type ApiIssue = {
  source: string;
  id: string;
  job_id: string;
  days_open: number;
  technician_id: string | null;
  technician_name: string | null;
  property: { customer_name: string; address: string } | null;
};

async function issues(api: APIRequestContext): Promise<ApiIssue[]> {
  const res = await api.get('/api/open-issues');
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).data as ApiIssue[];
}

test('AC-1 / AC-2: office screen groups open issues by technician with days open and property / issue identity', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await newPage(browser);
  await uiLogin(page, OWNER_EMAIL);
  await page.goto(`${BASE_URL}/en/open-issues`, { waitUntil: 'networkidle' });

  const groups = page.getByTestId('technician-group');
  await expect(groups).toHaveCount(3, { timeout: 30_000 });
  // Named technicians alphabetically, unassigned last.
  await expect(groups.nth(0).getByTestId('technician-group-name')).toHaveText(ALPHA_NAME);
  await expect(groups.nth(1).getByTestId('technician-group-name')).toHaveText(BRAVO_NAME);
  await expect(groups.nth(2).getByTestId('technician-group-name')).toHaveText('Unassigned');
  await expect(groups.nth(0).getByTestId('technician-group-count')).toHaveText('2 open issues');

  // Alpha: report (12d) first, then voice note (6d): oldest first inside the group.
  const alphaRows = groups.nth(0).getByTestId('open-issue-row');
  await expect(alphaRows).toHaveCount(2);
  await expect(alphaRows.nth(0)).toHaveAttribute('data-issue-id', alphaReportId);
  await expect(alphaRows.nth(0).getByTestId('issue-days-open')).toHaveText('12 days open');
  await expect(alphaRows.nth(0).getByTestId('issue-property')).toHaveText(s.alpha.name);
  await expect(alphaRows.nth(0)).toContainText(s.alpha.address);
  await expect(alphaRows.nth(0).getByTestId('issue-source')).toHaveText('Visit report');
  await expect(alphaRows.nth(0)).toContainText('Motor');
  await expect(alphaRows.nth(0)).toContainText('Motor hums on start');
  await expect(alphaRows.nth(1)).toHaveAttribute('data-issue-id', alphaNoteId);
  await expect(alphaRows.nth(1).getByTestId('issue-days-open')).toHaveText('6 days open');
  await expect(alphaRows.nth(1).getByTestId('issue-source')).toHaveText('Voice note problem');

  // Each row links to its origin job.
  await expect(alphaRows.nth(0).getByRole('link')).toHaveAttribute('href', new RegExp(`/jobs/${s.alpha.jobId}$`));

  const bravoRow = groups.nth(1).getByTestId('open-issue-row');
  await expect(bravoRow).toHaveCount(1);
  await expect(bravoRow.getByTestId('issue-days-open')).toHaveText('20 days open');
  await expect(bravoRow.getByTestId('issue-property')).toHaveText(s.bravo.name);

  const unassignedRow = groups.nth(2).getByTestId('open-issue-row');
  await expect(unassignedRow).toHaveCount(1);
  await expect(unassignedRow.getByTestId('issue-days-open')).toHaveText('4 days open');

  // Technician filter narrows the list.
  await page.getByTestId('technician-filter').selectOption({ label: BRAVO_NAME });
  await expect(groups).toHaveCount(1);
  await expect(groups.first().getByTestId('technician-group-name')).toHaveText(BRAVO_NAME);
  await page.getByTestId('technician-filter').selectOption({ label: 'Unassigned' });
  await expect(groups).toHaveCount(1);
  await expect(groups.first().getByTestId('open-issue-row')).toHaveAttribute('data-issue-id', unassignedNoteId);
  await page.getByTestId('technician-filter').selectOption({ label: 'All technicians' });
  await expect(groups).toHaveCount(3);

  // Another tenant's issue is never listed.
  await expect(page.getByText(`QA Digest Foreign ${RUN_ID}`)).toHaveCount(0);
  // Nothing has been emailed for this tenant.
  await expect(page.getByTestId('digest-last-sent')).toContainText('No Monday digest has been emailed yet');
});

test('AC-1: Jobs page links office users to the open-issues screen', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await newPage(browser);
  await uiLogin(page, OWNER_EMAIL);
  await page.goto(`${BASE_URL}/en/jobs`, { waitUntil: 'networkidle' });
  await page.getByTestId('open-issues-link').click();
  await page.waitForURL(/\/en\/open-issues$/, { timeout: 30_000 });
  await expect(page.getByTestId('open-issues-page')).toBeVisible();
});

test('AC-1 / AC-2: /api/open-issues carries technician and property fields', async () => {
  const rows = await issues(ownerApi);
  const byId = new Map(rows.map((r) => [r.id, r]));
  expect(byId.get(alphaReportId)).toMatchObject({
    source: 'service_report',
    days_open: 12,
    technician_name: ALPHA_NAME,
    property: { customer_name: s.alpha.name, address: s.alpha.address },
  });
  expect(byId.get(alphaNoteId)).toMatchObject({ source: 'voice_note', days_open: 6, technician_name: ALPHA_NAME });
  expect(byId.get(bravoNoteId)).toMatchObject({ days_open: 20, technician_name: BRAVO_NAME });
  expect(byId.get(unassignedNoteId)).toMatchObject({ days_open: 4, technician_id: null, technician_name: null });
  expect(rows.map((r) => r.days_open)).toEqual([...rows.map((r) => r.days_open)].sort((a, b) => b - a));
});

test('AC-3: unauthenticated cron returns 401', async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bypassHeaders });
  try {
    expect((await anon.get('/api/cron/monday-digest')).status()).toBe(401);
    const wrong = await anon.get('/api/cron/monday-digest', {
      headers: { authorization: `Bearer wrong-${crypto.randomBytes(8).toString('hex')}` },
    });
    expect(wrong.status()).toBe(401);
    // An office session is not a cron credential either.
    expect((await ownerApi.get('/api/cron/monday-digest')).status()).toBe(401);
  } finally {
    await anon.dispose();
  }
});

test('AC-3: authorized cron with the flag off returns 200 skipped and writes no send-log row', async () => {
  const flag = (process.env.MONDAY_DIGEST_ENABLED ?? '').trim().toLowerCase();
  test.skip(!CRON_SECRET, 'CRON_SECRET required to call the cron route');
  // Safety: this call must never be able to send. The runner env mirrors a local server, and
  // production hosts are never called with the cron secret from E2E.
  test.skip(['1', 'true', 'yes'].includes(flag), 'MONDAY_DIGEST_ENABLED is on in this environment; refusing to call the cron');
  test.skip(/(^|\/\/|\.)cadenzaops\.com(\/|$)/i.test(BASE_URL), 'Refusing to call the cron on a production host');

  const cron = await pwRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { ...bypassHeaders, authorization: `Bearer ${CRON_SECRET}` },
  });
  try {
    const res = await cron.get('/api/cron/monday-digest');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: true, reason: 'disabled' });
  } finally {
    await cron.dispose();
  }

  const { data, error } = await admin!
    .from('cadenza_monday_digest_sends')
    .select('id')
    .eq('company_id', companyId);
  expect(error, error?.message).toBeNull();
  expect(data).toEqual([]);
});

test('AC-5: technicians cannot read the digest data; other companies only see their own issues', async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bypassHeaders });
  try {
    expect((await anon.get('/api/open-issues')).status()).toBe(401);
    expect((await anon.get('/api/open-issues/digest-status')).status()).toBe(401);
  } finally {
    await anon.dispose();
  }

  expect((await alphaApi.get('/api/open-issues')).status()).toBe(403);
  expect((await alphaApi.get('/api/open-issues/digest-status')).status()).toBe(403);

  const mine = await issues(ownerApi);
  expect(mine.map((i) => i.id)).not.toContain(foreignReportId);

  const theirs = await issues(otherApi);
  expect(theirs.map((i) => i.id)).toEqual([foreignReportId]);
  expect(theirs[0].technician_name).toBe('QA Digest Other Owner');
});

test('AC-5: the last-sent cue is company scoped (seeded send-log row, no email involved)', async ({ browser }) => {
  test.setTimeout(120_000);
  const sentAt = new Date().toISOString();
  const { error } = await admin!.from('cadenza_monday_digest_sends').insert({
    company_id: companyId,
    week_start: sentAt.slice(0, 10),
    recipient_email: OWNER_EMAIL,
    issue_count: 4,
    sent_at: sentAt,
  });
  expect(error, error?.message).toBeNull();

  const mine = await ownerApi.get('/api/open-issues/digest-status');
  expect(mine.status()).toBe(200);
  expect((await mine.json()).data.last_sent_at).toBeTruthy();

  const theirs = await otherApi.get('/api/open-issues/digest-status');
  expect(theirs.status()).toBe(200);
  expect((await theirs.json()).data.last_sent_at).toBeNull();

  const page = await newPage(browser);
  await uiLogin(page, OWNER_EMAIL);
  await page.goto(`${BASE_URL}/en/open-issues`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('digest-last-sent')).toContainText('Monday digest last emailed');
});
