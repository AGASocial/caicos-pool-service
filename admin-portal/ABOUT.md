# Cadenza Admin Portal — Technical Overview

This document describes the **admin portal** in the Cadenza monorepo: the web app pool-service companies use to manage operations, technicians, properties, routes, jobs, reports, and billing.

For the full platform scope, see `docs/architecture/SOLUTION.md` at the repo root. For day-to-day development commands and architecture notes, see `CLAUDE.md` in this directory.

> **Historical note:** The portal was bootstrapped from a donor app (digital assets / beneficiaries). That product surface has been removed. The archived donor-app overview lives at `docs/archive/ABOUT-donor-app.md`.

---

## Product summary

- **Audience:** Company owners, admins, and operations staff at pool-service companies.
- **Core workflows:** Manage customer properties, recurring routes, scheduled service jobs, technician team, job reports, and subscription billing.
- **Companion app:** `technician-app/` (Expo) — field technicians use it for daily jobs, service forms, and photos.
- **Multi-tenant model:** Every row is scoped by `company_id` via Postgres RLS on `cadenza_*` tables.

---

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 App Router (Turbopack) |
| UI | React 19, Tailwind CSS v4, Radix/shadcn-style components |
| i18n | next-intl (`en`, `es`; default `es`) |
| Auth & data | Supabase Auth + Postgres + Storage |
| Billing | Provider-agnostic layer (Stripe / PayU) in `src/lib/billing/` |
| Deploy | Vercel (`vercel.json` includes cron for route job generation) |

---

## Repository layout (this app)

```
admin-portal/
├── src/app/[locale]/          # Localized pages (dashboard, jobs, routes, …)
├── src/app/api/               # REST handlers (auth, jobs, routes, billing, …)
├── src/components/            # UI and feature components
├── src/lib/                   # Supabase clients, billing, scheduling, encryption
├── messages/en.json           # English translations
├── messages/es.json           # Spanish translations
├── e2e/                       # Playwright tests
└── scripts/                   # Maintenance and setup helpers
```

**Database migrations** live at the monorepo root: `../supabase/migrations/`. Run Supabase CLI from the repo root, not from `admin-portal/`.

---

## Main routes

| Area | Path | Purpose |
|------|------|---------|
| Landing | `/[locale]/` | Marketing-style landing; redirects signed-in users to dashboard |
| Auth | `/[locale]/auth/*` | Login, register, OAuth callback |
| Dashboard | `/[locale]/dashboard` | Ops summary (jobs, routes, team, properties counts) |
| Jobs | `/[locale]/jobs` | Service job list, detail, ad-hoc creation |
| Routes | `/[locale]/routes` | Recurring routes, stops, schedules, job generation |
| Properties | `/[locale]/properties` | Customer pool/property CRUD |
| Team | `/[locale]/team` | Technicians and admins; invite flow |
| Reports | `/[locale]/reports` | Job completion and technician stats |
| Billing | `/[locale]/billing` | Plans, subscription, invoices |
| Settings | `/[locale]/settings/*` | Profile, security PIN, preferences |
| Wizard | `/[locale]/wizard` | Onboarding shell (extend `api/wizard/complete` for setup data) |

Navigation is defined in `src/components/Navigation.tsx` (sidebar). Legacy donor routes (`digital-assets`, `beneficiaries`) no longer exist.

---

## Authentication

- **Client:** `src/lib/auth.ts` — `useAuth()` hook.
- **Middleware:** `src/middleware.ts` — locale negotiation + Supabase session refresh; unauthenticated page requests redirect to `/[locale]/auth/login`.
- **API routes:** Matcher excludes `/api`; each handler calls `createAuthenticatedRouteClient()` and returns 401 when unauthenticated.
- **Post-login:** Users go to `/[locale]/dashboard` (see `auth-form.tsx`).

---

## Data model (Cadenza)

Primary tables (all prefixed `cadenza_`):

- `cadenza_companies` — tenant root
- `cadenza_profiles` — user ↔ company, role, `encrypted_storage_key`
- `cadenza_properties` — customer pools / service addresses
- `cadenza_routes`, `cadenza_route_stops`, `cadenza_route_stop_schedules` — recurring service routes
- `cadenza_service_jobs` — scheduled or ad-hoc jobs (`job_source`: `route` | `ad_hoc`)
- `cadenza_visit_reasons`, `cadenza_invite_codes`
- `cadenza_billing_plans`, `cadenza_billing_subscriptions`, invoices/payment methods

Typed loosely via `CadenzaSupabaseClient` in `src/lib/supabase-cadenza.ts` (cast from the Supabase client in API routes). Legacy `Database` type in `src/lib/supabase.ts` covers auth/billing helper tables only.

Full schema reference: `docs/schema.sql`.

---

## Key backend flows

### Route → job generation

Daily cron (`/api/cron/generate-route-jobs`, 06:00 UTC) materializes jobs from route stop schedules into `cadenza_service_jobs`. Logic: `src/lib/generate-route-jobs-cron.ts`, `schedule.ts`, `reconcile-route-jobs.ts`.

### Encrypted uploads

`POST /api/storage/upload` encrypts files with a per-user DEK (stored encrypted on `cadenza_profiles`). Master key: `STORAGE_MASTER_KEY`. Do not change the HKDF salt documented in `CLAUDE.md`.

### Billing

Webhooks: `/api/webhooks/stripe`, `/api/webhooks/payu`. Plan limits: `src/lib/subscription/limits.ts` (storage/file-size; no legacy asset/beneficiary gating).

---

## Internationalization

- Message files: `messages/en.json`, `messages/es.json` (kept in parity).
- Use `useTranslations()` with full keys (e.g. `t('settings.profile')`) or `useTranslations('settings')` + `t('profile')`.
- Dynamic keys: `poolType_*`, `poolSurface_*`, `status_*`, `roles.*`, `subscription*`, `invoice*`.

---

## Environment variables

See `.env.example` and `CLAUDE.md`. Minimum:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- `STORAGE_MASTER_KEY`, `CRON_SECRET`, `RESEND_API_KEY` (PIN reset)
- Payment provider keys when billing is enabled

---

## Adding features (checklist)

1. **Schema** — Add migration under `../supabase/migrations/` with RLS scoped by `company_id`.
2. **API** — Follow `api/jobs/route.ts`: authenticate → load profile → query via `CadenzaSupabaseClient`.
3. **UI** — Page under `src/app/[locale]/(dashboard)/`; reuse `components/ui/*`.
4. **i18n** — Add keys to both `messages/en.json` and `messages/es.json`.
5. **QA** — Verify RLS isolation between companies; run `npm test` and `npm run build`.

---

## Related docs

| Document | Location |
|----------|----------|
| MVP scope & architecture | `docs/architecture/SOLUTION.md` |
| Admin feature spec | `docs/specs/FEATURE-ADMIN-PORTAL.md` |
| Database schema | `docs/schema.sql` |
| Donor app overview (archived) | `docs/archive/ABOUT-donor-app.md` |
| Agent/dev guide | `CLAUDE.md` |
