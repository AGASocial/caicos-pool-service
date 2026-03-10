---
name: Caicos QA & Testing
trigger: "testing strategy", "qa review", "test cases", "end-to-end test", "quality assurance", "code review", "security testing"
description: "Expert QA methodology for Caicos platform. Comprehensive testing strategy covering unit tests, integration tests, E2E testing, security validation, performance testing, and browser automation for deployed Vercel instances. Validates across React Native, Next.js, and Supabase layers."
---

# Caicos QA & Testing Strategy

You are a QA specialist ensuring Caicos platform quality across all layers. Use this knowledge to generate comprehensive test plans, test cases, and automated validations.

## Testing Framework Stack
- **Unit Testing**: Vitest + jsdom
- **Integration Testing**: Supertest (API routes)
- **E2E Testing**: Playwright (browser automation)
- **Mobile Testing**: Detox (React Native E2E)
- **Performance**: Lighthouse CI
- **Security**: OWASP ZAP, npm audit

## Testing Pyramid

```
        /\
       /E2E\          (Browser automation, critical user flows)
      /     \
     /-------\
    /Integr. \        (API + Database, component interactions)
   /         \
  /-----------\
 /    Unit     \      (Functions, stores, utilities, hooks)
/_______________\
```

## Test Coverage Goals
- **Unit Tests**: >80% coverage
- **Integration Tests**: >60% coverage
- **Critical User Flows**: 100% E2E coverage
- **Total**: Aim for >70% overall

## Unit Testing

### Testing Zustand Stores (Mobile)
```typescript
// __tests__/store/useJobStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useJobStore } from '@/store/useJobStore';

describe('useJobStore', () => {
  beforeEach(() => {
    useJobStore.setState({ jobs: [], currentJob: null });
  });

  it('should update job status', () => {
    const testJob = { id: '123', status: 'pending' };
    useJobStore.setState({ jobs: [testJob] });

    useJobStore.getState().updateJobStatus('123', 'in_progress');

    const state = useJobStore.getState();
    expect(state.jobs[0].status).toBe('in_progress');
  });

  it('should set current job', () => {
    const job = { id: '123', status: 'pending' };
    useJobStore.getState().setCurrentJob(job);

    expect(useJobStore.getState().currentJob).toEqual(job);
  });
});
```

### Testing React Hooks (Frontend)
```typescript
// __tests__/hooks/useAuth.test.ts
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';

describe('useAuth', () => {
  it('should fetch current user on mount', async () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull(); // Initially null
    expect(result.current.isLoading).toBe(true);

    // Wait for async operation
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeDefined();
  });
});
```

### Testing Utilities
```typescript
// __tests__/lib/validation.test.ts
import { validateServiceReport } from '@/lib/validation';

describe('validateServiceReport', () => {
  it('should validate pH range', () => {
    const errors = validateServiceReport({
      job_id: '123',
      ph: 9.5, // Invalid: > 8.5
    });

    expect(errors?.ph).toBeDefined();
  });

  it('should pass valid readings', () => {
    const errors = validateServiceReport({
      job_id: '123',
      ph: 7.2,
      chlorine: 2.0,
    });

    expect(errors).toBeNull();
  });
});
```

## Integration Testing

### Testing API Routes
```typescript
// __tests__/api/jobs.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { GET, POST } from '@/app/api/jobs/route';

describe('GET /api/jobs', () => {
  it('should return 401 if not authenticated', async () => {
    const response = await request(apiHandler).get('/api/jobs');
    expect(response.status).toBe(401);
  });

  it('should return user\'s jobs when authenticated', async () => {
    const response = await request(apiHandler)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('POST /api/jobs', () => {
  it('should create job with valid data', async () => {
    const response = await request(apiHandler)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        property_id: 'prop-123',
        technician_id: 'tech-456',
        scheduled_date: '2026-03-15',
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
  });

  it('should validate required fields', async () => {
    const response = await request(apiHandler)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ scheduled_date: '2026-03-15' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });
});
```

### Testing Database Queries
```typescript
// __tests__/lib/database.test.ts
import { getJobsForTechnician } from '@/lib/database';
import { createMockSupabase } from '@/test-utils/mock-supabase';

describe('Database Queries', () => {
  it('should fetch jobs assigned to technician', async () => {
    const supabase = createMockSupabase();

    const jobs = await getJobsForTechnician(supabase, 'tech-123');

    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every(j => j.technician_id === 'tech-123')).toBe(true);
  });

  it('should handle database errors gracefully', async () => {
    const supabase = createMockSupabase({ error: 'Connection failed' });

    expect(() => getJobsForTechnician(supabase, 'tech-123')).rejects.toThrow();
  });
});
```

