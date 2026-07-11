# Self-Serve Company Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a visitor with no invite code create a brand-new company (and become its `owner`) directly from `/auth/register`, toggling between "create a company" and "join with an invite code," while the existing invite-link flow stays unchanged.

**Architecture:** Reactivate the `handle_new_user` DB trigger's dormant `company_name` branch (no migration needed) by having `POST /api/auth/register` accept an optional `companyName` field alongside the existing `invite` field. The register form (`auth-form.tsx`) gets a `create`/`join` mode toggle that swaps a Company Name field for an Invite Code field. Rate limiting reuses the existing in-memory `checkRateLimit` pattern already used on login.

**Tech Stack:** Next.js 16 App Router API routes, Supabase Auth (`signUp` + `handle_new_user` trigger), React Hook Form + Zod, next-intl, Jest (`@jest-environment node`), Playwright.

**Spec:** `docs/superpowers/specs/2026-07-11-self-serve-company-signup-design.md`

---

### Task 1: API — accept `companyName`, add rate limiting

**Files:**
- Modify: `admin-portal/src/app/api/auth/register/route.ts`
- Test: `admin-portal/src/app/api/auth/register/__tests__/route.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `admin-portal/src/app/api/auth/register/__tests__/route.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('@/lib/supabase-server', () => ({
  createRouteClient: jest.fn(),
}));
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterSec: 0 }),
  rateLimitResponse: jest.fn(
    (retryAfterSec: number) =>
      new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSec) },
      })
  ),
}));

import { createRouteClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit } from '@/lib/rate-limit';

const mockCreateRouteClient = createRouteClient as jest.Mock;
const mockCheckRateLimit = checkRateLimit as jest.Mock;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost' },
  });
}

describe('POST /api/auth/register', () => {
  const mockSignUp = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSec: 0 });
    mockSignUp.mockResolvedValue({ error: null });
    mockCreateRouteClient.mockResolvedValue({
      auth: { signUp: mockSignUp },
    });
  });

  it('returns 400 when neither companyName nor invite is provided', async () => {
    const req = makeRequest({ email: 'a@b.com', password: 'password123' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/company name|invite code/i);
  });

  it('creates a new company when companyName is provided', async () => {
    const req = makeRequest({
      email: 'owner@example.com',
      password: 'password123',
      fullName: 'Jane Owner',
      companyName: '  Acme Pool Services  ',
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'owner@example.com',
        password: 'password123',
        options: expect.objectContaining({
          data: expect.objectContaining({
            company_name: 'Acme Pool Services',
          }),
        }),
      })
    );
  });

  it('does not set company_name metadata when joining via invite code', async () => {
    const mockSingle = jest.fn().mockResolvedValue({
      data: { company_id: '11111111-1111-1111-1111-111111111111', role: 'technician' },
      error: null,
    });
    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }),
    });

    const req = makeRequest({
      email: 'tech@example.com',
      password: 'password123',
      invite: 'ABC123',
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({
            company_id: '11111111-1111-1111-1111-111111111111',
            role: 'technician',
          }),
        }),
      })
    );
    const callArgs = mockSignUp.mock.calls[0][0];
    expect(callArgs.options.data.company_name).toBeUndefined();
  });

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSec: 42 });

    const req = makeRequest({ email: 'a@b.com', password: 'password123', companyName: 'Acme' });
    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(mockCreateRouteClient).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `admin-portal/`): `npx jest src/app/api/auth/register --verbose`

Expected: `creates a new company when companyName is provided` FAILS (route still returns 400 "invite link required"; `signUp` never called with `company_name`). `returns 429 when rate limited` FAILS (route has no rate-limit check yet, so it proceeds to a 400 instead of 429). `returns 400 when neither...` may pass already (route already 400s), and `does not set company_name...via invite` should already pass (existing invite logic untouched) — that's expected; the point is the two new-behavior tests are red.

- [ ] **Step 3: Implement the API changes**

In `admin-portal/src/app/api/auth/register/route.ts`, apply these three edits:

Edit imports:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
```

Edit the top of `POST` (add rate limiting, destructure `companyName`):
```ts
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = checkRateLimit(`auth:register:${ip}`, RATE_LIMITS.auth.limit, RATE_LIMITS.auth.windowMs);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body. Send JSON with email, password, and optionally fullName, locale, invite, companyName.' },
        { status: 400 }
      );
    }
    const { email, password, fullName, locale, invite: inviteCode, companyName } = body;
