/**
 * Report delivery log E2E — KAN-152.
 *
 * Uses an ephemeral qa-billing-* tenant (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) and seeds
 * delivery log rows directly, so no customer email is ever sent by the seeding itself.
 * Skips cleanly when env vars are missing or the KAN-152 migration is not applied.
 * Set RECORD_VIDEO=1 to save a video to test-results/kan152-video.
 *
 * AC coverage: AC-6 (company scoping), AC-9 (Unsent view, tabs, i18n), AC-10 (property search),
 * AC-11 (job / property indicator), AC-12 (retry action), AC-13 (tenant lifecycle).
 *
 * Seeded jobs are intentionally NOT `completed` (except the retry fixture) and failed rows are
 * at the automatic-retry cap, so the KAN-151 cron cannot change them while the test runs.
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

const RUN_ID = `dl${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const OWNER_EMAIL = `qa-billing-${RUN_ID}@cadenzaops.com`;
const OTHER_EMAIL = `qa-billing-${RUN_ID}-other@cadenzaops.com`;
const COMPANY_NAME = `QA Billing Delivery Log ${RUN_ID}`;
const OTHER_COMPANY_NAME = `QA Billing Delivery Log Other ${RUN_ID}`;
const OWNER_NAME = 'QA Delivery Owner';
const PASSWORD = `Qa!${crypto.randomBytes(18).toString('base64url')}`;

test.describe.configure({ mode: 'serial' });
test.skip(!HAS_SERVICE, 'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required to seed delivery log rows');

let admin: SupabaseClient | undefined;
let ownerId = '';
let companyId = '';
let otherCompanyId = '';
let schemaReady = false;
let api: APIRequestContext;
const openContexts: BrowserContext[] = [];

type Seeded = { propertyId: string; jobId: string; deliveryId: string; name: string };
const seeded = {} as Record<'sent' | 'failed' | 'pending' | 'skipped', Seeded>;
let otherJobId = '';

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
          recordVideo: { dir: 'test-results/kan152-video', size: { width: 1280, height: 800 } },
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

async function seedPropertyAndJob(
  forCompany: string,
  opts: {
    name: string;
    address: string;
    email: string;
    jobStatus?: string;
    serviceEventTypes?: string[];
  },
): Promise<{ propertyId: string; jobId: string }> {
  const { data: property, error: propErr } = await admin!
    .from('cadenza_properties')
    .insert({
      company_id: forCompany,
      customer_name: opts.name,
      customer_email: opts.email,
      address: opts.address,
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      pool_type: 'residential',
      is_active: true,
    })
    .select('id')
    .single();
  expect(propErr, propErr?.message).toBeNull();

  const { data: job, error: jobErr } = await admin!
    .from('cadenza_service_jobs')
    .insert({
      company_id: forCompany,
      property_id: property!.id,
      technician_id: forCompany === companyId ? ownerId : null,
      scheduled_date: new Date().toISOString().slice(0, 10),
      status: opts.jobStatus ?? 'pending',
      job_source: 'ad_hoc',
      estimated_duration_min: 30,
      has_paid_extras: false,
      send_paid_extra_report: false,
    })
    .select('id')
    .single();
  expect(jobErr, jobErr?.message).toBeNull();

  if (opts.serviceEventTypes && forCompany === companyId) {
    const { error: reportErr } = await admin!.from('cadenza_service_reports').insert({
      job_id: job!.id,
      company_id: forCompany,
      technician_id: ownerId,
      service_event_types: opts.serviceEventTypes,
      notes: 'QA delivery log seed',
    });
    expect(reportErr, reportErr?.message).toBeNull();
  }
  return { propertyId: property!.id as string, jobId: job!.id as string };
}

async function seedDelivery(
  forCompany: string,
  row: {
    propertyId: string;
    jobId: string;
    recipient: string;
    status: 'sent' | 'failed' | 'queued' | 'skipped';
    reason?: string | null;
    triggerSource?: 'auto' | 'manual' | 'retry';
    triggeredBy?: string | null;
    attemptCount?: number;
    updatedAt?: string;
  },
): Promise<string> {
  const { data, error } = await admin!
    .from('customer_report_deliveries')
    .insert({
      company_id: forCompany,
      job_id: row.jobId,
      property_id: row.propertyId,
      recipient: row.recipient,
      status: row.status,
      reason: row.reason ?? null,
      trigger_source: row.triggerSource ?? 'auto',
      triggered_by: row.triggeredBy ?? null,
      attempt_count: row.attemptCount ?? 1,
      updated_at: row.updatedAt ?? new Date().toISOString(),
    })
    .select('id')
    .single();
  expect(error, error?.message).toBeNull();
  return data!.id as string;
}

async function seedScenario(
  key: keyof typeof seeded,
  opts: {
    label: string;
    address: string;
    status: 'sent' | 'failed' | 'queued' | 'skipped';
    reason?: string;
    triggerSource?: 'auto' | 'manual' | 'retry';
    triggeredBy?: string | null;
    attemptCount?: number;
    updatedAt?: string;
  },
) {
  const name = `QA ${opts.label} ${RUN_ID}`;
  const email = `delivered+${opts.label.toLowerCase()}@resend.dev`;
  const { propertyId, jobId } = await seedPropertyAndJob(companyId, {
    name,
    address: opts.address,
    email,
  });
  const deliveryId = await seedDelivery(companyId, {
    propertyId,
    jobId,
    recipient: email,
    status: opts.status,
    reason: opts.reason,
    triggerSource: opts.triggerSource,
    triggeredBy: opts.triggeredBy,
    attemptCount: opts.attemptCount,
    updatedAt: opts.updatedAt,
  });
  seeded[key] = { propertyId, jobId, deliveryId, name };
}

test.beforeAll(async () => {
  admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Schema probe: skip cleanly if the KAN-152 migration is not applied.
  const probe = await admin
    .from('customer_report_deliveries')
    .select('id, property_id, trigger_source, triggered_by, attempt_count, updated_at')
    .limit(1);
  schemaReady = !probe.error;
  if (!schemaReady) {
    console.warn('KAN-152 delivery log columns missing; E2E tests will be skipped');
    return;
  }

  const owner = await createTenant(OWNER_EMAIL, COMPANY_NAME, OWNER_NAME);
  ownerId = owner.userId;
  companyId = owner.companyId;

  const other = await createTenant(OTHER_EMAIL, OTHER_COMPANY_NAME, 'QA Delivery Other Owner');
  otherCompanyId = other.companyId;

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();

  await seedScenario('sent', {
    label: 'Alpha',
    address: '101 Test Pool Lane',
    status: 'sent',
    triggerSource: 'retry',
    triggeredBy: ownerId,
    attemptCount: 2,
  });
  // Failed rows sit at the auto-retry cap so the cron leaves them alone.
  await seedScenario('failed', {
    label: 'Beta',
    address: '202 Test Pool Lane',
    status: 'failed',
    reason: 'mailbox unavailable',
    attemptCount: 3,
  });
  await seedScenario('pending', {
    label: 'Gamma',
    address: '303 Sample Harbor Road',
    status: 'queued',
    updatedAt: hourAgo,
  });
  await seedScenario('skipped', {
    label: 'Delta',
    address: '404 Sample Harbor Road',
    status: 'skipped',
    reason: 'no_customer_email',
  });

  // A delivery in another tenant that must never appear for the owner.
  const foreign = await seedPropertyAndJob(otherCompanyId, {
    name: `QA Foreign ${RUN_ID}`,
    address: '999 Other Tenant Way',
    email: 'delivered+foreign@resend.dev',
  });
  otherJobId = foreign.jobId;
  await seedDelivery(otherCompanyId, {
    propertyId: foreign.propertyId,
    jobId: foreign.jobId,
    recipient: 'delivered+foreign@resend.dev',
    status: 'failed',
    reason: 'foreign tenant failure',
    attemptCount: 3,
  });

  api = await pwRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bypassHeaders });
  const login = await api.post('/api/auth/login', {
    data: { email: OWNER_EMAIL, password: PASSWORD },
  });
  expect(login.status(), await login.text()).toBe(200);
});

test.beforeEach(() => {
  test.skip(!schemaReady, 'KAN-152 migration not applied (customer_report_deliveries columns missing)');
});

test.afterAll(async () => {
  await Promise.all(openContexts.map((c) => c.close().catch(() => {})));
  await api?.dispose();
  if (!admin) return;
  await cleanupBillingQaUsers(admin, { emailPrefix: `qa-billing-${RUN_ID}` });
});

async function openLog(page: Page, query = '', locale = 'en') {
  await page.goto(`${BASE_URL}/${locale}/reports/deliveries${query}`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('report-delivery-log')).toBeVisible({ timeout: 30_000 });
}

test('AC-9: Unsent view is the default and shows pending + failed only', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await ownerPage(browser);
  await uiLogin(page);
  await openLog(page);

  await expect(page.getByTestId('delivery-tab-unsent')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('unsent-count')).toHaveText('2');

  const rows = page.getByTestId('delivery-row');
  await expect(rows).toHaveCount(2);
  await expect(page.locator('[data-testid="delivery-row"][data-status="failed"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="delivery-row"][data-status="pending"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="delivery-row"][data-status="sent"]')).toHaveCount(0);

  // Failed row shows recipient, property, error reason and the automatic actor.
  const failed = page.locator('[data-testid="delivery-row"][data-status="failed"]');
  await expect(failed.getByTestId('delivery-recipient')).toContainText('delivered+beta@resend.dev');
  await expect(failed.getByTestId('delivery-property')).toContainText(seeded.failed.name);
  await expect(failed.getByTestId('delivery-reason')).toContainText('mailbox unavailable');
  await expect(failed.getByTestId('delivery-actor')).toHaveText('Automatic');
  await expect(failed.getByTestId('delivery-job-link')).toHaveAttribute(
    'href',
    new RegExp(`/jobs/${seeded.failed.jobId}$`),
  );

  // Nothing from the other tenant leaks in.
  await expect(page.getByText('foreign tenant failure')).toHaveCount(0);
  await expect(page.getByText(`QA Foreign ${RUN_ID}`)).toHaveCount(0);
});

test('AC-9: All / Sent / Failed / Pending tabs and user actor', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await ownerPage(browser);
  await uiLogin(page);
  await openLog(page);

  await page.getByTestId('delivery-tab-all').click();
  await expect(page.getByTestId('delivery-row')).toHaveCount(4);

  await page.getByTestId('delivery-tab-sent').click();
  const sent = page.getByTestId('delivery-row');
  await expect(sent).toHaveCount(1);
  await expect(sent.first()).toHaveAttribute('data-status', 'sent');
  // Sent by a person via manual retry → their name, not "Automatic".
  await expect(sent.first().getByTestId('delivery-actor')).toHaveText(OWNER_NAME);

  await page.getByTestId('delivery-tab-failed').click();
  await expect(page.getByTestId('delivery-row')).toHaveCount(1);
  await expect(page.getByTestId('delivery-row').first()).toHaveAttribute('data-status', 'failed');

  await page.getByTestId('delivery-tab-pending').click();
  await expect(page.getByTestId('delivery-row')).toHaveCount(1);
  await expect(page.getByTestId('delivery-row').first()).toHaveAttribute('data-status', 'pending');
});

test('AC-10: searching by property answers whether its report was sent', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await ownerPage(browser);
  await uiLogin(page);
  await openLog(page);
  await page.getByTestId('delivery-tab-all').click();

  const search = page.getByTestId('delivery-search');

  await search.fill(seeded.sent.name);
  await expect(page.getByTestId('delivery-row')).toHaveCount(1);
  await expect(page.getByTestId('delivery-row').first()).toHaveAttribute('data-status', 'sent');

  await search.fill(seeded.failed.name);
  await expect(page.getByTestId('delivery-row')).toHaveCount(1);
  await expect(page.getByTestId('delivery-row').first()).toHaveAttribute('data-status', 'failed');

  // By street address fragment
  await search.fill('Sample Harbor Road');
  await expect(page.getByTestId('delivery-row')).toHaveCount(2);

  // By recipient
  await search.fill('delivered+gamma@resend.dev');
  await expect(page.getByTestId('delivery-row')).toHaveCount(1);
  await expect(page.getByTestId('delivery-row').first()).toHaveAttribute('data-status', 'pending');

  await search.fill('no-such-property-xyz');
  await expect(page.getByTestId('delivery-empty')).toBeVisible();
});

test('AC-5/AC-6: API filters and company scoping', async () => {
  const list = async (qs: string) => {
    const res = await api.get(`/api/report-deliveries${qs}`);
    expect(res.status(), await res.text()).toBe(200);
    return (await res.json()) as {
      data: Array<{ id: string; status: string; job: { id: string }; property: { id: string } | null }>;
      pagination: { total: number; hasMore: boolean };
      unsent_count: number;
    };
  };

  const unsent = await list('?status=unsent');
  expect(unsent.data.map((r) => r.status).sort()).toEqual(['failed', 'pending']);
  expect(unsent.unsent_count).toBe(2);

  const all = await list('');
  expect(all.pagination.total).toBe(4);
  expect(all.data.some((r) => r.job.id === otherJobId)).toBe(false);

  const byProperty = await list(`?property_id=${seeded.failed.propertyId}`);
  expect(byProperty.data).toHaveLength(1);
  expect(byProperty.data[0].status).toBe('failed');

  const byJob = await list(`?job_id=${seeded.sent.jobId}`);
  expect(byJob.data).toHaveLength(1);
  expect(byJob.data[0].status).toBe('sent');

  // The other tenant's job is invisible even when asked for explicitly.
  const foreign = await list(`?job_id=${otherJobId}`);
  expect(foreign.data).toHaveLength(0);

  const today = new Date().toISOString().slice(0, 10);
  const inRange = await list(`?date_from=${today}&date_to=${today}`);
  expect(inRange.pagination.total).toBeGreaterThanOrEqual(1);
  const past = await list('?date_from=2000-01-01&date_to=2000-01-02');
  expect(past.data).toHaveLength(0);

  const paged = await list('?limit=2&page=1');
  expect(paged.data).toHaveLength(2);
  expect(paged.pagination.hasMore).toBe(true);
  const page2 = await list('?limit=2&page=2');
  expect(page2.data).toHaveLength(2);
  expect(page2.pagination.hasMore).toBe(false);

  const bad = await api.get('/api/report-deliveries?property_id=nope');
  expect(bad.status()).toBe(400);
});

test('AC-6: unauthenticated callers get 401', async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bypassHeaders });
  try {
    const res = await anon.get('/api/report-deliveries');
    expect(res.status()).toBe(401);
    const retry = await anon.post(`/api/report-deliveries/${seeded.failed.deliveryId}/retry`, { data: {} });
    expect(retry.status()).toBe(401);
  } finally {
    await anon.dispose();
  }
});

test('AC-11: job and property detail show the delivery status', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await ownerPage(browser);
  await uiLogin(page);

  await page.goto(`${BASE_URL}/en/jobs/${seeded.failed.jobId}`, { waitUntil: 'networkidle' });
  const jobCard = page.getByTestId('job-delivery-indicator');
  await expect(jobCard).toBeVisible({ timeout: 30_000 });
  await expect(jobCard.getByTestId('delivery-status-badge')).toHaveAttribute('data-status', 'failed');
  await expect(jobCard.getByTestId('delivery-indicator-reason')).toContainText('mailbox unavailable');

  await page.goto(`${BASE_URL}/en/properties/${seeded.sent.propertyId}`, { waitUntil: 'networkidle' });
  const propertyCard = page.getByTestId('property-delivery-indicator');
  await expect(propertyCard).toBeVisible({ timeout: 30_000 });
  await expect(propertyCard.getByTestId('delivery-status-badge')).toHaveAttribute('data-status', 'sent');
  await expect(propertyCard.getByTestId('delivery-indicator-recipient')).toContainText(
    'delivered+alpha@resend.dev',
  );

  // The link opens the log filtered to this property, starting on All.
  await propertyCard.getByRole('link').click();
  await page.waitForURL(/\/reports\/deliveries\?property_id=/);
  await expect(page.getByTestId('delivery-tab-all')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('delivery-row')).toHaveCount(1);
  await expect(page.getByTestId('delivery-row').first()).toHaveAttribute('data-status', 'sent');
});

test('AC-9: log is reachable from Reports and navigation', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await ownerPage(browser);
  await uiLogin(page);

  await page.goto(`${BASE_URL}/en/reports`, { waitUntil: 'networkidle' });
  await page.getByTestId('report-delivery-log-link').click();
  await page.waitForURL(/\/reports\/deliveries/);
  await expect(page.getByRole('heading', { name: /report delivery log/i })).toBeVisible();

  await page.goto(`${BASE_URL}/en/dashboard`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /report delivery/i }).first().click();
  await page.waitForURL(/\/reports\/deliveries/);
});

test('AC-9: Spanish messages', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await ownerPage(browser);
  await uiLogin(page);
  await openLog(page, '', 'es');

  await expect(page.getByRole('heading', { name: /registro de envío de reportes/i })).toBeVisible();
  await expect(page.getByTestId('delivery-tab-unsent')).toContainText(/sin enviar/i);
  await expect(page.getByTestId('delivery-tab-all')).toContainText(/todos/i);
  await expect(page.getByTestId('delivery-tab-sent')).toContainText(/enviados/i);
  const failed = page.locator('[data-testid="delivery-row"][data-status="failed"]');
  await expect(failed.getByTestId('delivery-actor')).toHaveText(/automático/i);
});

test('AC-12: retry action only for failed / pending rows, and it records the actor', async ({
  browser,
}) => {
  test.setTimeout(180_000);

  // Dedicated completed job so the retry can legitimately re-process (sends only to the test sink).
  const retryName = `QA Omega ${RUN_ID}`;
  const retryEmail = 'delivered+omega@resend.dev';
  const { propertyId, jobId } = await seedPropertyAndJob(companyId, {
    name: retryName,
    address: '505 Test Pool Lane',
    email: retryEmail,
    jobStatus: 'completed',
    serviceEventTypes: ['filter_change'],
  });
  const retryDeliveryId = await seedDelivery(companyId, {
    propertyId,
    jobId,
    recipient: retryEmail,
    status: 'failed',
    reason: 'mailbox unavailable',
    attemptCount: 3, // cron-capped
  });

  const page = await ownerPage(browser);
  await uiLogin(page);
  await openLog(page);

  // Visible for failed + pending, absent for sent.
  await expect(page.getByTestId(`retry-delivery-${seeded.failed.deliveryId}`)).toBeVisible();
  await expect(page.getByTestId(`retry-delivery-${seeded.pending.deliveryId}`)).toBeVisible();
  await page.getByTestId('delivery-tab-sent').click();
  await expect(page.getByTestId('delivery-row')).toHaveCount(1);
  await expect(page.getByTestId(`retry-delivery-${seeded.sent.deliveryId}`)).toHaveCount(0);
  await page.getByTestId('delivery-tab-unsent').click();

  const retryButton = page.getByTestId(`retry-delivery-${retryDeliveryId}`);
  await expect(retryButton).toBeVisible();
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/report-deliveries/${retryDeliveryId}/retry`)),
    retryButton.click(),
  ]);

  // 409 auto_send_disabled when customer emails are switched off in this environment (ADR-005).
  expect([200, 409]).toContain(response.status());
  const body = await response.json();

  const { data: row } = await admin!
    .from('customer_report_deliveries')
    .select('status, trigger_source, triggered_by, attempt_count')
    .eq('id', retryDeliveryId)
    .single();

  if (response.status() === 409) {
    expect(body.code).toBe('auto_send_disabled');
    // Row untouched when the kill switch blocks the retry.
    expect(row).toMatchObject({ status: 'failed', attempt_count: 3, trigger_source: 'auto' });
  } else {
    expect(row).toMatchObject({ trigger_source: 'retry', triggered_by: ownerId, attempt_count: 4 });
    expect(['sent', 'failed', 'skipped']).toContain(row!.status);
  }
});
