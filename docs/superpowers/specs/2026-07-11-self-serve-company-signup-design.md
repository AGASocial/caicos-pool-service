# Self-Serve Company Signup — Design

Date: 2026-07-11
Status: Approved for planning

## Problem

Today, `POST /api/auth/register` requires an invite code (`admin-portal/src/app/api/auth/register/route.ts`). There is no way for a new customer to create a `cadenza_companies` row on their own — invite codes only let a user join an *existing* company. This is a gap: the underlying DB trigger (`handle_new_user`, defined in `supabase/migrations/20250901000000_cadenza_core_schema.sql` and re-defined in `20260221000002_fix_handle_new_user_trigger.sql`) already supports creating a new company + `owner` profile when `raw_user_meta_data->>'company_name'` is set, but nothing in the current API/UI calls it. That code path is dead.

## Goal

Let a visitor with no invite code create a brand-new company (and become its `owner`) directly from `/auth/register`, while preserving the existing invite-based join flow unchanged. No new database migration is needed — this only reactivates an existing trigger branch.

## Out of scope

- Billing/plan selection at signup (new companies default to `subscription_tier = 'free'`, already the column default).
- Company profile details beyond name (address, phone, logo) — collected later via the existing `/wizard` onboarding shell.
- Vercel Firewall / edge-level rate limiting — explicitly deferred; using the existing in-memory app-level limiter instead (see Guardrails).
- Any super-admin / platform-staff tooling for company management (a separate, larger idea discussed earlier in this project — not part of this spec).

## Design

### 1. Form UX (`admin-portal/src/components/auth/auth-form.tsx`, `admin-portal/src/app/[locale]/auth/register/page.tsx`)

Single component, two modes, selected by how the user arrives:

- **No `?invite=` query param (default): `create` mode.** Fields: Company name, Full name, Email, Password. Submit button reads "Create account" as today.
- **`?invite=CODE` present in the URL: `join` mode, locked.** Same as current behavior — no company-name field, no visible toggle, code is implicit from the URL.
- **User manually opts into `join` mode (no URL param):** a small link under the heading, "Have an invite code?", switches the form to `join` mode and reveals a new, previously-nonexistent **Invite code** text input in place of the Company name field. A reverse link, "Create a company instead", switches back to `create` mode.

State: a local `mode: 'create' | 'join'` state in `AuthForm`, initialized from whether the `inviteCode` prop is present. The toggle links only render when `inviteCode` was **not** supplied via URL (i.e., the user is choosing manually) — arriving via a real invite link keeps today's locked, toggle-free experience.

Zod schema gains an optional `companyName` field (create mode) and promotes `inviteCode` from a prop-only value to an optional user-editable form field (join mode, manual entry only).

### 2. API (`admin-portal/src/app/api/auth/register/route.ts`)

Add an optional `companyName` string to the request body, alongside the existing `invite`:

- `invite` present (from URL or manual entry) → existing logic unchanged: look up `cadenza_invite_codes`, set `userMetadata.company_id` / `userMetadata.role`.
- `invite` absent, `companyName` present and non-blank after trim → set `userMetadata.company_name = companyName.trim()`. No `company_id`/`role` metadata — the `handle_new_user` trigger's first branch creates the company and inserts the caller as `owner`.
- Neither present → `400` with an error message asking for one or the other (replaces today's blanket "invite link is required" message).

No changes to `supabase.auth.signUp()` call shape beyond the metadata contents. Invite-code consumption (`used_at` update) stays exactly as today, gated to the `invite`-present branch.

### 3. Guardrails

- **Rate limiting**: reuse the existing in-memory limiter (`admin-portal/src/lib/rate-limit.ts`), following the exact pattern already used in `api/auth/login/route.ts`:
  ```ts
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(`auth:register:${ip}`, RATE_LIMITS.auth.limit, RATE_LIMITS.auth.windowMs);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);
  ```
  Same `RATE_LIMITS.auth` bucket as login (20/min per IP) — no new bucket, for pattern consistency. Vercel Firewall-level rate limiting was considered and explicitly deferred (decision made 2026-07-11); can be revisited later without touching this code.
- **Email verification**: relies on the Supabase project's existing "Confirm email" setting (already inferred to be enabled, since the current register flow already sends a confirmation email via `emailRedirectTo` and the UI already tells users to check their inbox). No new app code — a new company + owner profile is created at signup time same as today, but the user can't obtain a working session/cookie until they confirm, same as the existing invite-join path.

### 4. Database

No migration required. `handle_new_user` already has the `company_name` branch (verified in `supabase/migrations/20250901000000_cadenza_core_schema.sql:217` and `20260221000002_fix_handle_new_user_trigger.sql`). Company names have no uniqueness constraint today — unchanged.

### 5. i18n (`admin-portal/messages/en.json`, `es.json`)

New keys needed, following the existing flat key style (e.g. `fullName`, `email`, `createAnAccount`): a company-name field label/placeholder, the "Have an invite code?" / "Create a company instead" toggle link labels, and an invite-code field label. Both locale files must stay in parity per existing project convention.

### 6. Testing

- **Jest** (`admin-portal/src/app/api/auth/register/__tests__/`, or alongside per existing convention): create-company path (asserts `signUp` called with `company_name` metadata, no `company_id`/`role`), missing-both-fields 400, rate-limit 429 after threshold, existing invite-path tests unchanged.
- **Playwright** (`admin-portal/e2e/`): toggle between `create`/`join` modes and back; submitting create-mode form reaches the "check your email" success state; existing `?invite=` URL flow still works end-to-end, unchanged.

## Decisions log

- 2026-07-11: Confirmed via architecture review that `handle_new_user` already supports company creation — no migration needed.
- 2026-07-11: Chose single-page toggle over two separate routes or an always-both-fields-visible form, matching Slack/Notion/Linear conventions.
- 2026-07-11: Chose to require email verification before a company is usable, and rate-limit signups — both via existing mechanisms rather than new infrastructure.
- 2026-07-11: Considered adding a Vercel Firewall rate-limit rule on `/api/auth/register` (global, cross-instance) but deferred in favor of reusing the existing in-memory `checkRateLimit` pattern for consistency with `login`. Revisit if abuse becomes a real problem — the in-memory limiter is per-serverless-instance, not global.
