/**
 * Billing E2E (Stripe TEST mode) against the Vercel preview.
 *
 * Flow (serial, one throwaway QA tenant per run):
 *  1. New signup (QA owner, company "QA Billing <run>") lands on Free
 *  2. Free plan blocks the 4th technician invite (max 3)
 *  3. Webhook endpoint rejects unsigned / badly signed requests
 *  4. Declined card (4000 0000 0000 0341) in Stripe Checkout -> stays on Free
 *  5. Upgrade to Standard x3 seats via Stripe Checkout (4242...) -> webhook -> Standard (+ company tier)
 *  6. Per-seat: 3 seats + 3 techs; adding a 4th auto-increases quantity (create_prorations) + notice
 *  7. Upgrade Standard -> Pro (and plan survives the subscription.updated webhook) (+ company tier)
 *  8. Downgrade Pro -> Standard (+ company tier)
 *  9. Cancel at period end, then cancel immediately -> back to Free (+ company tier)
 *
 * Safety:
 *  - Aborts if the deployed app hands out a live Checkout session (cs_live_).
 *  - All data is scoped to qa-billing-<run>*@cadenzaops.com and a company named
 *    "QA Billing <run>"; afterAll + scripts/qa-billing-cleanup.ts remove it.
 *  - The QA password is random per run, never logged, never typed into the UI.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page, type Browser } from '@playwright/test';
import { cleanupBillingQaUsers } from './helpers/billing-qa-cleanup';
import { cleanupStripeQaCustomers } from './helpers/stripe-qa-cleanup';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

const RUN_ID = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const OWNER_EMAIL = `qa-billing-${RUN_ID}@cadenzaops.com`;
const COMPANY_NAME = `QA Billing ${RUN_ID}`;
const PASSWORD = `Qa!${crypto.randomBytes(18).toString('base64url')}`;

const STANDARD = 'plan_necessary_month';
const PRO = 'plan_pro_month';
const FREE = 'plan_free';

test.describe.configure({ mode: 'serial' });
test.skip(!SUPABASE_URL || !SERVICE_KEY, 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required for QA tenant setup');

let admin: SupabaseClient;
let ownerId = '';
let companyId = '';
const createdUserIds: string[] = [];
let api: APIRequestContext; // logged-in owner session shared across serial tests

const bypassHeaders: Record<string, string> = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET, 'x-vercel-set-bypass-cookie': 'true' }
  : {};

async function ownerPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ storageState: await api.storageState() });
  return ctx.newPage(); // no extra headers: Stripe Checkout must not receive the Vercel bypass header
}

type Sub = { id: string; planId: string; quantity: number; status: string; cancelAtPeriodEnd?: boolean };

async function getSub(api: APIRequestContext): Promise<Sub> {
  const res = await api.get('/api/billing/subscriptions');
  expect(res.status(), 'GET /api/billing/subscriptions').toBe(200);
  const body = await res.json();
  return (body.subscription ?? body.data?.subscription ?? body) as Sub;
}

async function waitForSub(api: APIRequestContext, pred: (s: Sub) => boolean, label: string, timeoutMs = 90_000) {
  let last: Sub | undefined;
  await expect
    .poll(async () => {
      last = await getSub(api);
      return pred(last);
    }, { message: `waiting for: ${label}`, timeout: timeoutMs, intervals: [2_000, 3_000, 5_000] })
    .toBe(true);
  return last!;
}

/** Poll cadenza_companies.subscription_tier after plan changes (webhook / sync). */
async function waitForCompanyTier(tier: string, label: string, timeoutMs = 90_000) {
  await expect
    .poll(async () => {
      const { data } = await admin
        .from('cadenza_companies')
        .select('subscription_tier')
        .eq('id', companyId)
        .single();
      return data?.subscription_tier as string | undefined;
    }, { message: `waiting for company tier: ${label}`, timeout: timeoutMs, intervals: [2_000, 3_000, 5_000] })
    .toBe(tier);
}

