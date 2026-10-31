/**
 * Full E2E Flow: Admin + Technician
 *
 * Tests the complete user journey:
 * 1. Admin logs in and views live status board
 * 2. Tech logs in and sees today's jobs
 * 3. Tech marks job "en route" → admin sees it in real-time
 * 4. Tech completes service with report + photo → admin sees report
 * 5. Pro plan features are visible
 */

import { test, expect, type Page, type Locator, type Browser, type TestInfo } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Validate required environment variables
function validateTestEnvironment() {
  const missing: string[] = [];

  if (!process.env.QA_ADMIN_PASSWORD) missing.push('QA_ADMIN_PASSWORD');
  if (!process.env.QA_TECH_PASSWORD) missing.push('QA_TECH_PASSWORD');

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    console.error(`❌ ${msg}`);
    throw new Error(msg);
  }
}

// Validate on module load
validateTestEnvironment();

const ADMIN_EMAIL = 'qa-admin@cadenzaops.com';
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD!;
const TECH_EMAIL = 'qa-tech@cadenzaops.com';
const TECH_PASSWORD = process.env.QA_TECH_PASSWORD!;

const ADMIN_BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const TECH_BASE_URL = process.env.PLAYWRIGHT_TECH_BASE_URL || 'http://localhost:8081';

const PHOTO_FIXTURE = path.join(__dirname, 'fixtures', 'pool-photo.png');

/** QA property 1 (123 Test St, Austin) — near enough for distance check. */
const QA_GEOLOCATION = { latitude: 30.2672, longitude: -97.7431, accuracy: 10 };

const vercelBypassHeaders: Record<string, string> | undefined =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    ? {
        'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        'x-vercel-set-bypass-cookie': 'true',
      }
    : undefined;

const SCREENSHOT_DIR = path.join('test-results', 'screenshots');

function passwordLocators(page: Page) {
  return page.locator(
    'input[type="password"], [data-testid="login-password"], input[name="password"], input[autocomplete="current-password"]'
  );
}

/**
 * Set a password without Playwright recording the value in step titles
 * (locator.fill(secret) becomes Fill "<secret>" in the HTML report).
 */
