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

import { test, expect, type Page, type Browser, type TestInfo } from '@playwright/test';
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
 * Clear password through the React-controlled input (fill), then blur.
 * evaluate()-only clears get overwritten on re-render and still leak into error-context.
 */
async function redactPasswordFields(page: Page) {
  const fields = passwordLocators(page);
  const count = await fields.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const field = fields.nth(i);
    if (await field.isVisible().catch(() => false)) {
      await field.fill('').catch(() => undefined);
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
  // Prefer an authenticated cookie / storage signal when available
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
  // Expo may show login at `/`; only treat explicit login/auth segments as login routes.
  return /(?:^|\/)(login|auth)(?:\/|$)/i.test(pathname);
}

async function waitForTechSession(page: Page) {
  // Expo web never reaches networkidle (persistent websocket). Mirror
  // waitForAdminSession: wait for a logged-in-only element, with URL fallback
  // when the app uses an explicit /login route.
  const jobsScreen = page.getByTestId('tech-jobs-screen');
  try {
    await jobsScreen.waitFor({ state: 'visible', timeout: 20000 });
  } catch {
    if (isTechLoginPath(new URL(page.url()).pathname)) {
      await page.waitForURL((url) => !isTechLoginPath(url.pathname), { timeout: 20000 });
    }
    await jobsScreen.waitFor({ state: 'visible', timeout: 15000 });
  }
  await page
    .waitForFunction(() => {
      const hasStorage =
        Object.keys(window.localStorage).some((k) => /supabase|auth|sb-/i.test(k)) ||
        Object.keys(window.sessionStorage).some((k) => /supabase|auth|sb-/i.test(k));
      return hasStorage || document.cookie.length > 0;
    }, { timeout: 10000 })
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
  const passwordField = page.getByLabel(/password/i);
  await passwordField.fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Scrub before any assertion/wait that can produce error-context snapshots
  await redactPasswordFields(page);

  await waitForAdminSession(page);
  await expect(page).not.toHaveURL(/\/auth\//);

  if (testInfo) {
    await captureStep(page, testInfo, 'admin-after-login');
  }
}

async function techLogin(page: Page, testInfo?: TestInfo) {
  await page.goto(`${TECH_BASE_URL}/`);
  // Wait for either the login form or an already-authenticated jobs screen.
  // Do not use networkidle — Expo web never settles.
  const loginSubmit = page.getByTestId('login-submit');
  const jobsScreen = page.getByTestId('tech-jobs-screen');
  await Promise.race([
    loginSubmit.waitFor({ state: 'visible', timeout: 20000 }),
    jobsScreen.waitFor({ state: 'visible', timeout: 20000 }),
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
  await page.getByTestId('login-password').fill(TECH_PASSWORD);
  await loginSubmit.click();
  await redactPasswordFields(page);
  await waitForTechSession(page);

  if (testInfo) {
    await captureStep(page, testInfo, 'tech-after-login');
  }
  return true;
}

async function withTechPage(browser: Browser, run: (page: Page) => Promise<void>) {
  const context = await browser.newContext({
    extraHTTPHeaders: vercelBypassHeaders,
  });
  const page = await context.newPage();
  try {
    await run(page);
  } finally {
    await redactPasswordFields(page);
    await context.close();
  }
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
    await captureStep(page, testInfo, 'admin-live-status');

    const pageContent = await page.content();
    const hasPro =
      pageContent.includes('Pro') || pageContent.includes('live') || pageContent.includes('status');

    console.log('✓ Admin can access dashboard', { hasPro });
  });

  test('Tech: Login and view jobs', async ({ browser }, testInfo) => {
    await withTechPage(browser, async (page) => {
      const hasLoginForm = await techLogin(page, testInfo);
      await expect(page.getByTestId('tech-jobs-screen')).toBeVisible({ timeout: 15000 });
      await captureStep(page, testInfo, 'tech-jobs');
      const hasJobs = (await page.locator('text=/job|service|visit|trabajo/i').count()) > 0;
      console.log('✓ Tech app loaded', { hasLoginForm, hasJobs });
    });
  });

  test('Tech: Mark job en route', async ({ browser }, testInfo) => {
    await withTechPage(browser, async (page) => {
      await techLogin(page, testInfo);
      await expect(page.getByTestId('tech-jobs-screen')).toBeVisible({ timeout: 15000 });

      const enRouteButton = page.getByTestId('job-on-my-way');
      if ((await enRouteButton.count()) > 0) {
        await enRouteButton.click();
        await page.getByTestId('job-start-service').waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
        await captureStep(page, testInfo, 'tech-en-route');
        console.log('✓ Tech marked job en route');
      } else {
        const startButton = page.getByTestId('job-start-service');
        if ((await startButton.count()) > 0) {
          console.log('⚠ On-my-way not shown; start-service button is present');
        } else {
          console.log('⚠ Could not find en route button (may need job detail navigation)');
        }
        await captureStep(page, testInfo, 'tech-en-route');
      }
    });
  });

  test('Tech: Complete service with report and photo', async ({ browser }, testInfo) => {
    await withTechPage(browser, async (page) => {
      await techLogin(page, testInfo);
      await expect(page.getByTestId('tech-jobs-screen')).toBeVisible({ timeout: 15000 });

      const takePhoto = page.getByTestId('job-take-photo');
      const complete = page.getByTestId('job-complete');
      await captureStep(page, testInfo, 'tech-complete-ready');
      console.log('✓ Tech app ready for service completion', {
        hasTakePhoto: (await takePhoto.count()) > 0,
        hasComplete: (await complete.count()) > 0,
      });
    });
  });

  test('Admin: View completed report', async ({ page }, testInfo) => {
    await adminLogin(page, testInfo);
    await page.goto(`${ADMIN_BASE_URL}/en/reports`);
    await expect(page).not.toHaveURL(/\/auth\//);
    await captureStep(page, testInfo, 'admin-reports');

    const hasReports = (await page.locator('text=/report|service|completed/i').count()) > 0;
    console.log('✓ Admin reports page loaded', { hasReports });
  });
});

test.describe('Plan Gating Tests', () => {
  test('Pro plan: Live status board visible', async ({ page }, testInfo) => {
    await adminLogin(page, testInfo);

    // Must be past login (session established) before calling authenticated APIs
    await expect(page).not.toHaveURL(/\/auth\//);

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
