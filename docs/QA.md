# QA & E2E Testing Guide

Automated end-to-end testing for Cadenza across admin-portal (Next.js) and technician-app (Expo).

## Overview

The E2E test suite validates complete user flows with real UI and real data:
- Admin logs in, views live status board (Pro feature)
- Technician logs in, marks job "en route"
- Admin sees real-time status update
- Technician completes service with report and photo
- Admin views completed report

**Key principles:**
- Tests run against the **shared Supabase instance** (production database)
- All test data is **strictly scoped** to QA company ID `45173a02-9f30-4a07-89bb-16923bd043b5`
- Tests **never touch** data from other companies
- Seed and cleanup scripts are **idempotent** and **safe**

## Test Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub Actions Workflow (.github/workflows/e2e-qa.yml)      │
├─────────────────────────────────────────────────────────────┤
│ 1. Lint & Type Check (admin-portal + technician-app)        │
│ 2. Unit Tests (admin-portal Jest)                           │
│ 3. Wait for Vercel Preview Deployment                       │
│ 4. Seed QA Data (scripts/qa-seed-cleanup.ts seed)          │
│ 5. Build & Serve Expo Web (technician-app)                 │
│ 6. Run E2E Tests (Playwright)                               │
│    - Admin portal: Vercel preview URL                       │
│    - Tech app: localhost:8081 (Expo web build)             │
│ 7. Cleanup QA Data (scripts/qa-seed-cleanup.ts cleanup)    │
│ 8. Post PR Comment with Results                             │
└─────────────────────────────────────────────────────────────┘
```

## Required GitHub Secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Description | Example |
|--------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | `eyJhbGciOi...` |
| `SUPABASE_ANON_KEY` | Public anon key (for app) | `eyJhbGciOi...` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel protection bypass token | From Vercel project settings |
| `QA_ADMIN_PASSWORD` | Password for `qa-admin@cadenzaops.com` | Complex password |
| `QA_TECH_PASSWORD` | Password for `qa-tech@cadenzaops.com` | Complex password |

### Getting the Vercel bypass secret

1. Go to Vercel project settings → Deployment Protection
2. Generate an automation bypass secret
3. Copy the secret value
4. Add to GitHub secrets as `VERCEL_AUTOMATION_BYPASS_SECRET`

## QA Test Data

### QA Company
- **ID:** `45173a02-9f30-4a07-89bb-16923bd043b5`
- **Name:** (varies — check Supabase)
- **Tier:** `pro` (for plan-gating tests)

### QA Users

| Email | User ID | Role | Purpose |
|-------|---------|------|---------|
| `qa-admin@cadenzaops.com` | `5257cbb7-0481-4278-b57f-18bc651e20bd` | `admin` | Admin portal tests |
| `qa-tech@cadenzaops.com` | `8bc9982d-6814-4d4c-9665-cac788be942e` | `technician` | Technician app tests |
| `qa-tech2@cadenzaops.com` | (dynamic) | `technician` | Multi-tech scenarios |
| `qa-tech3@cadenzaops.com` | (dynamic) | `technician` | Multi-tech scenarios |

**Note:** The seed script creates additional techs (qa-tech2, qa-tech3) dynamically.

### Seeded Data
- **Properties:** 3 test properties (123 Test St, 456 Demo Ave, 789 Sample Blvd)
- **Route:** 1 route ("QA Test Route") assigned to qa-tech
- **Route Stops:** 3 stops (one per property), scheduled for today
- **Jobs:** 3 jobs for TODAY (in America/Chicago timezone)
- **Subscription:** Pro plan subscription for qa-admin (for plan gating)

## Running Tests Locally

### Prerequisites
1. Node.js 20+
2. Supabase credentials (`.env.local` in admin-portal and technician-app)
3. QA user passwords

### Setup

```bash
# 1. Install dependencies
cd admin-portal && npm install
cd ../technician-app && npm install

# 2. Install Playwright browsers
cd admin-portal
npx playwright install chromium

# 3. Set environment variables
export SUPABASE_URL=https://xxxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
export SUPABASE_ANON_KEY=eyJhbGciOi...
export QA_ADMIN_PASSWORD=your-password
export QA_TECH_PASSWORD=your-password
```

### Run Full Test Suite

```bash
# From repo root:

# 1. Seed QA data
npx tsx scripts/qa-seed-cleanup.ts seed

# 2. Start admin-portal dev server (in terminal 1)
cd admin-portal
npm run dev

# 3. Build and serve Expo web (in terminal 2)
cd technician-app
npx expo export:web
npx serve web-build -l 8081

# 4. Run E2E tests (in terminal 3)
cd admin-portal
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 \
PLAYWRIGHT_TECH_BASE_URL=http://localhost:8081 \
npx playwright test ../e2e/full-flow.spec.ts

# 5. Cleanup QA data
cd ..
npx tsx scripts/qa-seed-cleanup.ts cleanup
```

### Run Individual Steps

```bash
# Seed only
npx tsx scripts/qa-seed-cleanup.ts seed

# Cleanup only
npx tsx scripts/qa-seed-cleanup.ts cleanup

# Run tests with UI (local debugging)
cd admin-portal
npx playwright test --ui