async function fillPassword(locator: Locator, password: string) {
  await test.step('Enter password', async () => {
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    await locator.evaluate((el, value) => {
      const input = el as HTMLInputElement;
      const proto = Object.getPrototypeOf(input) as HTMLInputElement;
      const protoDesc = Object.getOwnPropertyDescriptor(proto, 'value');
      const ownDesc = Object.getOwnPropertyDescriptor(input, 'value');
      if (protoDesc?.set && ownDesc?.set && protoDesc.set !== ownDesc.set) {
        protoDesc.set.call(input, value);
      } else if (protoDesc?.set) {
        protoDesc.set.call(input, value);
      } else if (ownDesc?.set) {
        ownDesc.set.call(input, value);
      } else {
        input.value = value;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, password);
  });
}

/**
 * Clear password through React-controlled input without logging secrets.
 */
async function redactPasswordFields(page: Page) {
  const fields = passwordLocators(page);
  const count = await fields.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const field = fields.nth(i);
    if (await field.isVisible().catch(() => false)) {
      await field
        .evaluate((el) => {
          const input = el as HTMLInputElement;
          const proto = Object.getPrototypeOf(input) as HTMLInputElement;
          const protoDesc = Object.getOwnPropertyDescriptor(proto, 'value');
          protoDesc?.set?.call(input, '');
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        })
        .catch(() => undefined);
      await field.blur().catch(() => undefined);
    }
  }
}

function isAuthedAppPath(pathname: string): boolean {
  const pathNoSlash = pathname.replace(/\/$/, '') || '/';
  if (pathNoSlash.includes('/auth')) return false;
  return (
    pathNoSlash === '/en' ||
    pathNoSlash === '/es' ||
    pathNoSlash.startsWith('/en/') ||
    pathNoSlash.startsWith('/es/')
  );
}

async function waitForAdminSession(page: Page) {
  await page.waitForURL((url) => isAuthedAppPath(url.pathname), { timeout: 20000 });
  await page
    .waitForFunction(() => {
      const hasCookie = document.cookie.length > 0;
      const hasStorage =
        Object.keys(window.localStorage).some((k) => /supabase|auth|sb-/i.test(k)) ||
        Object.keys(window.sessionStorage).some((k) => /supabase|auth|sb-/i.test(k));
      return hasCookie || hasStorage;
    }, { timeout: 10000 })
    .catch(() => undefined);
}

function isTechLoginPath(pathname: string): boolean {
  return /(?:^|\/)(login|auth)(?:\/|$)/i.test(pathname);
}

/**
 * Jobs list marker: wrapping View with data-testid="tech-jobs-screen"
 * (FlatList testIDs are not reliably visible on Expo web).
 * Fallback: schedule header text (en/es).
 */
async function waitForTechSession(page: Page) {
  const jobsScreen = page.getByTestId('tech-jobs-screen');
  const scheduleText = page.getByText(/today'?s schedule|agenda de hoy|upcoming jobs|pr[oó]ximos trabajos/i).first();
  try {
    await Promise.race([
      jobsScreen.waitFor({ state: 'visible', timeout: 25000 }),
      scheduleText.waitFor({ state: 'visible', timeout: 25000 }),
    ]);
  } catch {
    if (isTechLoginPath(new URL(page.url()).pathname)) {
      await page.waitForURL((url) => !isTechLoginPath(url.pathname), { timeout: 15000 });
    }
    await Promise.race([
      jobsScreen.waitFor({ state: 'visible', timeout: 15000 }),
      scheduleText.waitFor({ state: 'visible', timeout: 15000 }),
    ]);
  }
  await page
    .waitForFunction(() => {
      const hasStorage =
        Object.keys(window.localStorage).some((k) => /supabase|auth|sb-/i.test(k)) ||
        Object.keys(window.sessionStorage).some((k) => /supabase|auth|sb-/i.test(k));
      return hasStorage || document.cookie.length > 0;
    }, { timeout: 8000 })
    .catch(() => undefined);
}

async function captureStep(page: Page, testInfo: TestInfo, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({
    path: filePath,
    fullPage: false,
    mask: [passwordLocators(page)],
  });
  await testInfo.attach(name, { path: filePath, contentType: 'image/png' });
}

async function adminLogin(page: Page, testInfo?: TestInfo) {
  await page.goto(`${ADMIN_BASE_URL}/en/auth/login`);
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await fillPassword(page.getByLabel(/password/i), ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await redactPasswordFields(page);

  await waitForAdminSession(page);
  await expect(page).not.toHaveURL(/\/auth\//);

  if (testInfo) {
    await captureStep(page, testInfo, 'admin-after-login');
  }
}

async function techLogin(page: Page, testInfo?: TestInfo) {
  await page.goto(`${TECH_BASE_URL}/`);
  const loginSubmit = page.getByTestId('login-submit');
  const jobsScreen = page.getByTestId('tech-jobs-screen');
  const scheduleText = page.getByText(/today'?s schedule|agenda de hoy/i).first();
  await Promise.race([
    loginSubmit.waitFor({ state: 'visible', timeout: 20000 }),
    jobsScreen.waitFor({ state: 'visible', timeout: 20000 }),
    scheduleText.waitFor({ state: 'visible', timeout: 20000 }),
  ]);

  const hasLoginForm = (await loginSubmit.count()) > 0 && (await loginSubmit.isVisible());
  if (!hasLoginForm) {
    await waitForTechSession(page);
    if (testInfo) {
      await captureStep(page, testInfo, 'tech-after-login');
    }
    return false;
  }

  await page.getByTestId('login-email').fill(TECH_EMAIL);
  await fillPassword(page.getByTestId('login-password'), TECH_PASSWORD);
  await loginSubmit.click();
  await redactPasswordFields(page);
  await waitForTechSession(page);

  if (testInfo) {
    await captureStep(page, testInfo, 'tech-after-login');
  }
  return true;
}

async function openFirstTechJob(page: Page) {
  const card = page.getByTestId('tech-job-card').first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click();
  await expect(page.getByTestId('tech-job-detail')).toBeVisible({ timeout: 15000 });
}

async function withTechPage(browser: Browser, run: (page: Page) => Promise<void>) {
  const context = await browser.newContext({
    extraHTTPHeaders: vercelBypassHeaders,
    // Grant geolocation so Expo Location.requestForegroundPermissionsAsync succeeds
    // and distance check runs against the QA property coords.
    permissions: ['geolocation'],
    geolocation: QA_GEOLOCATION,
  });
  const page = await context.newPage();
  // Expo web uses window.alert — accept so tests don't hang; message is logged.
  page.on('dialog', async (dialog) => {
    console.log(`Tech web dialog (${dialog.type()}): ${dialog.message().slice(0, 200)}`);
    await dialog.accept();
  });
  try {
    await run(page);
  } finally {
    await redactPasswordFields(page);
    await context.close();
  }
}

/**
 * Ensure the job is in_progress (service form visible). Waits for Start Service —
 * never use isVisible() alone (no auto-wait).
 */
async function ensureJobStarted(page: Page) {
  const startButton = page.getByTestId('job-start-service');
  const enRoute = page.getByTestId('job-on-my-way');
  const complete = page.getByTestId('job-complete');

  // Already on the service form (prior test left job in_progress).
  if (await complete.isVisible().catch(() => false)) {
    return;
  }

  await expect(startButton).toBeVisible({ timeout: 15000 });

  if (await enRoute.isVisible().catch(() => false)) {
    await enRoute.click();
    await expect(enRoute).toBeHidden({ timeout: 10000 });
    await expect(startButton).toBeVisible({ timeout: 10000 });
  }

  await expect(startButton).toBeVisible({ timeout: 10000 });
  await startButton.click();

  await expect(page.getByTestId('job-status')).toContainText(/in_progress/i, {
    timeout: 15000,
  });
  await expect(complete).toBeVisible({ timeout: 20000 });
}

/** Attach a photo via gallery → file input setInputFiles (Expo web). */
async function attachJobPhoto(page: Page) {
  const fromGallery = page.getByTestId('job-from-gallery');
  await expect(fromGallery).toBeVisible({ timeout: 10000 });

  // Kick off ImagePicker so a file input / chooser appears, then set files.
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null);
  await fromGallery.click();

  const fileInput = page.locator('input[type="file"]').first();
  const inputAppeared = await fileInput
    .waitFor({ state: 'attached', timeout: 8000 })
    .then(() => true)
    .catch(() => false);

  if (inputAppeared) {
    await fileInput.setInputFiles(PHOTO_FIXTURE);
  } else {
    const chooser = await chooserPromise;
    expect(chooser, 'Expected filechooser or input[type=file] after From Gallery').toBeTruthy();
    await chooser!.setFiles(PHOTO_FIXTURE);
  }

  // Give ImagePicker a beat to commit the asset into React state
  await page.waitForTimeout(1000);
}

test.describe.configure({ mode: 'serial' });

test.describe('Full E2E Flow', () => {
  test('Admin: Login and view dashboard', async ({ page }, testInfo) => {
    await adminLogin(page, testInfo);
    await expect(page.getByText(/dashboard|welcome/i).first()).toBeVisible({ timeout: 10000 });
    await captureStep(page, testInfo, 'admin-dashboard');
    console.log('✓ Admin logged in');
  });

  test('Admin: View live status board (Pro feature)', async ({ page }, testInfo) => {
    await adminLogin(page, testInfo);
    await page.goto(`${ADMIN_BASE_URL}/en/dashboard`);
    await expect(page).not.toHaveURL(/\/auth\//);
    await expect(page.getByTestId('live-status-board')).toBeVisible({ timeout: 20000 });
    await captureStep(page, testInfo, 'admin-live-status');
    console.log('✓ Admin can access live status board');
  });

  test('Tech: Login and view jobs', async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    await withTechPage(browser, async (page) => {
      const hasLoginForm = await techLogin(page, testInfo);
      await expect(page.getByTestId('tech-jobs-screen')).toBeVisible({ timeout: 15000 });
      await captureStep(page, testInfo, 'tech-jobs');
      const hasJobs = (await page.getByTestId('tech-job-card').count()) > 0;
      console.log('✓ Tech app loaded', { hasLoginForm, hasJobs });
    });
  });

  test('Tech: Mark job en route', async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    let markedEnRoute = false;

    await withTechPage(browser, async (page) => {
      await techLogin(page, testInfo);
      await expect(page.getByTestId('tech-jobs-screen')).toBeVisible({ timeout: 15000 });
      await openFirstTechJob(page);

      const enRouteButton = page.getByTestId('job-on-my-way');
      const startButton = page.getByTestId('job-start-service');

      // Pending jobs show BOTH buttons at once — never assert .or() (strict mode).
      await expect(startButton).toBeVisible({ timeout: 15000 });

      if (await enRouteButton.isVisible().catch(() => false)) {
        await enRouteButton.click();
        // Status → en_route: On My Way unmounts; Start Service stays.
        await expect(enRouteButton).toBeHidden({ timeout: 10000 });
        await expect(startButton).toBeVisible({ timeout: 10000 });
        markedEnRoute = true;
        console.log('✓ Tech marked job en route');
      } else {
        console.log('⚠ On-my-way not shown (job may already be en_route/in_progress)');
      }
      await captureStep(page, testInfo, 'tech-en-route');
    });

    // Confirm admin live status board reflects en_route when we just flipped it.
    if (markedEnRoute) {
      const adminContext = await browser.newContext({
        extraHTTPHeaders: vercelBypassHeaders,
      });
      const adminPage = await adminContext.newPage();
      try {
        await adminLogin(adminPage);
        await adminPage.goto(`${ADMIN_BASE_URL}/en/dashboard`);
        await expect(adminPage).not.toHaveURL(/\/auth\//);
        await expect(adminPage.getByTestId('live-status-board')).toBeVisible({ timeout: 15000 });
        await expect(adminPage.getByTestId('live-status-badge-en_route').first()).toBeVisible({
          timeout: 20000,
        });
        await captureStep(adminPage, testInfo, 'admin-en-route-status');
        console.log('✓ Admin live status board shows en_route');
      } finally {
        await redactPasswordFields(adminPage);
        await adminContext.close();
      }
    }
  });

  test('Tech: Complete service with report and photo', async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    await withTechPage(browser, async (page) => {
      await techLogin(page, testInfo);
      await expect(page.getByTestId('tech-jobs-screen')).toBeVisible({ timeout: 15000 });
      await openFirstTechJob(page);

      const takePhoto = page.getByTestId('job-take-photo');
      const fromGallery = page.getByTestId('job-from-gallery');
      const complete = page.getByTestId('job-complete');

      await ensureJobStarted(page);

      // After start, gallery + take-photo + complete are all on screen — assert each, never .or().
      await expect(complete).toBeVisible({ timeout: 20000 });
      await expect(fromGallery).toBeVisible({ timeout: 10000 });
      await expect(takePhoto).toBeVisible({ timeout: 10000 });

      // Report fields (notes always visible; expand chemicals for a reading)
      const notes = page.getByTestId('job-notes');
      await expect(notes).toBeVisible({ timeout: 10000 });
      await notes.fill('E2E QA visit — chemicals and photo attached');

      const chemToggle = page.getByTestId('job-chem-toggle');
      await expect(chemToggle).toBeVisible({ timeout: 5000 });
      await chemToggle.click();
      const phInput = page.getByTestId('job-chem-ph_level');
      await expect(phInput).toBeVisible({ timeout: 5000 });
      await phInput.fill('7.4');

      // Prefer file input setInputFiles on Expo web (camera permissions are awkward in CI)
      await attachJobPhoto(page);

      await expect(complete).toBeEnabled({ timeout: 5000 });
      await complete.click();

      // Success: back to jobs list (or at least leave the complete button)
      await expect(page.getByTestId('tech-jobs-screen')).toBeVisible({ timeout: 30000 });
      console.log('✓ Tech completed service with report and photo');
      await captureStep(page, testInfo, 'tech-complete');
    });
  });

  test('Admin: View completed report', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await adminLogin(page, testInfo);
    await page.goto(`${ADMIN_BASE_URL}/en/reports`);
    await expect(page).not.toHaveURL(/\/auth\//);
    await expect(page.getByTestId('admin-reports')).toBeVisible({ timeout: 20000 });
    // Stats load async after mount — wait for completed card + numeric count
    await expect(page.getByTestId('reports-completed')).toBeVisible({ timeout: 20000 });
    const countEl = page.getByTestId('reports-completed-count');
    await expect(countEl).toBeVisible({ timeout: 10000 });
    await expect(countEl).toHaveText(/\d+/, { timeout: 10000 });
    await captureStep(page, testInfo, 'admin-report');
    console.log('✓ Admin reports page loaded with completed stats');
  });
});

test.describe('Plan Gating Tests', () => {
  test('Pro plan: Live status board visible', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await adminLogin(page, testInfo);

    await expect(page).not.toHaveURL(/\/auth\//);

    // Board on dashboard (Pro)
    await page.goto(`${ADMIN_BASE_URL}/en/dashboard`);
    await expect(page).not.toHaveURL(/\/auth\//);
    const board = page.getByTestId('live-status-board');
    await expect(board).toBeVisible({ timeout: 20000 });
    // Prefer a status badge once data loads; empty board is still a valid Pro feature render
    const badge = page.locator('[data-testid^="live-status-badge-"]').first();
    const emptyBoard = board.getByText(/no jobs/i);
    await Promise.race([
      badge.waitFor({ state: 'visible', timeout: 20000 }),
      emptyBoard.waitFor({ state: 'visible', timeout: 20000 }),
    ]).catch(() => undefined);
    await captureStep(page, testInfo, 'admin-pro-live-status');

    const response = await page.request.get(`${ADMIN_BASE_URL}/api/billing/plan-features`, {
      headers: vercelBypassHeaders,
    });

    if (!response.ok()) {
      console.error(`plan-features failed: status=${response.status()} body=${(await response.text()).slice(0, 500)}`);
    }
    expect(response.ok(), `plan-features status=${response.status()}`).toBeTruthy();

    const data = await response.json();
    console.log('Plan features:', data);
    await captureStep(page, testInfo, 'admin-plan-features');

    if (data.planId?.includes('pro')) {
      expect(data.features?.live_status_board).toBe(true);
    }
  });
});
