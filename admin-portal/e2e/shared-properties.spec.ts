/**
 * Shared properties + last-service summary E2E — KAN-155.
 *
 * "Shared" means visited by more than one technician of the SAME company; nothing here shares
 * data across companies. Uses ephemeral qa-billing-* tenants (SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY) and seeds jobs / reports directly, so no customer email is sent and
 * nothing is charged. Skips cleanly when env vars are missing or the KAN-155 migration
 * (cadenza_properties.is_shared) is not applied.
 * Set RECORD_VIDEO=1 to save a video to test-results/kan155-video.
 *
 * AC coverage: AC-1 (office toggles via the property form; technician cannot), AC-2 / AC-3
 * (last-service API for a technician and for office; non-shared / no prior visit / current job
 * only are empty), AC-4 (401 unauthenticated, foreign company 404).
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

const RUN_ID = `sp${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const OWNER_EMAIL = `qa-billing-${RUN_ID}@cadenzaops.com`;
const TECH_A_EMAIL = `qa-billing-${RUN_ID}-tech-a@cadenzaops.com`;
const TECH_B_EMAIL = `qa-billing-${RUN_ID}-tech-b@cadenzaops.com`;
const OTHER_EMAIL = `qa-billing-${RUN_ID}-other@cadenzaops.com`;
const COMPANY_NAME = `QA Billing Shared Properties ${RUN_ID}`;
const OTHER_COMPANY_NAME = `QA Billing Shared Properties Other ${RUN_ID}`;
const TECH_A_NAME = 'QA Shared Tech A';
const PASSWORD = `Qa!${crypto.randomBytes(18).toString('base64url')}`;

test.describe.configure({ mode: 'serial' });
test.skip(!HAS_SERVICE, 'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required to seed shared properties');

let admin: SupabaseClient | undefined;
let companyId = '';
let otherCompanyId = '';
let techAId = '';
let techBId = '';
let schemaReady = false;
let ownerApi: APIRequestContext;
let techBApi: APIRequestContext;
let otherApi: APIRequestContext;
const openContexts: BrowserContext[] = [];

let sharedPropertyId = ''; // starts unshared; the office toggles it in AC-1
let sharedPropertyName = '';
let plainPropertyId = ''; // never shared
let lonelyPropertyId = ''; // shared, only visit is the current job
let foreignPropertyId = '';
let techAJobId = ''; // completed visit by technician A (filter cleaned + salt)
let techBJobId = ''; // today's job for technician B
let plainJobId = '';
let lonelyJobId = '';

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
          recordVideo: { dir: 'test-results/kan155-video', size: { width: 1280, height: 800 } },
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

function dateDaysAgo(n: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, 12, 0, 0).toISOString().slice(0, 10);
}

async function seedProperty(
  forCompany: string,
  name: string,
  address: string,
  isShared: boolean,
): Promise<string> {
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
      is_shared: isShared,
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
      scheduled_date: dateDaysAgo(scheduledDaysAgo),
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
  technicianId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin!.from('cadenza_service_reports').insert({
    job_id: jobId,
    company_id: forCompany,
    technician_id: technicianId,
    notes: 'QA private note that must never be returned',
    follow_up_needed: false,
    ...fields,
  });
  expect(error, error?.message).toBeNull();
}

async function loginApi(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bypassHeaders });
  const login = await ctx.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(login.status(), await login.text()).toBe(200);
  return ctx;
}

type LastServiceBody = {
  is_shared: boolean;
  last_service: null | {
    job_id: string;
    scheduled_date: string;
    technician_name: string;
    cleaned_filter: boolean;
    backwashed: boolean;
    salt_level: number | null;
    service_event_types: string[];
  };
};

async function lastService(api: APIRequestContext, propertyId: string, jobId?: string) {
  const qs = jobId ? `?job_id=${jobId}` : '';
  return api.get(`/api/properties/${propertyId}/last-service${qs}`);
}

async function readFlag(propertyId: string): Promise<boolean | null> {
  const { data } = await admin!.from('cadenza_properties').select('is_shared').eq('id', propertyId).single();
  return (data?.is_shared as boolean | undefined) ?? null;
}

test.beforeAll(async () => {
  admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Schema probe: skip cleanly if the KAN-155 migration (is_shared) is not applied.
  const probe = await admin.from('cadenza_properties').select('id, is_shared').limit(1);
  schemaReady = !probe.error;
  if (!schemaReady) {
    console.warn('KAN-155 migration not applied; E2E tests will be skipped');
    return;
  }

  const owner = await createTenant(OWNER_EMAIL, COMPANY_NAME, 'QA Shared Owner');
  companyId = owner.companyId;
  techAId = await createTechnician(TECH_A_EMAIL, TECH_A_NAME, companyId);
  techBId = await createTechnician(TECH_B_EMAIL, 'QA Shared Tech B', companyId);

  const other = await createTenant(OTHER_EMAIL, OTHER_COMPANY_NAME, 'QA Shared Other Owner');
  otherCompanyId = other.companyId;

  // Shared property (flag set through the UI in AC-1): technician A cleaned the filter and read
  // salt on the previous completed visit; technician B has today's job.
  sharedPropertyName = `QA Shared One ${RUN_ID}`;
  sharedPropertyId = await seedProperty(companyId, sharedPropertyName, '101 Test Pool Lane', false);
  techAJobId = await seedJob(companyId, sharedPropertyId, techAId, 'completed', 3);
  await seedReport(companyId, techAJobId, techAId, {
    cleaned_filter: true,
    backwashed: false,
    salt_level: 3100,
    service_event_types: ['filter_cleaning', 'salt_addition'],
    follow_up_notes: 'QA private follow-up that must never be returned',
  });
  techBJobId = await seedJob(companyId, sharedPropertyId, techBId, 'pending', 0);

  // Never-shared property with a completed visit: the card must stay empty.
  plainPropertyId = await seedProperty(companyId, `QA Shared Plain ${RUN_ID}`, '202 Test Pool Lane', false);
  const plainPrev = await seedJob(companyId, plainPropertyId, techAId, 'completed', 3);
  await seedReport(companyId, plainPrev, techAId, { cleaned_filter: true, salt_level: 2900 });
  plainJobId = await seedJob(companyId, plainPropertyId, techBId, 'pending', 0);

  // Shared property whose only report belongs to the job being viewed.
  lonelyPropertyId = await seedProperty(companyId, `QA Shared Lonely ${RUN_ID}`, '303 Sample Harbor Road', true);
  lonelyJobId = await seedJob(companyId, lonelyPropertyId, techBId, 'completed', 0);
  await seedReport(companyId, lonelyJobId, techBId, { cleaned_filter: true });

  // Another tenant's shared property with a visit; must never be readable from this tenant.
  foreignPropertyId = await seedProperty(otherCompanyId, `QA Shared Foreign ${RUN_ID}`, '999 Other Tenant Way', true);
  const foreignJob = await seedJob(otherCompanyId, foreignPropertyId, other.userId, 'completed', 2);
  await seedReport(otherCompanyId, foreignJob, other.userId, { cleaned_filter: true, salt_level: 999 });

  ownerApi = await loginApi(OWNER_EMAIL);
  techBApi = await loginApi(TECH_B_EMAIL);
  otherApi = await loginApi(OTHER_EMAIL);
});

test.beforeEach(() => {
  test.skip(!schemaReady, 'KAN-155 migration not applied (cadenza_properties.is_shared missing)');
});

test.afterAll(async () => {
  await Promise.all(openContexts.map((c) => c.close().catch(() => {})));
  await Promise.all([ownerApi?.dispose(), techBApi?.dispose(), otherApi?.dispose()]);
  if (!admin) return;
  await cleanupBillingQaUsers(admin, { emailPrefix: `qa-billing-${RUN_ID}` });
});

test('AC-1: office marks a property shared from the property form (and it persists)', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await ownerPage(browser);
  await uiLogin(page);
  await page.goto(`${BASE_URL}/en/properties/${sharedPropertyId}/edit`, { waitUntil: 'networkidle' });

  const toggle = page.getByRole('switch', { name: 'Shared property' });
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText(/more than one technician of your company/i)).toBeVisible();

  await toggle.click();
  await expect(toggle).toBeChecked();
  await page.getByRole('button', { name: /^save$/i }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/edit'), { timeout: 30_000 });

  expect(await readFlag(sharedPropertyId)).toBe(true);
  const res = await ownerApi.get(`/api/properties/${sharedPropertyId}`);
  expect((await res.json()).is_shared).toBe(true);
});

test('AC-1: office can unmark and re-mark via the API; the flag is company-scoped', async () => {
  const body = { customer_name: sharedPropertyName, address: '101 Test Pool Lane' };

  const off = await ownerApi.put(`/api/properties/${sharedPropertyId}`, { data: { ...body, is_shared: false } });
  expect(off.status(), await off.text()).toBe(200);
  expect(await readFlag(sharedPropertyId)).toBe(false);

  const on = await ownerApi.put(`/api/properties/${sharedPropertyId}`, { data: { ...body, is_shared: true } });
  expect(on.status(), await on.text()).toBe(200);
  expect(await readFlag(sharedPropertyId)).toBe(true);

  // Another company cannot touch this property's flag, and its own property is untouched.
  const foreign = await otherApi.put(`/api/properties/${sharedPropertyId}`, { data: { ...body, is_shared: false } });
  expect([403, 404]).toContain(foreign.status());
  expect(await readFlag(sharedPropertyId)).toBe(true);
  expect(await readFlag(foreignPropertyId)).toBe(true);
});

test('AC-1: a technician cannot change is_shared', async () => {
  const res = await techBApi.put(`/api/properties/${sharedPropertyId}`, {
    data: { customer_name: sharedPropertyName, address: '101 Test Pool Lane', is_shared: false },
  });
  expect(res.status()).toBe(403);
  expect(await readFlag(sharedPropertyId)).toBe(true);

  const create = await techBApi.post('/api/properties', {
    data: { customer_name: `QA Shared Tech Create ${RUN_ID}`, address: '1 Test Pool Lane', is_shared: true },
  });
  expect(create.status()).toBe(403);
});

test('AC-2: technician B sees technician A\'s filter and salt work on the next job', async () => {
  const res = await lastService(techBApi, sharedPropertyId, techBJobId);
  expect(res.status(), await res.text()).toBe(200);
  const body = (await res.json()) as LastServiceBody;

  expect(body.is_shared).toBe(true);
  expect(body.last_service).toMatchObject({
    job_id: techAJobId,
    technician_name: TECH_A_NAME,
    cleaned_filter: true,
    backwashed: false,
    salt_level: 3100,
    service_event_types: ['filter_cleaning', 'salt_addition'],
  });

  // Allow-listed fields only: no notes, follow-up text, emails.
  expect(Object.keys(body.last_service!).sort()).toEqual(
    [
      'backwashed',
      'cleaned_filter',
      'job_id',
      'salt_level',
      'scheduled_date',
      'service_event_types',
      'technician_name',
    ].sort(),
  );
  const raw = JSON.stringify(body);
  expect(raw).not.toMatch(/private|@/);
});

test('AC-2: office sees the same summary', async () => {
  const res = await lastService(ownerApi, sharedPropertyId, techBJobId);
  expect(res.status()).toBe(200);
  expect(((await res.json()) as LastServiceBody).last_service?.job_id).toBe(techAJobId);
});

test('AC-3: non-shared property is empty even though it has a completed visit', async () => {
  const res = await lastService(techBApi, plainPropertyId, plainJobId);
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ is_shared: false, last_service: null });
});

test('AC-3: shared property whose only report is the current job is empty', async () => {
  const res = await lastService(techBApi, lonelyPropertyId, lonelyJobId);
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ is_shared: true, last_service: null });
});

test('AC-3: the summary excludes the current job and ignores soft-deleted reports', async () => {
  // Technician B's own completed report at the shared property is "current" and never shown.
  const { error } = await admin!.from('cadenza_service_reports').insert({
    job_id: techBJobId,
    company_id: companyId,
    technician_id: techBId,
    cleaned_filter: false,
    salt_level: 1,
  });
  expect(error, error?.message).toBeNull();

  const current = (await (await lastService(techBApi, sharedPropertyId, techBJobId)).json()) as LastServiceBody;
  expect(current.last_service?.job_id).toBe(techAJobId);

  // Soft-deleting technician A's report removes it from the summary.
  const { error: delError } = await admin!
    .from('cadenza_service_reports')
    .update({ is_deleted: true })
    .eq('job_id', techAJobId)
    .eq('company_id', companyId);
  expect(delError, delError?.message).toBeNull();
  const after = (await (await lastService(techBApi, sharedPropertyId, techBJobId)).json()) as LastServiceBody;
  expect(after).toEqual({ is_shared: true, last_service: null });

  await admin!
    .from('cadenza_service_reports')
    .update({ is_deleted: false })
    .eq('job_id', techAJobId)
    .eq('company_id', companyId);
});

test('AC-4: unauthenticated last-service calls return 401; a foreign company id returns 404', async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bypassHeaders });
  try {
    expect((await anon.get(`/api/properties/${sharedPropertyId}/last-service`)).status()).toBe(401);
    expect((await anon.get(`/api/properties/${crypto.randomUUID()}/last-service`)).status()).toBe(401);
  } finally {
    await anon.dispose();
  }

  // This tenant cannot read the other tenant's property (and vice versa): 404, no summary.
  const cross = await lastService(ownerApi, foreignPropertyId);
  expect(cross.status()).toBe(404);
  expect(await cross.text()).not.toMatch(/999|QA Shared Foreign/);
  expect((await lastService(techBApi, foreignPropertyId)).status()).toBe(404);
  expect((await lastService(otherApi, sharedPropertyId)).status()).toBe(404);

  // A random id in the caller's own company scope is a plain 404 too.
  expect((await lastService(ownerApi, crypto.randomUUID())).status()).toBe(404);
});