## End-to-End Testing (Playwright)

### Critical User Flows
```typescript
// e2e/admin-dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Admin Portal - Dashboard', () => {
  test('should login and view dashboard', async ({ page }) => {
    // Navigate to app
    await page.goto('https://caicos-admin.vercel.app');

    // Check login page
    await expect(page.locator('h1')).toContainText('Login');

    // Fill login form
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'password123');

    // Submit
    await page.click('[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('**/dashboard');

    // Verify KPI cards are visible
    await expect(page.locator('[data-testid="jobs-total"]')).toBeVisible();
    await expect(page.locator('[data-testid="jobs-completed"]')).toBeVisible();
  });

  test('should create a new job', async ({ page }) => {
    // Login first
    await loginAsAdmin(page);

    // Navigate to jobs
    await page.click('a:has-text("Jobs")');

    // Click create button
    await page.click('button:has-text("Create Job")');

    // Fill job form
    await page.fill('[name="property"]', 'residential-001');
    await page.selectOption('[name="technician"]', 'tech-123');
    await page.fill('[name="scheduled_date"]', '2026-03-15');

    // Submit
    await page.click('button:has-text("Create")');

    // Verify success
    await expect(page.locator('text=Job created successfully')).toBeVisible();
  });
});

test.describe('Technician App - Service Form', () => {
  test('should complete service form and submit', async ({ page }) => {
    // Navigate to deployed app
    await page.goto('https://caicos-tech-app.vercel.app');

    // Login
    await page.fill('[name="email"]', 'tech@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('**/dashboard');

    // Tap job
    await page.click('[data-testid="job-item"]:first-child');

    // Verify job details
    await expect(page.locator('[data-testid="customer-name"]')).toBeVisible();

    // Start job
    await page.click('button:has-text("Start Service")');

    // Fill chemical readings
    await page.fill('[name="ph"]', '7.2');
    await page.fill('[name="chlorine"]', '2.0');
    await page.fill('[name="alkalinity"]', '80');

    // Check equipment
    await page.check('[name="filter_clean"]');
    await page.check('[name="pump_running"]');

    // Submit
    await page.click('button:has-text("Submit Report")');

    // Verify success
    await expect(page.locator('text=Report submitted')).toBeVisible();
  });
});
```

## Security Testing

### OWASP Top 10 Checklist
```typescript
// __tests__/security/owasp.test.ts

test('SQL Injection - API should reject malicious input', async () => {
  const response = await request(apiHandler)
    .post('/api/jobs')
    .send({
      property_id: "'; DROP TABLE jobs; --",
    });

  // Should fail validation
  expect(response.status).toBe(400);
});

test('XSS - Should sanitize user input', async () => {
  const response = await request(apiHandler)
    .post('/api/jobs')
    .send({
      notes: '<script>alert("XSS")</script>',
    });

  // Should either sanitize or reject
  expect(response.body.notes).not.toContain('<script>');
});

test('Authentication - Should enforce RLS policies', async () => {
  // Try to access another company's data without permission
  const response = await request(apiHandler)
    .get('/api/jobs')
    .set('Authorization', `Bearer ${technicianToken}`);

  // Should only return technician's jobs
  expect(response.body.every(j => j.technician_id === 'tech-123')).toBe(true);
});
```

## Performance Testing

### Lighthouse CI
```yaml
# lighthouserc.json
{
  "ci": {
    "collect": {
      "url": ["https://caicos-admin.vercel.app"],
      "numberOfRuns": 3
    },
    "upload": {
      "target": "temporary-public-storage"
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }]
      }
    }
  }
}
```

### Load Testing
```typescript
// Load test with k6
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const res = http.get('https://caicos-admin.vercel.app/api/jobs');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
}
```

## Test Execution Plan

### Pre-commit
```bash
npm run test:unit          # Unit tests only
npm run lint               # ESLint + TypeScript check
```

### Pre-push
```bash
npm run test               # Unit + Integration tests
npm run build              # Verify build succeeds
```

### Pre-deployment
```bash
npm run test:all           # Unit + Integration + E2E
npm run test:security      # Security tests
lighthouse:ci              # Performance tests
```

## Continuous Integration (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run build

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npm run test:e2e -- --headed
```

---

See `references/` for test templates, mock data generators, and CI/CD pipeline configurations.
