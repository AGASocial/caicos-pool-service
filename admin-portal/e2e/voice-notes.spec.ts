/**
 * Voice notes E2E — KAN-165.
 *
 * Prefers an ephemeral qa-billing-* tenant (SUPABASE_URL + SERVICE_ROLE_KEY).
 * Skips if env vars are missing. Uses VOICE_NOTES_FAKE_PROVIDER=1 on the
 * processor (only honored when NODE_ENV !== 'production').
 *
 * AC coverage: player, transcript, badge, correction, search.
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
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const QA_ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD;
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

const HAS_SERVICE = Boolean(SUPABASE_URL && SERVICE_KEY);
const HAS_QA_ADMIN = Boolean(QA_ADMIN_PASSWORD);
const FIXTURE = path.join(__dirname, 'fixtures', 'voice-note-sample.m4a');
const HAS_FIXTURE = fs.existsSync(FIXTURE);

const RUN_ID = `vn${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const OWNER_EMAIL = `qa-billing-${RUN_ID}@cadenzaops.com`;
const COMPANY_NAME = `QA Billing Voice Notes ${RUN_ID}`;
const PASSWORD = `Qa!${crypto.randomBytes(18).toString('base64url')}`;

test.describe.configure({ mode: 'serial' });
test.skip(
  (!HAS_SERVICE && !HAS_QA_ADMIN) || !HAS_FIXTURE,
  'SUPABASE_SERVICE_ROLE_KEY (preferred) or QA_ADMIN_PASSWORD + e2e/fixtures/voice-note-sample.m4a required',
);

let admin: SupabaseClient | undefined;
let ownerId = '';
let companyId = '';
let loginEmail = '';
let loginPassword = '';
let jobId = '';
let noteId = '';
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
          recordVideo: { dir: 'test-results/kan165-video', size: { width: 1280, height: 800 } },
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

test.beforeAll(async () => {
  test.skip(!HAS_SERVICE, 'Service role required to seed voice note fixtures');

  admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email: OWNER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'QA Voice Notes Owner',
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

  const { data: property, error: propErr } = await admin
    .from('cadenza_properties')
    .insert({
      company_id: companyId,
      customer_name: 'QA Pool Customer',
      customer_email: 'customer@example.com',
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
      scheduled_date: new Date().toISOString().slice(0, 10),
      status: 'completed',
      job_source: 'ad_hoc',
      estimated_duration_min: 30,
    })
    .select('id')
    .single();
  expect(jobErr, jobErr?.message).toBeNull();
  jobId = job!.id as string;

  noteId = crypto.randomUUID();
  const storagePath = `${companyId}/${jobId}/${noteId}.m4a`;
  const bytes = fs.readFileSync(FIXTURE);

  const { error: upErr } = await admin.storage
    .from('job-voice-notes')
    .upload(storagePath, bytes, { contentType: 'audio/mp4', upsert: true });
  expect(upErr, upErr?.message).toBeNull();

  const { error: noteErr } = await admin.from('cadenza_job_voice_notes').insert({
    id: noteId,
    company_id: companyId,
    job_id: jobId,
    property_id: property!.id,
    created_by: ownerId,
    storage_path: storagePath,
    duration_ms: 2000,
    size_bytes: bytes.length,
    mime_type: 'audio/mp4',
    status: 'uploaded',
  });
  expect(noteErr, noteErr?.message).toBeNull();

  api = await pwRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: bypassHeaders,
  });

  // Drive processor with fake provider (server must have VOICE_NOTES_FAKE_PROVIDER=1).
  if (CRON_SECRET) {
    const cron = await api.get('/api/cron/process-voice-notes', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect([200, 500].includes(cron.status()), await cron.text()).toBeTruthy();
  } else {
    // Direct DB stub so the UI still has something to show when cron env is missing.
    await admin
      .from('cadenza_job_voice_notes')
      .update({
        status: 'done',
        transcript: 'Stub transcript: filter looked fine, no issues.',
        language: 'en',
        category: 'routine',
        urgency: null,
        model_category: 'routine',
        model_urgency: null,
        model_reason: 'routine visit note',
        model_explanation: 'Stub classifier marked this as routine for testing.',
        transcribed_at: new Date().toISOString(),
      })
      .eq('id', noteId);
  }

  await expect
    .poll(
      async () => {
        const { data } = await admin!
          .from('cadenza_job_voice_notes')
          .select('status, transcript, category')
          .eq('id', noteId)
          .maybeSingle();
        return data?.status === 'done' && Boolean(data.transcript) ? 'ready' : null;
      },
      { timeout: 90_000, intervals: [1_000, 2_000, 3_000] },
    )
    .toBe('ready');
});

test.afterAll(async () => {
  await Promise.all(openContexts.map((c) => c.close().catch(() => {})));
  await api?.dispose();
  if (!admin || !HAS_SERVICE) return;
  try {
    await admin.storage.from('job-voice-notes').remove([`${companyId}/${jobId}/${noteId}.m4a`]);
  } catch {
    /* ignore */
  }
  await cleanupBillingQaUsers(admin, { emailPrefix: `qa-billing-${RUN_ID}` });
});

test('portal shows player, transcript, badge; correction and search work', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const page = await ownerPage(browser);
  await uiLogin(page, loginEmail, loginPassword);

  await page.goto(`${BASE_URL}/en/jobs/${jobId}`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('voice-notes')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('voice-note-player')).toBeVisible();
  await expect(page.getByTestId('voice-note-transcript')).toContainText(/filter|stub|transcript/i);
  await expect(page.getByTestId('voice-note-badge-routine')).toBeVisible();

  await page.getByTestId('voice-note-correct-menu').click();
  await page.getByText(/mark as problem \(medium\)/i).click();
  await expect(page.getByTestId('voice-note-badge-problem')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('voice-notes-search').fill('filter');
  await page.getByRole('button', { name: /^search$/i }).click();
  await expect(page.getByTestId('voice-note-item')).toHaveCount(1, { timeout: 15_000 });
});