async function inviteTech(api: APIRequestContext) {
  const res = await api.post('/api/invite-codes', { data: { role: 'technician' } });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

async function createCheckout(api: APIRequestContext, planId: string, quantity: number) {
  const res = await api.post('/api/billing/checkout', { data: { planId, quantity }, headers: { 'x-locale': 'en' } });
  const body = await res.json().catch(() => ({}));
  expect(res.status(), `checkout create: ${JSON.stringify(body?.error ?? '')}`).toBe(200);
  const data = body.data ?? body;
  const sessionId: string = data.sessionId;
  // HARD SAFETY GATE: never proceed against live Stripe.
  if (!sessionId?.startsWith('cs_test_')) {
    throw new Error(`ABORT: Checkout session is not test mode (prefix ${String(sessionId).slice(0, 8)})`);
  }
  return { sessionId, url: data.url as string };
}

async function payOnStripeCheckout(page: Page, url: string, card: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Newer Checkout renders payment methods as an accordion
  // Checkout lists Card as an accordion row; its <button> is visually hidden
  // (overlay), so wait for it to be *attached* and click it via JS.
  const cardNumber = page.locator('input#cardNumber');
  // Stripe Checkout has shipped several layouts: accordion button, testid row,
  // or (Nov 2026) a radio list "Card / Cash App Pay / Klarna / Bank".
  const cardButton = page.locator('[data-testid="card-accordion-item-button"]');
  const cardRadio = page.getByRole('radio', { name: /^card$/i });
  const cardRow = page.locator('[data-testid="card-accordion-item"], [data-testid*="card"]').getByText('Card', { exact: true });
  const cardLabel = page.getByText('Card', { exact: true });
  await expect(cardNumber.or(cardButton).or(cardRadio).or(cardLabel).first()).toBeAttached({ timeout: 30_000 });
  if (!(await cardNumber.isVisible().catch(() => false))) {
    for (const target of [cardRadio, cardButton, cardRow, cardLabel]) {
      if ((await target.count().catch(() => 0)) === 0) continue;
      await target.first().click({ force: true, timeout: 5_000 }).catch(() => target.first().dispatchEvent('click').catch(() => {}));
      if (await cardNumber.waitFor({ state: 'visible', timeout: 4_000 }).then(() => true).catch(() => false)) break;
    }
  }
  await expect(cardNumber).toBeVisible({ timeout: 15_000 });
  const email = page.locator('input#email');
  if (await email.isVisible({ timeout: 2_000 }).catch(() => false) && (await email.isEditable())) {
    if (!(await email.inputValue())) await email.fill(OWNER_EMAIL);
  }
  await page.locator('input#cardNumber').fill(card);
  await page.locator('input#cardExpiry').fill('12 / 34');
  await page.locator('input#cardCvc').fill('123');
  const name = page.locator('input#billingName');
  if (await name.isVisible().catch(() => false)) await name.fill('QA Billing');
  const country = page.locator('select#billingCountry');
  if (await country.isVisible().catch(() => false)) await country.selectOption('US');
  const zip = page.locator('input#billingPostalCode');
  if (await zip.isVisible().catch(() => false)) await zip.fill('78701');
  // Don't enrol QA data into Link
  const link = page.locator('input#enableStripePass');
  if (await link.isVisible().catch(() => false) && (await link.isChecked())) await link.uncheck();
  await page.locator('button[data-testid="hosted-payment-submit-button"], button.SubmitButton').first().click();
}

test.beforeAll(async () => {
  admin = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
});

test.afterAll(async () => {
  await api?.dispose();
  if (!admin) return;
  await cleanupStripeQaCustomers({ emailPrefix: `qa-billing-${RUN_ID}` }).catch((e) => console.warn(String(e?.message ?? e)));
  await cleanupBillingQaUsers(admin, { emailPrefix: `qa-billing-${RUN_ID}` });
});

test('1. new signup lands on the Free plan', async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: OWNER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'QA Billing Owner', company_name: COMPANY_NAME },
  });
  expect(error, error?.message).toBeNull();
  ownerId = data.user!.id;
  createdUserIds.push(ownerId);

  const { data: profile } = await admin.from('cadenza_profiles').select('company_id, role').eq('id', ownerId).single();
  expect(profile?.role).toBe('owner');
  companyId = profile!.company_id as string;
  const { data: company } = await admin.from('cadenza_companies').select('name').eq('id', companyId).single();
  expect(company?.name).toBe(COMPANY_NAME);

  api = await pwRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bypassHeaders });
  const login = await api.post('/api/auth/login', { data: { email: OWNER_EMAIL, password: PASSWORD } });
  expect(login.status()).toBe(200);

  const sub = await getSub(api);
  expect(sub.planId).toBe(FREE);
});

