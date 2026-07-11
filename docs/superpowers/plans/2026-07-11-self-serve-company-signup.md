# Self-Serve Company Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a visitor with no invite code create a brand-new company (and become its `owner`) directly from `/auth/register`, toggling between "create a company" and "join with an invite code," while the existing invite-link flow stays unchanged.

**Architecture:** Reactivate the `handle_new_user` DB trigger's dormant `company_name` branch (no migration needed) by having `POST /api/auth/register` accept an optional `companyName` field alongside the existing `invite` field. The register form (`auth-form.tsx`) gets a `create`/`join` mode toggle that swaps a Company Name field for an Invite Code field. Rate limiting reuses the existing in-memory `checkRateLimit` pattern already used on login.

**Tech Stack:** Next.js 16 App Router API routes, Supabase Auth (`signUp` + `handle_new_user` trigger), React Hook Form + Zod, next-intl, Jest (`@jest-environment node` for API routes, jsdom + RTL for components), Playwright.

**Spec:** `docs/superpowers/specs/2026-07-11-self-serve-company-signup-design.md`

**Baseline note:** This worktree has pre-existing, unrelated test failures (jobs/reports-jobs route tests missing `.maybeSingle()` mocks, `src/lib/auth.test.ts`, a disabled Google-sign-in-button test in `auth-form.test.tsx`, and `npm test`'s testMatch accidentally picking up Playwright `e2e/*.spec.ts` files). These are out of scope — do not fix them as part of this plan. Verify only the specific test files touched by each task below.

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
- Modify: `admin-portal/src/components/auth/__tests__/auth-form.test.tsx` (pre-existing file — do NOT create a new one)

**Important — read before starting:** `admin-portal/src/components/auth/__tests__/auth-form.test.tsx` already exists with a `Register Form` describe block. One of its tests, `should call backend register on successful registration`, currently fills only `fullName`/`email`/`password` and expects the fetch call to succeed. Once this task adds mandatory company-name validation to `create` mode, that test will start failing unless you also fill in the company name field. Fix that test as part of Step 1 below, in the same pass as adding the new toggle tests — do not treat it as a separate regression to chase later.

Ignore the one pre-existing unrelated failure in this file (`OAuth Buttons > should call backend oauth start when Google button is clicked` — the button is already disabled/"Coming Soon" in the current component, unrelated to this task). It should remain the only failure before your changes, and should still be the only failure after — don't try to fix it.

- [ ] **Step 1: Update the failing/missing tests in `auth-form.test.tsx`**

First, fix the existing register-success test so it fills in a company name (required now that `create` mode validates it). Replace:

```ts
    it('should call backend register on successful registration', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<AuthForm type="register" />);

      await user.type(screen.getByLabelText(/fullName/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /createAccount/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
          method: 'POST',
        }));
        expect(toast.success).toHaveBeenCalled();
      });
    });
```

with:

```ts
    it('should call backend register on successful registration', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<AuthForm type="register" />);

      await user.type(screen.getByLabelText(/fullName/i), 'John Doe');
      await user.type(screen.getByLabelText(/company name/i), 'Acme Pool Services');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /createAccount/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
            fullName: 'John Doe',
            locale: 'en',
            companyName: 'Acme Pool Services',
          }),
        }));
        expect(toast.success).toHaveBeenCalled();
      });
    });
```

Then append a new describe block right after the closing `});` of the `Register Form` describe block (before `describe('OAuth Buttons', ...)`):

```ts
  describe('Company signup toggle', () => {
    it('defaults to create mode with a company name field and no invite code field', () => {
      render(<AuthForm type="register" />);

      expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/invite code/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /haveAnInviteCode/i })).toBeInTheDocument();
    });

    it('toggles to join mode and shows an invite code field instead', async () => {
      const user = userEvent.setup();
      render(<AuthForm type="register" />);

      await user.click(screen.getByRole('button', { name: /haveAnInviteCode/i }));

      expect(screen.getByLabelText(/invite code/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/company name/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /createACompanyInstead/i })).toBeInTheDocument();
    });

    it('toggles back to create mode', async () => {
      const user = userEvent.setup();
      render(<AuthForm type="register" />);

      await user.click(screen.getByRole('button', { name: /haveAnInviteCode/i }));
      await user.click(screen.getByRole('button', { name: /createACompanyInstead/i }));

      expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
    });

    it('blocks submission in create mode without a company name', async () => {
      const user = userEvent.setup();
      render(<AuthForm type="register" />);

      await user.type(screen.getByLabelText(/fullName/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /createAccount/i }));

      await waitFor(() => {
        expect(screen.getByText(/company name is required/i)).toBeInTheDocument();
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('blocks submission in manual join mode without an invite code', async () => {
      const user = userEvent.setup();
      render(<AuthForm type="register" />);

      await user.click(screen.getByRole('button', { name: /haveAnInviteCode/i }));
      await user.type(screen.getByLabelText(/fullName/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /createAccount/i }));

      await waitFor(() => {
        expect(screen.getByText(/invite code is required/i)).toBeInTheDocument();
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends the invite code from the URL and hides the toggle when inviteCode prop is set', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<AuthForm type="register" inviteCode="URLCODE123" />);

      expect(screen.queryByRole('button', { name: /haveAnInviteCode/i })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/company name/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/invite code/i)).not.toBeInTheDocument();

      await user.type(screen.getByLabelText(/fullName/i), 'Jane Tech');
      await user.type(screen.getByLabelText(/email/i), 'tech@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /createAccount/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'tech@example.com',
            password: 'password123',
            fullName: 'Jane Tech',
            locale: 'en',
            invite: 'URLCODE123',
          }),
        }));
      });
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `admin-portal/`): `npx jest src/components/auth/__tests__/auth-form.test.tsx --verbose`

Expected: the updated `should call backend register on successful registration` test FAILS (no Company Name field exists yet, so `getByLabelText(/company name/i)` throws), and all 6 new `Company signup toggle` tests FAIL. The pre-existing `OAuth Buttons > should call backend oauth start...` test still fails (unrelated, expected). All other tests still pass.

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

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest src/components/auth/__tests__/auth-form.test.tsx --verbose`
Expected: every test passes except the one pre-existing, unrelated `OAuth Buttons > should call backend oauth start...` failure (same as before this task started — do not fix it).

- [ ] **Step 8: Commit**

```bash
git add admin-portal/src/components/auth/auth-form.tsx admin-portal/src/components/auth/__tests__/auth-form.test.tsx
git commit -m "feat: add create-company/join-with-invite toggle to register form"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the three test files touched by this plan**

Run (from `admin-portal/`):
```bash
npx jest src/app/api/auth/register src/components/auth/__tests__/auth-form.test.tsx --verbose
```
Expected: all pass except the single pre-existing `OAuth Buttons > should call backend oauth start...` failure noted in Task 3 (unrelated, out of scope).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds with no type errors (this catches any i18n key typos or TypeScript mismatches introduced above).

If Step 1 shows a new failure beyond the one pre-existing exception, or Step 2 fails, return to the corresponding task above, fix the root cause, and re-run that task's own test command before re-running this verification task.

---

## Self-Review Notes

- **Spec coverage:** All 6 numbered design sections are covered — Form UX (Task 3), API (Task 1), Rate limiting (Task 1), Email verification (no code change, per spec — not a task), DB (no migration, per spec — not a task), i18n (Task 2), Testing (Jest in Task 1, RTL component tests in Task 3, build gate in Task 4).
- **Placeholder scan:** No TBD/TODO markers; every step has literal code, exact file paths, and runnable commands with stated expected output.
- **Type consistency:** `mode: "create" | "join"` is used identically in Task 3 Steps 3–6. The form field name `code` (chosen to avoid clashing with the `inviteCode` prop) is consistent between the schema, `onSubmit`, and the rendered `FormField`. The API's `companyName` field name matches what the form sends in Task 3 Step 4 and what Task 1's route destructures.
- **Revision (post-baseline-check):** The original version of this plan proposed new Playwright `e2e/auth.spec.ts` tests for the toggle. After discovering a pre-existing `admin-portal/src/components/auth/__tests__/auth-form.test.tsx` RTL suite for this exact component (missed during initial planning), Task 3 was rewritten to extend that file instead — faster, more reliable (no dev server dependency), and avoids duplicating coverage across two test layers for the same interaction. It also fixes a real regression the original plan would have caused: the existing `should call backend register on successful registration` test doesn't fill in a company name and would break once `create`-mode validation exists.
