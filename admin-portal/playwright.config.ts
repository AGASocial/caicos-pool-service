import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for admin-portal E2E tests
 *
 * In CI: tests run against Vercel preview deployment
 * Locally: tests run against local dev server
 *
 * Secrets: avoid retaining password field values in artifacts.
 * - No video (keystrokes visible)
 * - Trace without DOM snapshots/sources (error-context / snapshot dumps)
 * - Screenshots on failure only; specs also redact password inputs after fill
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // E2E tests with shared state must run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1, // Sequential for data consistency
  timeout: 60 * 1000, // 60s per test
  reporter: process.env.CI
    ? [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['list'],
      ]
    : 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    // Keep action/log traces for debugging, but omit DOM snapshots that can embed secrets
    trace: {
      mode: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
      snapshots: false,
      screenshots: true,
      sources: false,
    },
    // CI: skip page screenshots — login failures previously leaked passwords via error-context/PNG
    screenshot: process.env.CI ? 'off' : 'only-on-failure',
    video: 'off',
    // Vercel Deployment Protection bypass (CI preview URLs)
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          'x-vercel-set-bypass-cookie': 'true',
        }
      : {},
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Only start local server when not in CI (CI uses Vercel preview)
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120 * 1000,
      },
});