```

Edit the branch that currently 400s unconditionally when there's no invite code:
```ts
      userMetadata.company_id = companyId;
      userMetadata.role = role;
    } else if (typeof companyName === 'string' && companyName.trim()) {
      userMetadata.company_name = companyName.trim();
    } else {
      return NextResponse.json(
        { error: 'Provide a company name to create a new company, or an invite code to join an existing one.' },
        { status: 400 }
      );
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/api/auth/register --verbose`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/app/api/auth/register/route.ts admin-portal/src/app/api/auth/register/__tests__/route.test.ts
git commit -m "feat: support self-serve company creation and rate limit /api/auth/register"
```

---

### Task 2: i18n keys

**Files:**
- Modify: `admin-portal/messages/en.json`
- Modify: `admin-portal/messages/es.json`

- [ ] **Step 1: Add the three new keys to `en.json`**

```diff
   "clearFilters": "Clear filters",
   "close": "Close",
   "comingSoon": "Coming soon",
+  "companyName": "Company Name",
   "completed": "Completed",
```

```diff
   "copyCode": "Copy",
+  "createACompanyInstead": "Create a company instead",
   "createAccount": "Create account",
```

```diff
   "generateJobsForDateDescriptionPattern": "Creates jobs only for stops whose pattern matches that calendar date (weekday and weekly vs monthly). Skips properties that already have a route job that day.",
+  "haveAnInviteCode": "Have an invite code?",
   "inactive": "Inactive",
```

- [ ] **Step 2: Add the same three keys to `es.json`**

```diff
   "clearFilters": "Limpiar filtros",
   "close": "Cerrar",
   "comingSoon": "Próximamente",
+  "companyName": "Nombre de la empresa",
   "completed": "Completados",
```

```diff
   "copyCode": "Copiar",
+  "createACompanyInstead": "Crear una empresa en su lugar",
   "createAccount": "Crear cuenta",
```

```diff
   "generateJobsForDateDescriptionPattern": "Crea trabajos solo para paradas cuyo patrón coincide con esa fecha (día de la semana y semanal vs mensual). Omite propiedades que ya tengan un trabajo de ruta ese día.",
+  "haveAnInviteCode": "¿Tienes un código de invitación?",
   "inactive": "Inactivo",
```

- [ ] **Step 3: Verify both files are valid JSON and stay in parity**

Run (from `admin-portal/`):
```bash
node -e "const en=require('./messages/en.json'); const es=require('./messages/es.json'); const a=Object.keys(en).sort(); const b=Object.keys(es).sort(); console.log('parity:', JSON.stringify(a)===JSON.stringify(b));"
```
Expected: `parity: true`

- [ ] **Step 4: Commit**

```bash
git add admin-portal/messages/en.json admin-portal/messages/es.json
git commit -m "feat: add i18n keys for company signup toggle"
```

---

### Task 3: Register form — create/join toggle

**Files:**
- Modify: `admin-portal/src/components/auth/auth-form.tsx`
- Test: `admin-portal/e2e/auth.spec.ts`

- [ ] **Step 1: Write the failing e2e tests**

Append to `admin-portal/e2e/auth.spec.ts` (before the final closing `});` of the file, i.e. as a new top-level `test.describe` block after the existing `Authentication Flow` describe block):

```ts
test.describe('Company signup flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/auth/register');
  });

  test('defaults to create-company mode with a company name field', async ({ page }) => {
    await expect(page.getByLabel(/company name/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /have an invite code/i })).toBeVisible();
  });

  test('toggles to join mode and shows an invite code field', async ({ page }) => {
    await page.getByRole('button', { name: /have an invite code/i }).click();

    await expect(page.getByLabel(/invite code/i)).toBeVisible();
    await expect(page.getByLabel(/company name/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /create a company instead/i })).toBeVisible();
  });

  test('toggles back to create mode', async ({ page }) => {
    await page.getByRole('button', { name: /have an invite code/i }).click();
    await page.getByRole('button', { name: /create a company instead/i }).click();

    await expect(page.getByLabel(/company name/i)).toBeVisible();
  });

  test('shows a validation error when submitting create mode without a company name', async ({ page }) => {
    await page.getByLabel(/full name/i).fill('New Owner');
    await page.getByLabel(/^email$/i).fill('new-owner@example.com');
    await page.getByLabel(/^password$/i).fill('password123');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/company name is required/i)).toBeVisible();
  });

  test('hides the toggle and manual code field when arriving with an invite code in the URL', async ({ page }) => {
    await page.goto('/en/auth/register?invite=TESTCODE123');

    await expect(page.getByRole('button', { name: /have an invite code/i })).not.toBeVisible();
    await expect(page.getByLabel(/company name/i)).not.toBeVisible();
    await expect(page.getByLabel(/invite code/i)).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run e2e tests to verify they fail**

Run (from `admin-portal/`): `npx playwright test e2e/auth.spec.ts`
Expected: the 5 new tests in `Company signup flow` FAIL — there's no Company Name field, no toggle button, and no "Company name is required" message yet. The pre-existing `Authentication Flow` tests should still pass, unaffected.

- [ ] **Step 3: Add `mode` state and schema fields**

In `admin-portal/src/components/auth/auth-form.tsx`, edit the schema:
```ts
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
  fullName: z.string().optional(),
  companyName: z.string().optional(),
  code: z.string().optional(),
})
```

Edit `defaultValues`:
```ts
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      companyName: "",
      code: "",
    },