test('2. Free plan enforces the 3-technician limit', async () => {
  for (let i = 1; i <= 3; i++) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `qa-billing-${RUN_ID}-tech${i}@cadenzaops.com`,
      password: `Qa!${crypto.randomBytes(18).toString('base64url')}`,
      email_confirm: true,
      user_metadata: { full_name: `QA Billing Tech ${i}`, company_id: companyId, role: 'technician' },
    });
    expect(error, error?.message).toBeNull();
    createdUserIds.push(data.user!.id);
  }
  const { count } = await admin
    .from('cadenza_profiles').select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('role', 'technician').eq('is_active', true);
  expect(count).toBe(3);

  const res = await inviteTech(api);
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('TECHNICIAN_LIMIT_REACHED');
  expect(res.body.max).toBe(3);
});

test('3. Stripe webhook rejects unsigned and forged events', async () => {
  const unsigned = await api.post('/api/webhooks/stripe', { data: '{}', headers: { 'content-type': 'application/json' } });
  // 500 here means STRIPE_WEBHOOK_SECRET is missing in this environment
  expect(unsigned.status(), 'unsigned webhook').toBe(400);
  const forged = await api.post('/api/webhooks/stripe', {
    data: JSON.stringify({ id: 'evt_forged', type: 'customer.subscription.deleted' }),
    headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
  });
  expect(forged.status(), 'forged webhook').toBe(401);
});

test('4. declined card (4000 0000 0000 0341) keeps the account on Free', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await ownerPage(browser);
  const { url } = await createCheckout(api, STANDARD, 3);
  await payOnStripeCheckout(page, url, '4000000000000341');
  await expect(page.getByText(/declined|was not successful|could not be processed/i).first()).toBeVisible({ timeout: 45_000 });
  expect(page.url()).toContain('checkout.stripe.com');
  // Give any stray webhook time to land, then confirm still Free
  await page.waitForTimeout(8_000);
  const sub = await getSub(api);
  expect(sub.planId).toBe(FREE);
});

test('5. upgrade Free -> Standard (3 seats) via Stripe Checkout with 4242', async ({ browser }) => {
  test.setTimeout(180_000);
  const page = await ownerPage(browser);
  const { url } = await createCheckout(api, STANDARD, 3);
  await payOnStripeCheckout(page, url, '4242424242424242');
  await page.waitForURL(/session_id=cs_test_/, { timeout: 60_000, waitUntil: 'commit' });
  const sub = await waitForSub(api, (s) => s.planId === STANDARD && s.status === 'active', 'Standard active via webhook');
  expect(sub.quantity).toBe(3);
  await waitForCompanyTier('standard', 'standard after Standard upgrade');

  // Duplicate paid checkout must be refused
  const dup = await api.post('/api/billing/checkout', { data: { planId: PRO, quantity: 3 } });
  expect(dup.status()).toBe(400);
});

