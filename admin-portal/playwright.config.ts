import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for admin-portal E2E tests
 *
 * In CI: tests run against Vercel preview deployment
 * Locally: tests run against local dev server
 *
 * Secrets:
 * - PLAYWRIGHT_NO_COPY_PROMPT disables error-context.md page snapshots
 * - Specs enter passwords via evaluate (never locator.fill(secret) — that
 *   records Fill "<secret>" in HTML report step titles)
 * - Specs clear+blur password fields after submit without fill(secret)
 * - Manual screenshots use mask: [password locators]
 * - Trace is off in CI (typed passwords can land in trace.zip action logs)
 * - Locally: on-first-retry with no DOM snapshots/sources
 * - Tech Expo-web flows set test.setTimeout(120_000) in the spec
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // E2E tests with shared state must run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1, // Sequential for data consistency
  timeout: 60 * 1000, // 60s default; tech tests raise to 120s in-spec
  reporter: process.env.CI
    ? [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['list'],
      ]
    : 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    // CI: off — fill() values are recorded in trace.zip and bypass text-only secret scans
    trace: process.env.CI
      ? 'off'
      : {
          mode: 'on-first-retry',
          snapshots: false,
          screenshots: true,
          sources: false,
        },
    // Failure screenshots on; key-step shots taken explicitly with password mask in the spec
    screenshot: 'only-on-failure',
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
