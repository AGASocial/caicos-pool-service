/**
 * Billing dunning E2E (Stripe TEST mode) — KAN-148.
 *
 * 1. QA tenant + Standard via Checkout (4242)
 * 2. Attach declining card 4000000000000341, create+pay invoice → past_due + grace ≈ now+14d
 * 3. Billing page grace banner; mutating API still works (full access)
 * 4. Second failure → grace_period_ends_at unchanged
 * 5. Backdate grace via service-role; call cron (if CRON_SECRET set) → canceled + free tier
 *
 * Aborts unless Stripe key is sk_test_. No live charges.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page, type Browser, type BrowserContext } from '@playwright/test';
import { cleanupBillingQaUsers } from './helpers/billing-qa-cleanup';
import { cleanupStripeQaCustomers } from './helpers/stripe-qa-cleanup';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const STRIPE_KEY = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';

const RUN_ID = `dun${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const OWNER_EMAIL = `qa-billing-${RUN_ID}@cadenzaops.com`;
const COMPANY_NAME = `QA Billing Dunning ${RUN_ID}`;
const PASSWORD = `Qa!${crypto.randomBytes(18).toString('base64url')}`;
const STANDARD = 'plan_necessary_month';
const FREE = 'plan_free';
const GRACE_MS = 14 * 24 * 60 * 60 * 1000;

test.describe.configure({ mode: 'serial' });
test.skip(!SUPABASE_URL || !SERVICE_KEY, 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required');
test.skip(!STRIPE_KEY, 'STRIPE_TEST_SECRET_KEY or STRIPE_SECRET_KEY required for dunning E2E');
if (STRIPE_KEY && !STRIPE_KEY.startsWith('sk_test_')) {
  throw new Error('ABORT: Stripe key is not sk_test_ — refusing dunning E2E against live mode');
}

let admin: SupabaseClient;
let ownerId = '';
let companyId = '';
let api: APIRequestContext;
let stripeCustomerId = '';
let stripeSubscriptionId = '';

const bypassHeaders: Record<string, string> = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? {
      'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      'x-vercel-set-bypass-cookie': 'true',
    }
  : {};

const stripeAuth = {
  Authorization: `Basic ${Buffer.from(`${STRIPE_KEY}:`).toString('base64')}`,
  'Content-Type': 'application/x-www-form-urlencoded',
};

async function stripeForm(method: string, path: string, body?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: stripeAuth,
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${method} ${path}: ${json?.error?.message ?? res.status}`);
  }
  return json;
}

type Sub = {
  id: string;
  planId: string;
  quantity: number;
  status: string;
  gracePeriodEndsAt?: string;
  paymentFailedAt?: string;
};

async function getSub(ctx: APIRequestContext): Promise<Sub> {
  const res = await ctx.get('/api/billing/subscriptions');
  expect(res.status(), 'GET /api/billing/subscriptions').toBe(200);
  const body = await res.json();
  return (body.subscription ?? body.data?.subscription ?? body) as Sub;
}

async function waitForSub(
  ctx: APIRequestContext,
  pred: (s: Sub) => boolean,
  label: string,
  timeoutMs = 90_000,
) {
  let last: Sub | undefined;
  await expect
    .poll(
      async () => {
        last = await getSub(ctx);
        return pred(last);
      },
      { message: `waiting for: ${label}`, timeout: timeoutMs, intervals: [2_000, 3_000, 5_000] },
    )
    .toBe(true);
  return last!;
}

async function createCheckout(ctx: APIRequestContext, planId: string, quantity: number) {
  const res = await ctx.post('/api/billing/checkout', {
    data: { planId, quantity },
    headers: { 'x-locale': 'en' },
  });
  const body = await res.json().catch(() => ({}));
  expect(res.status(), `checkout create: ${JSON.stringify(body?.error ?? '')}`).toBe(200);
  const data = body.data ?? body;
  const sessionId: string = data.sessionId;
  if (!sessionId?.startsWith('cs_test_')) {
    throw new Error(`ABORT: Checkout session is not test mode (prefix ${String(sessionId).slice(0, 8)})`);
  }
  return { sessionId, url: data.url as string };
}

const openContexts: BrowserContext[] = [];

async function ownerPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    storageState: await api.storageState(),
    ...(process.env.RECORD_VIDEO
      ? {
          recordVideo: { dir: 'test-results/billing-video', size: { width: 1280, height: 800 } },
          viewport: { width: 1280, height: 800 },
        }
      : {}),
  });
  openContexts.push(ctx);
  return ctx.newPage();
}

async function payOnStripeCheckout(page: Page, url: string, card: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const classicCard = page.locator('input#cardNumber');
  const peFrame = page
    .frameLocator('iframe[src*="elements-inner-habanero"], iframe[src*="elements-inner-payment"]')
    .first();
  const peCardLabel = peFrame.getByText('Card', { exact: true }).first();
  await expect(
    classicCard
      .or(page.locator('[data-testid="card-accordion-item-button"]'))
      .first()
      .or(page.locator('iframe[src*="elements-inner-habanero"], iframe[src*="elements-inner-payment"]'))
      .first(),
  ).toBeAttached({ timeout: 30_000 });

  const isPaymentElement =
    !(await classicCard.count()) &&
    (await page.locator('iframe[src*="elements-inner-habanero"], iframe[src*="elements-inner-payment"]').count()) >
      0;

  if (isPaymentElement) {
    const number = peFrame.locator('input[name="number"]');
    if (!(await number.isVisible().catch(() => false))) {
      await expect(peCardLabel).toBeVisible({ timeout: 30_000 });
      await peCardLabel.click();
    }
    await expect(number).toBeVisible({ timeout: 15_000 });
    await number.fill(card);
    await peFrame.locator('input[name="expiry"]').fill('12 / 34');
    await peFrame.locator('input[name="cvc"]').fill('123');
    const peName = peFrame.locator('input[name="name"]');
    if (await peName.isVisible().catch(() => false)) await peName.fill('QA Dunning');
    const peCountry = peFrame.locator('select[name="country"]');
    if (await peCountry.isVisible().catch(() => false)) await peCountry.selectOption('US');
    const peZip = peFrame.locator('input[name="postalCode"]');
    if (await peZip.isVisible().catch(() => false)) await peZip.fill('78701');
    const optIn = peFrame.locator('input[name="linkOptIn"]');
    if ((await optIn.isVisible().catch(() => false)) && (await optIn.isChecked())) {
      await optIn.uncheck({ force: true });
    }
    await peFrame.locator('[data-testid="payment-form-submit-button"]').click();
    return;
  }

  const cardButton = page.locator('[data-testid="card-accordion-item-button"]');
  if (!(await classicCard.isVisible().catch(() => false))) {
    await cardButton.dispatchEvent('click').catch(() => {});
    if (!(await classicCard.isVisible().catch(() => false))) {
      await page.waitForTimeout(1_500);
      if (!(await classicCard.isVisible())) {
        await page
          .locator('[data-testid="card-accordion-item"]')
          .getByText('Card', { exact: true })
          .first()
          .click();
      }
    }
  }
  await expect(classicCard).toBeVisible({ timeout: 15_000 });
  const email = page.locator('input#email');
  if (
    (await email.isVisible({ timeout: 2_000 }).catch(() => false)) &&
    (await email.isEditable())
  ) {
    if (!(await email.inputValue())) await email.fill(OWNER_EMAIL);
  }
  await classicCard.fill(card);
  await page.locator('input#cardExpiry').fill('12 / 34');
  await page.locator('input#cardCvc').fill('123');
  const name = page.locator('input#billingName');
  if (await name.isVisible().catch(() => false)) await name.fill('QA Dunning');
  const country = page.locator('select#billingCountry');
  if (await country.isVisible().catch(() => false)) await country.selectOption('US');
  const zip = page.locator('input#billingPostalCode');
  if (await zip.isVisible().catch(() => false)) await zip.fill('78701');
  const link = page.locator('input#enableStripePass');
  if ((await link.isVisible().catch(() => false)) && (await link.isChecked())) await link.uncheck();
  await page
    .locator('button[data-testid="hosted-payment-submit-button"], button.SubmitButton')
    .first()
    .click();
}

/** Attach declining card and attempt to pay a subscription-linked invoice (expects failure). */
async function triggerFailedSubscriptionPayment() {
  // Test-mode only: Stripe test PaymentMethod that attaches OK but fails every charge (4000 0000 0000 0341).
  // Raw card numbers are rejected by the API, so attach the pm_card_* test token instead.
  const attached = await stripeForm('POST', 'payment_methods/pm_card_chargeCustomerFail/attach', {
    customer: stripeCustomerId,
  });
  const pmId = attached.id as string;

  await stripeForm('POST', `customers/${stripeCustomerId}`, {
    'invoice_settings[default_payment_method]': pmId,
  });
  await stripeForm('POST', `subscriptions/${stripeSubscriptionId}`, {
    default_payment_method: pmId,
  });

  // Ensure there is something to invoice on the subscription
  await stripeForm('POST', 'invoiceitems', {
    customer: stripeCustomerId,
    subscription: stripeSubscriptionId,
    amount: '100',
    currency: 'usd',
    description: `qa-dunning-${RUN_ID}`,
  });

  const invoice = await stripeForm('POST', 'invoices', {
    customer: stripeCustomerId,
    subscription: stripeSubscriptionId,
    auto_advance: 'false',
  });
  const finalized = await stripeForm('POST', `invoices/${invoice.id}/finalize`);
  try {
    await stripeForm('POST', `invoices/${finalized.id}/pay`);
  } catch {
    // Expected: card_declined / payment failed → invoice.payment_failed webhook
  }
}

