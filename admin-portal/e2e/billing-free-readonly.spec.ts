/**
 * Free plan expiry → read-only (KAN-147).
 *
 * Creates a throwaway qa-billing tenant on Free, backdates current_period_end,
 * asserts mutating APIs return 402, banner shows, plans page + checkout still work.
 * No real Stripe charges (checkout only asserts cs_test_ URL).
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Browser } from '@playwright/test';
import { cleanupBillingQaUsers } from './helpers/billing-qa-cleanup';
import { cleanupStripeQaCustomers } from './helpers/stripe-qa-cleanup';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

const RUN_ID = `ro${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const OWNER_EMAIL = `qa-billing-${RUN_ID}@cadenzaops.com`;
const COMPANY_NAME = `QA Billing RO ${RUN_ID}`;
const PASSWORD = `Qa!${crypto.randomBytes(18).toString('base64url')}`;
const FREE = 'plan_free';
const STANDARD = 'plan_necessary_month';

test.describe.configure({ mode: 'serial' });
test.skip(!SUPABASE_URL || !SERVICE_KEY, 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required for QA tenant setup');

let admin: SupabaseClient;
let ownerId = '';
let companyId = '';
let api: APIRequestContext;

const bypassHeaders: Record<string, string> = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET, 'x-vercel-set-bypass-cookie': 'true' }
  : {};

test.beforeAll(async () => {
  admin = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
});

test.afterAll(async () => {
  await api?.dispose();
  if (!admin) return;
  await cleanupStripeQaCustomers({ emailPrefix: `qa-billing-${RUN_ID}` }).catch((e) =>
    console.warn(String(e?.message ?? e)),
  );
  await cleanupBillingQaUsers(admin, { emailPrefix: `qa-billing-${RUN_ID}` });
});

test('Free expiry: mutating API returns 402, banner shows, checkout still works', async ({ browser }) => {
  test.setTimeout(120_000);

  const { data, error } = await admin.auth.admin.createUser({
    email: OWNER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'QA Billing RO Owner', company_name: COMPANY_NAME },
  });
  expect(error, error?.message).toBeNull();
  ownerId = data.user!.id;

  const { data: profile } = await admin.from('cadenza_profiles').select('company_id, role').eq('id', ownerId).single();
  expect(profile?.role).toBe('owner');
  companyId = profile!.company_id as string;

  api = await pwRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bypassHeaders });
  const login = await api.post('/api/auth/login', { data: { email: OWNER_EMAIL, password: PASSWORD } });
  expect(login.status()).toBe(200);

  // Ensure Free subscription row exists (lazy ensure via GET or explicit POST)
  const ensure = await api.post('/api/billing/subscriptions/free');
  expect(ensure.status(), await ensure.text()).toBe(200);

  const { data: freeSub, error: freeSubErr } = await admin
    .from('cadenza_billing_subscriptions')
    .select('id, plan_id, status, current_period_end')
    .eq('user_id', ownerId)
    .eq('plan_id', FREE)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  expect(freeSubErr, freeSubErr?.message).toBeNull();
  expect(freeSub?.plan_id).toBe(FREE);

  const past = new Date(Date.now() - 86400000).toISOString();
  const { error: updErr } = await admin
    .from('cadenza_billing_subscriptions')
    .update({ current_period_end: past, updated_at: new Date().toISOString() })
    .eq('id', freeSub!.id);
  expect(updErr, updErr?.message).toBeNull();

  const invite = await api.post('/api/invite-codes', { data: { role: 'technician' } });
  expect(invite.status()).toBe(402);
  const inviteBody = await invite.json();
  expect(inviteBody.code).toBe('FREE_PLAN_EXPIRED');

  const props = await api.post('/api/properties', {
    data: { customer_name: 'Should Fail', address: '1 Read Only St' },
  });
  expect(props.status()).toBe(402);

  const access = await api.get('/api/billing/access-mode');
  expect(access.status()).toBe(200);
  const accessBody = await access.json();
  const accessData = accessBody.data ?? accessBody;
  expect(accessData.accessMode).toBe('read_only');

  const checkout = await api.post('/api/billing/checkout', {
    data: { planId: STANDARD, quantity: 1 },
    headers: { 'x-locale': 'en' },
  });
  const checkoutBody = await checkout.json().catch(() => ({}));
  expect(checkout.status(), JSON.stringify(checkoutBody?.error ?? '')).toBe(200);
  const sessionId = (checkoutBody.data ?? checkoutBody).sessionId as string;
  const checkoutUrl = (checkoutBody.data ?? checkoutBody).url as string;
  if (!sessionId?.startsWith('cs_test_')) {
    throw new Error(`ABORT: Checkout session is not test mode (prefix ${String(sessionId).slice(0, 8)})`);
  }
  expect(checkoutUrl).toContain('cs_test_');

  const ctx = await browser.newContext({
    storageState: await api.storageState(),
    extraHTTPHeaders: bypassHeaders,
    ...(process.env.RECORD_VIDEO
      ? { recordVideo: { dir: 'test-results/billing-video', size: { width: 1280, height: 800 } }, viewport: { width: 1280, height: 800 } }
      : {}),
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/en/dashboard`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('free-plan-expired-banner')).toBeVisible({ timeout: 30_000 });

  await page.goto(`${BASE_URL}/en/billing/plans`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/en\/billing\/plans/);

  if (process.env.RECORD_VIDEO) {
    // Showcase read-only UI for the PR recording (video mode only)
    for (const path of ['/en/team', '/en/properties', '/en/routes', '/en/jobs', '/en/billing/plans']) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
    }
  }

  await ctx.close();
  void companyId;
});