test('6. Standard per-seat: adding a 4th tech auto-increases quantity with proration notice', async () => {
  test.setTimeout(120_000);
  // Paid per-seat: invite beyond seats is allowed (seat bumps on activate, not invite)
  const invite = await inviteTech(api);
  expect(invite.status, JSON.stringify(invite.body)).toBe(200);

  // Create inactive 4th tech, then activate via team API (returns seatAdded + notice)
  const { data, error } = await admin.auth.admin.createUser({
    email: `qa-billing-${RUN_ID}-tech4@cadenzaops.com`,
    password: `Qa!${crypto.randomBytes(18).toString('base64url')}`,
    email_confirm: true,
    user_metadata: { full_name: 'QA Billing Tech 4', company_id: companyId, role: 'technician' },
  });
  expect(error, error?.message).toBeNull();
  const tech4Id = data.user!.id;
  createdUserIds.push(tech4Id);
  const { error: deactErr } = await admin
    .from('cadenza_profiles')
    .update({ is_active: false })
    .eq('id', tech4Id);
  expect(deactErr, deactErr?.message).toBeNull();

  const { count: activeBefore } = await admin
    .from('cadenza_profiles').select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('role', 'technician').eq('is_active', true);
  expect(activeBefore).toBe(3);
  expect((await getSub(api)).quantity).toBe(3);

  const activate = await api.patch(`/api/team/${tech4Id}`, { data: { is_active: true } });
  const activateBody = await activate.json().catch(() => ({}));
  expect(activate.status(), JSON.stringify(activateBody)).toBe(200);
  expect(activateBody.seatAdded).toBe(true);
  expect(activateBody.notice).toBe('Se agregó un asiento; se cobrará prorrateado');

  await waitForSub(api, (s) => s.quantity === 4, 'quantity 4 after seat auto-increase');
  await expect
    .poll(async () => {
      const { data: row } = await admin
        .from('cadenza_billing_subscriptions')
        .select('quantity, status')
        .eq('user_id', ownerId)
        .eq('provider', 'stripe')
        .neq('status', 'canceled')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return row?.quantity as number | undefined;
    }, { message: 'cadenza_billing_subscriptions.quantity === 4', timeout: 90_000, intervals: [2_000, 3_000, 5_000] })
    .toBe(4);
});

test('7. upgrade Standard -> Pro (survives the subscription.updated webhook)', async () => {
  test.setTimeout(120_000);
  const sub = await getSub(api);
  const res = await api.patch('/api/billing/subscriptions', { data: { subscriptionId: sub.id, planId: PRO } });
  expect(res.status(), JSON.stringify(await res.json().catch(() => ({})))).toBe(200);
  await waitForSub(api, (s) => s.planId === PRO, 'Pro');
  await waitForCompanyTier('pro', 'pro after Pro upgrade');
  // Webhook from Stripe arrives a few seconds later; plan must not revert
  await new Promise((r) => setTimeout(r, 20_000));
  const after = await getSub(api);
  expect(after.planId).toBe(PRO);
  expect(after.status).toBe('active');
  await waitForCompanyTier('pro', 'pro still after webhook');
});

test('8. downgrade Pro -> Standard', async () => {
  test.setTimeout(120_000);
  const sub = await getSub(api);
  const res = await api.patch('/api/billing/subscriptions', { data: { subscriptionId: sub.id, planId: STANDARD } });
  expect(res.status(), JSON.stringify(await res.json().catch(() => ({})))).toBe(200);
  await waitForSub(api, (s) => s.planId === STANDARD, 'Standard');
  await waitForCompanyTier('standard', 'standard after downgrade');
  await new Promise((r) => setTimeout(r, 20_000));
  expect((await getSub(api)).planId).toBe(STANDARD);
  await waitForCompanyTier('standard', 'standard still after webhook');
});

test('9. cancel at period end, then cancel now -> back to Free after webhook', async () => {
  test.setTimeout(150_000);
  let sub = await getSub(api);
  const atEnd = await api.delete(`/api/billing/subscriptions?subscriptionId=${sub.id}&atPeriodEnd=true`);
  expect(atEnd.status()).toBe(200);
  sub = await waitForSub(api, (s) => s.cancelAtPeriodEnd === true, 'cancel_at_period_end');
  expect(sub.planId).toBe(STANDARD); // still entitled until period end

  const now = await api.delete(`/api/billing/subscriptions?subscriptionId=${sub.id}&atPeriodEnd=false`);
  expect(now.status()).toBe(200);
  await waitForSub(api, (s) => s.planId === FREE, 'back to Free');
  await waitForCompanyTier('free', 'free after cancel');

  // After customer.subscription.deleted webhook, the DB row must be canceled (not resurrected)
  await new Promise((r) => setTimeout(r, 20_000));
  const { data: rows } = await admin
    .from('cadenza_billing_subscriptions').select('status, provider').eq('user_id', ownerId).eq('provider', 'stripe');
  expect(rows?.length ?? 0).toBeGreaterThan(0);
  for (const r of rows ?? []) expect(r.status).toBe('canceled');
  expect((await getSub(api)).planId).toBe(FREE);
  await waitForCompanyTier('free', 'free still after webhook');
});