test.beforeAll(async () => {
  admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
});

test.afterAll(async () => {
  // Close browser contexts first so recorded videos are flushed to disk.
  await Promise.all(openContexts.map((c) => c.close().catch(() => {})));
  await api?.dispose();
  if (!admin) return;
  await cleanupStripeQaCustomers({ emailPrefix: `qa-billing-${RUN_ID}` }).catch((e) =>
    console.warn(String(e?.message ?? e)),
  );
  await cleanupBillingQaUsers(admin, { emailPrefix: `qa-billing-${RUN_ID}` });
});

test('dunning: grace, banner, full access, no extend, cron expiry', async ({ browser }) => {
  test.setTimeout(300_000);

  const { data, error } = await admin.auth.admin.createUser({
    email: OWNER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'QA Dunning Owner', company_name: COMPANY_NAME },
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

  api = await pwRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bypassHeaders });
  const login = await api.post('/api/auth/login', {
    data: { email: OWNER_EMAIL, password: PASSWORD },
  });
  expect(login.status()).toBe(200);

  const page = await ownerPage(browser);
  const { url } = await createCheckout(api, STANDARD, 1);
  await payOnStripeCheckout(page, url, '4242424242424242');
  await page.waitForURL(/session_id=cs_test_/, { timeout: 60_000, waitUntil: 'commit' }).catch(() => {});
  await waitForSub(api, (s) => s.planId === STANDARD && s.status === 'active', 'Standard active');

  const { data: paidRow } = await admin
    .from('cadenza_billing_subscriptions')
    .select('provider_subscription_id, provider_customer_id')
    .eq('user_id', ownerId)
    .eq('provider', 'stripe')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  stripeSubscriptionId = paidRow?.provider_subscription_id as string;
  stripeCustomerId = paidRow?.provider_customer_id as string;
  expect(stripeSubscriptionId).toBeTruthy();
  expect(stripeCustomerId).toBeTruthy();

  const beforeFail = Date.now();
  await triggerFailedSubscriptionPayment();

  await expect
    .poll(
      async () => {
        const { data: row } = await admin
          .from('cadenza_billing_subscriptions')
          .select('status, payment_failed_at, grace_period_ends_at')
          .eq('provider_subscription_id', stripeSubscriptionId)
          .maybeSingle();
        return row;
      },
      { message: 'waiting for past_due + grace', timeout: 90_000, intervals: [2_000, 3_000, 5_000] },
    )
    .toMatchObject({ status: 'past_due' });

  const { data: afterFail } = await admin
    .from('cadenza_billing_subscriptions')
    .select('status, payment_failed_at, grace_period_ends_at')
    .eq('provider_subscription_id', stripeSubscriptionId)
    .single();
  expect(afterFail?.status).toBe('past_due');
  expect(afterFail?.payment_failed_at).toBeTruthy();
  const graceMs = new Date(afterFail!.grace_period_ends_at as string).getTime();
  expect(Math.abs(graceMs - (beforeFail + GRACE_MS))).toBeLessThan(10 * 60 * 1000);
  const graceFrozen = afterFail!.grace_period_ends_at as string;

  // Full access during grace: mutating API still works
  const invite = await api.post('/api/invite-codes', { data: { role: 'technician' } });
  expect(invite.status(), await invite.text()).toBe(200);

  // Banner on billing page
  await page.goto(`${BASE_URL}/en/billing`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('payment-failed-grace-banner')).toBeVisible({ timeout: 30_000 });
  // Status badge must render a translated label, not a raw i18n key.
  await expect(page.getByText('Past Due', { exact: true })).toBeVisible();
  await expect(page.getByText(/subscription\.past_due/i)).toHaveCount(0);

  // Second failure must not extend grace
  await triggerFailedSubscriptionPayment();
  await page.waitForTimeout(8_000);
  const { data: afterSecond } = await admin
    .from('cadenza_billing_subscriptions')
    .select('grace_period_ends_at, payment_failed_at, status')
    .eq('provider_subscription_id', stripeSubscriptionId)
    .single();
  expect(afterSecond?.status).toBe('past_due');
  expect(afterSecond?.grace_period_ends_at).toBe(graceFrozen);

  // Expire grace via service-role + cron
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    test.info().annotations.push({
      type: 'note',
      description: 'CRON_SECRET not set — skipped grace expiry cron assertion',
    });
    await page.context().close();
    return;
  }

  const past = new Date(Date.now() - 60_000).toISOString();
  const { error: backdateErr } = await admin
    .from('cadenza_billing_subscriptions')
    .update({ grace_period_ends_at: past, updated_at: new Date().toISOString() })
    .eq('provider_subscription_id', stripeSubscriptionId);
  expect(backdateErr, backdateErr?.message).toBeNull();

  const cron = await api.get('/api/cron/process-grace-expirations', {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  expect(cron.status(), await cron.text()).toBe(200);

  await expect
    .poll(
      async () => {
        const { data: row } = await admin
          .from('cadenza_billing_subscriptions')
          .select('status')
          .eq('provider_subscription_id', stripeSubscriptionId)
          .maybeSingle();
        return row?.status;
      },
      { message: 'waiting for canceled after cron', timeout: 60_000, intervals: [2_000, 3_000] },
    )
    .toBe('canceled');

  await expect
    .poll(async () => {
      const { data: company } = await admin
        .from('cadenza_companies')
        .select('subscription_tier')
        .eq('id', companyId)
        .single();
      return company?.subscription_tier;
    }, { message: 'company tier free', timeout: 60_000 })
    .toBe('free');

  const sub = await getSub(api);
  expect(sub.planId).toBe(FREE);

  // Idempotent re-run
  const cron2 = await api.get('/api/cron/process-grace-expirations', {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  expect(cron2.status()).toBe(200);

  await page.context().close();
});
