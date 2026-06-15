# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Cadenza admin portal — the web app of a field-service operations platform for pool-service companies. Company owners/admins/operations staff use it to manage their team of technicians, customer properties, recurring service routes, scheduled jobs, reports, and billing. It lives in the `cadenza` monorepo alongside `technician-app/` (Expo app technicians use in the field), `landing-page/`, and a shared root-level `supabase/` directory.

Stack: Next.js 16 App Router (Turbopack), React 19, TypeScript strict, Tailwind CSS v4, shadcn-style UI (`components.json`, Radix primitives in `src/components/ui/`), next-intl, Supabase (Auth + Postgres + Storage).

## Commands

```bash
npm run dev            # dev server (Turbopack) on :3000
npm run build          # production build
npm run lint           # eslint .
npm test               # Jest unit tests
npx jest path/to/file.test.ts        # single test file
npx jest -t "test name"              # single test by name
npm run test:e2e       # Playwright (e2e/; baseURL localhost:3000 or PLAYWRIGHT_TEST_BASE_URL)
npm run test:all       # Jest + Playwright
npm run script:import-properties     # CSV property import
npx tsx scripts/rotate-keys.ts       # rotate master encryption key (needs NEW_MASTER_KEY env)
npx tsx scripts/rotate-user-key.ts <USER_ID>   # re-encrypt one user's storage key
```

Unit tests sit in `__tests__/` folders next to the code (jsdom + ts-jest; `@/` maps to `src/`). `scripts/` also holds Stripe product setup and one-off SQL maintenance helpers. There are no git pre-commit hooks.

## Architecture

### Routing & i18n

All pages live under `src/app/[locale]/` with locales `en`/`es` — **default is `es`**. Translations in `messages/{en,es}.json`; locale-aware `Link`/`useRouter` come from `src/i18n/navigation.ts`. Dashboard pages are grouped under `[locale]/(dashboard)/`: dashboard, jobs, routes, properties, team, reports, billing, settings. `src/app/(landing)/` is a root landing page outside the locale tree.

`src/middleware.ts` chains next-intl locale negotiation with Supabase session refresh (`@supabase/ssr`) and redirects unauthenticated page requests to `/{locale}/auth/login`. Its matcher excludes `/api` — **every API route does its own auth check**.

### Supabase client layers (`src/lib/`)

| File | Use |
|---|---|
| `supabase.ts` | Browser client (`createBrowserClient`) + `Database` type for billing tables |
| `supabase-server.ts` | `createRouteClient()` / `createAuthenticatedRouteClient()` for API routes (cookie-based; returns `{ supabase, user }`) |
| `supabase-admin.ts` | `supabaseAdmin` service-role client — bypasses RLS, server-only |
| `supabase-cadenza.ts` | `CadenzaSupabaseClient` type for `cadenza_*` tables; used via cast `(supabase as unknown as CadenzaSupabaseClient)` |

There is no DB type codegen: `CadenzaSupabaseClient` types every table as a loose `Record<string, unknown>` shape, so wrong `cadenza_*` column names fail at runtime, not compile time.

### Data model (`cadenza_*` tables)

Multi-tenant by company: `cadenza_profiles` carries `company_id`, `role` (constraint-checked: `owner`, `admin`, `technician`, `operations`), `is_active`, and `encrypted_storage_key`. Domain tables: `cadenza_properties`, `cadenza_routes`, `cadenza_route_stops`, `cadenza_route_stop_schedules`, `cadenza_service_jobs`, `cadenza_visit_reasons`, `cadenza_invite_codes`, plus `cadenza_billing_plans` / `cadenza_billing_subscriptions`. Tenancy and role rules are enforced with Postgres RLS policies.

**Migrations live at the repo root** (`../supabase/migrations/`) — `admin-portal/supabase/migrations/` is just a pointer README. Run the Supabase CLI from the repo root.

### API route pattern

Handlers under `src/app/api/`. The standard shape (see `api/jobs/route.ts`): `createAuthenticatedRouteClient()` → 401 if no user → read `cadenza_profiles` for `company_id` → query `cadenza_*` through the cast client, letting RLS scope rows. `supabaseAdmin` is reserved for auth-admin or cross-RLS needs (e.g., `api/team` reading email-confirmation status).

### Route → job generation

Routes have stops with weekly schedules (`cadenza_route_stop_schedules`). Jobs are materialized into `cadenza_service_jobs` (`job_source = 'route' | 'ad_hoc'`) by `/api/cron/generate-route-jobs`: a daily Vercel cron (`vercel.json`, 06:00 UTC) authenticated with `Authorization: Bearer $CRON_SECRET`, covering today through +1 month by default. Logic lives in `src/lib/generate-route-jobs-cron.ts`, `route-stop-schedule.ts`, `route-stop-schedules-db.ts`, `reconcile-route-jobs.ts`, `schedule.ts`, `date-week.ts`.

### Encrypted file storage

Envelope encryption in `src/lib/encryption.ts`: `STORAGE_MASTER_KEY` env → HKDF → KEK; a random per-user DEK is stored AES-256-GCM-encrypted in `cadenza_profiles.encrypted_storage_key`; files are encrypted/decrypted as streams via `api/storage/upload`. The HKDF salt string `'cadenza-master-key-v1'` is historical — **never change it**, or every stored key becomes undecryptable. Rotation: `scripts/rotate-keys.ts` (master key), `scripts/rotate-user-key.ts` (single user).

### Billing

Provider-agnostic gateway layer in `src/lib/billing/` (adapters + webhook normalizers) supporting Stripe and PayU; the active gateway is selected by `NEXT_PUBLIC_PAYMENT_GATEWAY`. Webhooks: `api/webhooks/stripe`, `api/webhooks/payu`; PayU return page at `[locale]/payments/payu/return`. Plan gating reads `cadenza_billing_plans` via `src/lib/subscription/limits.ts` (storage/file-size limits).

### Frontend data layer

Client components fetch through the API routes with TanStack Query — `src/lib/team.ts` is the canonical pattern (`useQuery` + mutations that invalidate the cache). Forms: react-hook-form + zod. Toasts: sonner. Theming: next-themes.

## Environment

`.env.local` (`.env.example` lists only the minimal pair):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required everywhere
- `SUPABASE_SERVICE_ROLE_KEY` — admin client
- `STORAGE_MASTER_KEY` — file-encryption KEK
- `CRON_SECRET` — cron endpoint auth
- Payments: `NEXT_PUBLIC_PAYMENT_GATEWAY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `PAYU_*`

## Gotchas

- `next.config.ts` pins `turbopack.root` to this directory; without it Next 16 resolves against the monorepo root and Tailwind imports break.
- Default locale is `es`, not `en`.
- Deployment is Vercel (`vercel.json` also defines the cron); `netlify.toml` is a leftover.