```

Edit the state declarations to add `mode`:
```ts
  const [isLoading, setIsLoading] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<"create" | "join">(inviteCode ? "join" : "create")
```

- [ ] **Step 4: Update `onSubmit` validation and request body**

Edit the register branch of `onSubmit`:
```ts
      if (type === "register") {
        if (mode === "create" && !data.companyName?.trim()) {
          form.setError("companyName", { message: "Company name is required" })
          setIsLoading(false)
          return
        }
        if (mode === "join" && !inviteCode && !data.code?.trim()) {
          form.setError("code", { message: "Invite code is required" })
          setIsLoading(false)
          return
        }

        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            fullName: data.fullName,
            locale,
            ...(mode === "join"
              ? { invite: inviteCode ?? data.code }
              : { companyName: data.companyName }),
          }),
        })
```

- [ ] **Step 5: Add the toggle link under the heading**

Edit the heading block:
```tsx
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {type === "login" ? t("welcome") : t("createAnAccount")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {type === "login"
            ? t("enterYourCredentialsToSignInToYourAccount")
            : t("enterYourDetailsToCreateYourAccount")}
        </p>
        {type === "register" && !inviteCode && (
          <button
            type="button"
            onClick={() => setMode(mode === "create" ? "join" : "create")}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary mx-auto"
          >
            {mode === "create" ? t("haveAnInviteCode") : t("createACompanyInstead")}
          </button>
        )}
      </div>
```

- [ ] **Step 6: Add the Company Name / Invite Code fields**

Edit the form fields, right after the existing `fullName` field block:
```tsx
          {type === "register" && (
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fullName")}</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {type === "register" && mode === "create" && (
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("companyName")}</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Pool Services" autoComplete="organization" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {type === "register" && mode === "join" && !inviteCode && (
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inviteCode")}</FormLabel>
                  <FormControl>
                    <Input placeholder="ABC123" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
```

- [ ] **Step 7: Run e2e tests to verify they pass**

Run: `npx playwright test e2e/auth.spec.ts`
Expected: all tests in both `Authentication Flow` and `Company signup flow` PASS.

- [ ] **Step 8: Commit**

```bash
git add admin-portal/src/components/auth/auth-form.tsx admin-portal/e2e/auth.spec.ts
git commit -m "feat: add create-company/join-with-invite toggle to register form"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full Jest suite**

Run (from `admin-portal/`): `npm test`
Expected: all suites pass, including the new `src/app/api/auth/register/__tests__/route.test.ts`.

- [ ] **Step 2: Run the full Playwright suite**

Run: `npm run test:e2e`
Expected: all specs pass, including `e2e/auth.spec.ts`.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: build succeeds with no type errors (this catches any i18n key typos or TypeScript mismatches introduced above).

If any step fails, return to the corresponding task above, fix the root cause, and re-run that task's own test command before re-running this verification task.

---

## Self-Review Notes

- **Spec coverage:** All 6 numbered design sections are covered — Form UX (Task 3), API (Task 1), Rate limiting (Task 1), Email verification (no code change, per spec — not a task), DB (no migration, per spec — not a task), i18n (Task 2), Testing (Jest in Task 1, Playwright in Task 3, full-suite gate in Task 4).
- **Placeholder scan:** No TBD/TODO markers; every step has literal code, exact file paths, and runnable commands with stated expected output.
- **Type consistency:** `mode: "create" | "join"` is used identically in Task 3 Steps 3–6. The form field name `code` (chosen to avoid clashing with the `inviteCode` prop) is consistent between the schema, `onSubmit`, and the rendered `FormField`. The API's `companyName` field name matches what the form sends in Task 3 Step 4 and what Task 1's route destructures.