# Run specific test
npx playwright test -g "Admin: Login"
```

## Writing New E2E Tests

E2E tests live in `/e2e/full-flow.spec.ts` (or create new `*.spec.ts` files in `/e2e/`).

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

const ADMIN_BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const TECH_BASE_URL = process.env.PLAYWRIGHT_TECH_BASE_URL || 'http://localhost:8081';

test.describe('My Feature', () => {
  test('Admin: Does something', async ({ page }) => {
    await page.goto(`${ADMIN_BASE_URL}/en/auth/login`);
    // ... login and test
  });

  test('Tech: Does something', async ({ browser }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
        ? {
            'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
            'x-vercel-set-bypass-cookie': 'samesitenone',
          }
        : {},
    });
    const page = await context.newPage();
    await page.goto(`${TECH_BASE_URL}/`);
    // ... test tech app
    await context.close();
  });
});
```

### Best Practices

1. **Sequential tests:** Use `test.describe.configure({ mode: 'serial' })` when tests depend on each other
2. **Shared state:** Store IDs in module-level variables (e.g., `let sharedJobId: string`)
3. **Waits:** Use `waitForLoadState('networkidle')` and explicit waits for dynamic content
4. **Cleanup:** Always clean up test data after the suite
5. **Screenshots:** Playwright automatically captures screenshots on failure

### Example: Testing a New Feature

```typescript
test('Admin: Create new property', async ({ page }) => {
  // Login
  await page.goto(`${ADMIN_BASE_URL}/en/auth/login`);
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/.*\/en\/(dashboard)?/);

  // Navigate to properties
  await page.goto(`${ADMIN_BASE_URL}/en/properties`);
  
  // Click "Add Property"
  await page.getByRole('button', { name: /add property/i }).click();
  
  // Fill form
  await page.getByLabel(/customer name/i).fill('Test Customer');
  await page.getByLabel(/address/i).fill('123 New St');
  // ...
  
  // Submit
  await page.getByRole('button', { name: /save|create/i }).click();
  
  // Verify
  await expect(page.getByText('Test Customer')).toBeVisible();
});
```

## CI/CD Integration

### Triggering E2E Tests

E2E tests run automatically on **every PR to `develop`**:
1. Push commits to your PR branch
2. GitHub Actions triggers `e2e-qa.yml` workflow
3. Workflow waits for Vercel preview deployment
4. Tests run against preview URL + local Expo web
5. Results posted as PR comment

### Required Branch Protection Rules

Configure these in **Settings → Branches → Branch protection rules** for `develop`:

- ✅ Require status checks to pass:
  - `Lint & Type Check (admin-portal)`
  - `Lint & Type Check (technician-app)`
  - `Unit Tests`
  - `E2E Tests`
  - `E2E QA Status`

### Viewing Test Results

1. **PR Comment:** Summary table with pass/fail counts
2. **Actions Tab:** Full workflow logs and Playwright HTML report
3. **Artifacts:** Download screenshots and videos (retained 30 days)

## Troubleshooting

### Tests fail with "Unauthorized"
- Verify `QA_ADMIN_PASSWORD` and `QA_TECH_PASSWORD` secrets are set
- Check that QA users exist in Supabase Auth

### Tests timeout waiting for Vercel preview
- Increase `max_timeout` in `wait-for-vercel-preview` step
- Check Vercel deployment logs for build errors

### Expo web build fails
- Ensure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set
- Check `technician-app/package.json` for missing dependencies

### Test data conflicts
- Run cleanup: `npx tsx scripts/qa-seed-cleanup.ts cleanup`
- Verify QA company ID in Supabase matches `45173a02-9f30-4a07-89bb-16923bd043b5`

### Screenshots missing
- Check `admin-portal/test-results/` directory
- Ensure `screenshot: 'only-on-failure'` in playwright.config.ts

## Native Mobile Testing (Future)

For **pre-release validation** of native features (camera, GPS, photo stamp), use **Maestro**:

### Setup Maestro (KAN-68)

```bash
# Install Maestro CLI
curl -Ls "https://get.maestro.mobile.dev" | bash

# Run on iOS simulator
maestro test maestro/flows/service-completion.yaml --device "iPhone 16 Pro Max"

# Run on Android emulator
maestro test maestro/flows/service-completion.yaml --device emulator-5554
```

### Maestro Flow Example

```yaml
# maestro/flows/service-completion.yaml
appId: com.cadenza.technician
---
- launchApp
- tapOn: "Sign in"
- inputText: "qa-tech@cadenzaops.com"
- tapOn: "Password"
- inputText: "${QA_TECH_PASSWORD}"
- tapOn: "Sign in"
- assertVisible: "Today's Jobs"
- tapOn: "123 Test St"
- tapOn: "Start Service"
- tapOn: "Take Photo"
- takeScreenshot: before-photo
- tapOn: "Capture"
- assertVisible: "Photo added"
- tapOn: "Complete"
- assertVisible: "Service completed"
```

**Note:** Maestro tests are **manual only** (run locally or via EAS). They do **not** run in CI because they require physical devices or configured simulators.

## Related Documentation

- [Architecture Overview](./architecture/SOLUTION.md)
- [Admin Portal Spec](./specs/FEATURE-ADMIN-PORTAL.md)
- [Technician App Spec](./specs/FEATURE-TECHNICIAN-APP.md)
- [Database Schema](./schema.sql)

## Jira Links

- **Epic:** [KAN-28](https://your-jira.atlassian.net/browse/KAN-28) — QA Automation
- **Stories:**
  - [KAN-65](https://your-jira.atlassian.net/browse/KAN-65) — E2E test infrastructure
  - [KAN-66](https://your-jira.atlassian.net/browse/KAN-66) — Admin + tech user flows
  - [KAN-67](https://your-jira.atlassian.net/browse/KAN-67) — CI/CD integration
  - [KAN-68](https://your-jira.atlassian.net/browse/KAN-68) — Maestro native flows (future)
