/**
 * Automatic customer reports E2E — KAN-151.
 *
 * Prefers an ephemeral qa-billing-* tenant (SUPABASE_URL + SERVICE_ROLE_KEY),
 * falling back to QA_ADMIN_PASSWORD login. Skips if neither is available.
 *
 * AC coverage: AC-2 settings UI, AC-3 job toggles, AC-4/AC-5/AC-6 delivery on complete.
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
const QA_ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD;
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const QA_ADMIN_EMAIL = 'qa-admin@cadenzaops.com';

const HAS_SERVICE = Boolean(SUPABASE_URL && SERVICE_KEY);
const HAS_QA_ADMIN = Boolean(QA_ADMIN_PASSWORD);

const RUN_ID = `ar${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const OWNER_EMAIL = `qa-billing-${RUN_ID}@cadenzaops.com`;
const COMPANY_NAME = `QA Billing Auto Reports ${RUN_ID}`;
const PASSWORD = `Qa!${crypto.randomBytes(18).toString('base64url')}`;
const CUSTOMER_EMAIL = 'delivered@resend.dev';

const DEFAULT_AUTO_SEND = [
  'filter_change',
  'o_ring_replacement',
  'filter_cleaning',
  'low_water_level',
] as const;

test.describe.configure({ mode: 'serial' });
test.skip(
  !HAS_SERVICE && !HAS_QA_ADMIN,
  'SUPABASE_SERVICE_ROLE_KEY (preferred) or QA_ADMIN_PASSWORD required',
);

let admin: SupabaseClient | undefined;
let ownerId = '';
let companyId = '';
let loginEmail = '';
let loginPassword = '';
let api: APIRequestContext;
const openContexts: BrowserContext[] = [];

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
          recordVideo: { dir: 'test-results/kan151-video', size: { width: 1280, height: 800 } },
          viewport: { width: 1280, height: 800 },
        }
      : {}),
  });
  openContexts.push(ctx);
  return ctx.newPage();
}

async function uiLogin(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/en/auth/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByLabel(/email/i).fill(email);
  await fillSecret(page.getByLabel(/password/i), password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/auth'), { timeout: 30_000 });
}

async function seedPropertyJobReport(opts: {
  customerEmail: string;
  serviceEventTypes: string[];
  scheduledDate?: string;
}): Promise<{ propertyId: string; jobId: string; reportId: string }> {
  if (!admin || !companyId || !ownerId) {
    throw new Error('Ephemeral tenant not initialized');
  }
  const scheduledDate =
    opts.scheduledDate ?? new Date().toISOString().slice(0, 10);

  const { data: property, error: propErr } = await admin
    .from('cadenza_properties')
    .insert({
      company_id: companyId,
      customer_name: 'QA Pool Customer',
      customer_email: opts.customerEmail,
      address: '100 Test Pool Lane',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      pool_type: 'residential',
      is_active: true,
    })
    .select('id')
    .single();
  expect(propErr, propErr?.message).toBeNull();

  const { data: job, error: jobErr } = await admin
    .from('cadenza_service_jobs')
    .insert({
      company_id: companyId,
      property_id: property!.id,
      technician_id: ownerId,
      scheduled_date: scheduledDate,
      status: 'pending',
      job_source: 'ad_hoc',
      estimated_duration_min: 30,
      has_paid_extras: false,
      send_paid_extra_report: false,
    })
    .select('id')
    .single();
  expect(jobErr, jobErr?.message).toBeNull();

  const { data: report, error: reportErr } = await admin
    .from('cadenza_service_reports')
    .insert({
      job_id: job!.id,
      company_id: companyId,
      technician_id: ownerId,
      service_event_types: opts.serviceEventTypes,
      notes: 'QA auto-report seed',
    })
    .select('id')
    .single();
  expect(reportErr, reportErr?.message).toBeNull();

  return {
    propertyId: property!.id as string,
    jobId: job!.id as string,
    reportId: report!.id as string,
  };
}

async function pollDelivery(jobId: string) {
  let last:
    | {
        id: string;
        status: string;
        reason: string | null;
        recipient: string | null;
      }
    | null
    | undefined;
  await expect
    .poll(
      async () => {
        const { data } = await admin!
          .from('customer_report_deliveries')
          .select('id, status, reason, recipient')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        last = data as typeof last;
        return data?.status ?? null;
      },
      {
        message: `waiting for customer_report_deliveries row for job ${jobId}`,
        timeout: 60_000,
        intervals: [1_000, 2_000, 3_000],
      },
    )
    .toBeTruthy();
  return last!;
}

test.beforeAll(async () => {
  if (HAS_SERVICE) {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: 'QA Auto Reports Owner',
        company_name: COMPANY_NAME,
      },
    });
    expect(error, error?.message).toBeNull();
    ownerId = data.user!.id;

    const { data: profile } = await admin
      .from('cadenza_profiles')
      .select('company_id, role')
      .eq('id', ownerId)
      .single();
    expect(profile?.role).toBe('owner');
    companyId = profile!.company_id as string;

    loginEmail = OWNER_EMAIL;
    loginPassword = PASSWORD;
  } else {
    loginEmail = QA_ADMIN_EMAIL;
    loginPassword = QA_ADMIN_PASSWORD!;
  }

  api = await pwRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: bypassHeaders,
  });
  const login = await api.post('/api/auth/login', {
    data: { email: loginEmail, password: loginPassword },
  });
  expect(login.status(), await login.text()).toBe(200);
});

test.afterAll(async () => {
  await Promise.all(openContexts.map((c) => c.close().catch(() => {})));
  await api?.dispose();
  if (!admin || !HAS_SERVICE) return;
  await cleanupBillingQaUsers(admin, { emailPrefix: `qa-billing-${RUN_ID}` });
});

test('AC-2: settings page loads with defaults; save persists; no chemical options', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await ownerPage(browser);
  await uiLogin(page, loginEmail, loginPassword);

  await page.goto(`${BASE_URL}/en/settings/customer-reports`, {
    waitUntil: 'networkidle',
  });
  await expect(
    page.getByRole('heading', { name: /customer reports/i }),
  ).toBeVisible({ timeout: 30_000 });

  for (const type of DEFAULT_AUTO_SEND) {
    const toggle = page.getByTestId(`auto-send-${type}`);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('data-state', 'checked');
  }

  await expect(page.getByTestId('auto-send-chemical_reading')).toHaveCount(0);
  await expect(page.getByTestId('auto-send-salt_addition')).toHaveCount(0);
  await expect(page.getByText(/chemical reading/i)).toHaveCount(0);
  await expect(page.getByText(/salt addition/i)).toHaveCount(0);

  const filterChange = page.getByTestId('auto-send-filter_change');
  await filterChange.click();
  await expect(filterChange).toHaveAttribute('data-state', 'unchecked');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText(/customer report settings saved/i)).toBeVisible();

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('auto-send-filter_change')).toHaveAttribute(
    'data-state',
    'unchecked',
  );
  await expect(page.getByTestId('auto-send-o_ring_replacement')).toHaveAttribute(
    'data-state',
    'checked',
  );

  // Restore defaults for later tests on this tenant
  await page.getByTestId('auto-send-filter_change').click();
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText(/customer report settings saved/i)).toBeVisible();
});

test('AC-4/AC-5/AC-6: completing job with filter_change sends delivery (no chemicals in path)', async ({
  browser,
}) => {
  test.skip(!HAS_SERVICE, 'Service role required to seed property/job/report');
  test.setTimeout(180_000);

  const { jobId } = await seedPropertyJobReport({
    customerEmail: CUSTOMER_EMAIL,
    serviceEventTypes: ['filter_change', 'chemical_reading'],
  });

  const page = await ownerPage(browser);
  await uiLogin(page, loginEmail, loginPassword);

  await page.goto(`${BASE_URL}/en/jobs/${jobId}`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('has-paid-extras')).toBeVisible({ timeout: 30_000 });

  // Visible complete flow: set status → Save (PATCH triggers processCustomerReportForJob)
  await page.locator('select').filter({ has: page.locator('option[value="completed"]') }).selectOption('completed');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect
    .poll(async () => {
      const res = await api.get(`/api/jobs/${jobId}`);
      if (!res.ok()) return null;
      const body = await res.json();
      return body.status as string;
    }, { timeout: 30_000 })
    .toBe('completed');

  const delivery = await pollDelivery(jobId);
  expect(['sent', 'failed']).toContain(delivery.status);
  if (delivery.status === 'failed') {
    expect(delivery.reason, 'failed delivery must include a reason').toBeTruthy();
  }
  expect(delivery.recipient).toBe(CUSTOMER_EMAIL);
  // Delivery log has no chemical payload; skip reason must not be chemicals_only when filter_change is present
  expect(delivery.reason).not.toBe('chemicals_only');
  expect(String(delivery.reason ?? '')).not.toMatch(/ph_level|chlorine|salt_level|chemical/i);
});

test('AC-4: chemical_reading-only visit yields skipped (chemicals_only) delivery', async ({
  browser,
}) => {
  test.skip(!HAS_SERVICE, 'Service role required to seed property/job/report');
  test.setTimeout(180_000);

  const { jobId } = await seedPropertyJobReport({
    customerEmail: CUSTOMER_EMAIL,
    serviceEventTypes: ['chemical_reading'],
    scheduledDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  });

  const page = await ownerPage(browser);
  await uiLogin(page, loginEmail, loginPassword);

  await page.goto(`${BASE_URL}/en/jobs/${jobId}`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('has-paid-extras')).toBeVisible({ timeout: 30_000 });

  await page.locator('select').filter({ has: page.locator('option[value="completed"]') }).selectOption('completed');
  await page.getByRole('button', { name: /^save$/i }).click();

  const delivery = await pollDelivery(jobId);
  expect(delivery.status).toBe('skipped');
  expect(delivery.reason).toBe('chemicals_only');
});

test('AC-3: job detail paid-extra send-report toggle persists', async ({ browser }) => {
  test.setTimeout(120_000);

  let jobId: string;
  if (HAS_SERVICE) {
    const seeded = await seedPropertyJobReport({
      customerEmail: CUSTOMER_EMAIL,
      serviceEventTypes: ['filter_cleaning'],
      scheduledDate: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
    });
    jobId = seeded.jobId;
  } else {
    const jobsRes = await api.get('/api/jobs?limit=5');
    expect(jobsRes.ok()).toBeTruthy();
    const jobsBody = await jobsRes.json();
    const jobs = (Array.isArray(jobsBody)
      ? jobsBody
      : jobsBody.data ?? jobsBody.jobs ?? []) as { id: string }[];
    test.skip(jobs.length === 0, 'No jobs available for QA admin fallback');
    jobId = jobs[0].id;
  }

  const page = await ownerPage(browser);
  await uiLogin(page, loginEmail, loginPassword);

  await page.goto(`${BASE_URL}/en/jobs/${jobId}`, { waitUntil: 'networkidle' });
  const hasPaid = page.getByTestId('has-paid-extras');
  await expect(hasPaid).toBeVisible({ timeout: 30_000 });

  if ((await hasPaid.getAttribute('data-state')) !== 'checked') {
    await hasPaid.click();
  }
  await expect(hasPaid).toHaveAttribute('data-state', 'checked');

  const sendReport = page.getByTestId('send-paid-extra-report');
  await expect(sendReport).toBeVisible();
  if ((await sendReport.getAttribute('data-state')) !== 'checked') {
    await sendReport.click();
  }
  await expect(sendReport).toHaveAttribute('data-state', 'checked');

  await page.getByRole('button', { name: /^save$/i }).click();
  await page.waitForTimeout(800);

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('has-paid-extras')).toHaveAttribute(
    'data-state',
    'checked',
  );
  await expect(page.getByTestId('send-paid-extra-report')).toHaveAttribute(
    'data-state',
    'checked',
  );

  const mid = await (await api.get(`/api/jobs/${jobId}`)).json();
  expect(mid.has_paid_extras).toBe(true);
  expect(mid.send_paid_extra_report).toBe(true);
});
