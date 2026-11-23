# KAN-151 — Automatic customer visit report emails

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-151 |
| **Status** | Built |
| **PR** | _(pending)_ |

> Privacy: no customer data. Details in Jira.

## Problem

A pool service company wants customers to receive a short, fixed-template email when a visit closes if certain routine events occurred (or when billable add-on work is flagged for reporting). Chemical readings and salt must never appear in those emails. Office staff need company-level defaults and a per-job paid-extra toggle; delivery attempts should be logged for a later UI (KAN-152).

## Scope

### In scope

- Company settings: which routine event types auto-email (default all four allow-listed types)
- On job close (admin PATCH complete + cron catch-up for technician-app closes): decide → send or skip → log delivery
- Fixed-template email via Resend; chemicals/salt never emailed
- Per-job `has_paid_extras` + `send_paid_extra_report`
- `customer_report_deliveries` log table + RLS
- Settings page, i18n, Jest + Playwright (skip cleanly if migration not applied)

### Non-goals

- Delivery-log admin UI (KAN-152)
- Editable free-form email body / marketing templates
- Emailing chemical or salt values
- Per-property override of company auto-send list

## Requirements

1. Default auto-send types: `filter_change`, `o_ring_replacement`, `filter_cleaning`, `low_water_level`.
2. Chemical/salt tags may be stored on the visit but are never email content or sole send triggers.
3. Paid extras email only when both job flags are true.
4. Sender default `Cadenza <reports@hello.cadenzaops.com>`; override with `REPORTS_EMAIL_FROM`.
5. Idempotent processing: terminal delivery for a job → no resend.
6. Cron every 5 minutes processes completed jobs missing a terminal delivery (tech-app path latency).
7. Email locale defaults to **en** unless explicitly `es*`.

## Acceptance criteria

- [x] **AC-1:** Company can GET/PUT allow-listed `auto_send_event_types` via `/api/customer-report-settings` (office roles for PUT).
- [x] **AC-2:** Settings UI at `/settings/customer-reports` loads and saves toggles.
- [x] **AC-3:** Job detail exposes paid-extras + send-report toggles; PATCH persists them.
- [x] **AC-4:** `decideCustomerReport` sends for configured routine events; skips `no_customer_email`, `chemicals_only`, `paid_extra_report_disabled`, `no_auto_send_events`.
- [x] **AC-5:** Mailer never includes chemical readings; uses `REPORTS_EMAIL_FROM` or default From; passes Resend idempotency key `customer-report/{jobId}`.
- [x] **AC-6:** Completing a job via admin `PATCH /api/jobs/[id]` invokes `processCustomerReportForJob`.
- [x] **AC-7:** Cron `GET /api/cron/process-customer-reports` requires `CRON_SECRET` and processes pending completed jobs.
- [x] **AC-8:** E2E settings + job toggle tests skip cleanly when migration/schema is missing.
- [x] **AC-10:** Customer emails are off by default: unless `CUSTOMER_AUTO_REPORTS_ENABLED=true`, every eligible job is recorded as `skipped` / `auto_send_disabled` and nothing is sent (no back-fill when later enabled).
- [x] **AC-9:** Migration defines settings + deliveries RLS and CHECK allow-lists; seeds settings for existing/new companies.

## Data model & API

### Tables / columns (migration `supabase/migrations/20261117120000_customer_auto_reports.sql`)

**`cadenza_customer_report_settings`**

| Column | Type | Notes |
|--------|------|-------|
| `company_id` | UUID PK → `cadenza_companies` | |
| `auto_send_event_types` | `TEXT[]` | Default the four routine types; CHECK subset of allow-list |
| `updated_at` | timestamptz | |

RLS: company users SELECT; owner/admin/operations ALL. Trigger seeds row on new company; backfill existing companies.

**`cadenza_service_jobs`**

| Column | Type | Notes |
|--------|------|-------|
| `has_paid_extras` | boolean NOT NULL DEFAULT false | |
| `send_paid_extra_report` | boolean NOT NULL DEFAULT false | |

**`cadenza_service_reports`**

| Column | Type | Notes |
|--------|------|-------|
| `service_event_types` | `TEXT[]` NOT NULL DEFAULT `{}` | CHECK allow-list includes routine + `chemical_reading` + `salt_addition` |

**`customer_report_deliveries`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `company_id`, `job_id` | UUID FKs | |
| `recipient` | text | |
| `status` | text | `queued` \| `sent` \| `failed` \| `skipped` |
| `reason`, `provider_message_id` | text | |
| `created_at` | timestamptz | |

RLS: company SELECT; office INSERT. Indexes on `(company_id, created_at DESC)`, `(job_id, created_at DESC)`.

### API

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| GET/PUT | `/api/customer-report-settings` | Session; PUT office roles | Read/upsert auto-send types |
| PATCH | `/api/jobs/[id]` | Session | May set paid-extra flags; on → `completed`, process report |
| GET | `/api/cron/process-customer-reports` | Bearer `CRON_SECRET` | `processPendingCustomerReports(50)` |

Vercel cron: `*/5 * * * *`.

### Domain modules

- `admin-portal/src/lib/customer-reports/{types,decide,process,mailer}.ts`
- Settings UI: `CustomerReportSettings` + `settings/customer-reports` page
- Technician app records `service_event_types` on visit close (stored; chemicals never emailed)

## Edge cases

| Case | Behavior |
|------|----------|
| No customer email | Skip `no_customer_email`; log skipped |
| Duplicate processing | If latest delivery is `sent` or `skipped` → `already_processed` |
| Failed prior send | May retry (not treated as terminal success/skip) |
| Migration not applied | API/E2E degrade or skip; do not apply migration from agent tooling without owner approval |
| Locale omitted / non-es | Email copy defaults to **en** |
| Tech-app close (direct DB) | Up to ~5 min cron latency before send |
| Missing `RESEND_API_KEY` | Mailer no-op → delivery `failed` / `resend_api_key_missing` |
| Chemicals only on visit | Skip `chemicals_only` |
| Misconfigured chemical in company auto-send | Filtered out; chemicals never emailed |

## AC → test traceability

| AC | Test file / name |
|----|------------------|
| AC-1 | Exercised via E2E API restore in `admin-portal/e2e/customer-auto-reports.spec.ts` (settings save) |
| AC-2 | `customer-auto-reports.spec.ts` — `AC-2: settings page loads with defaults; save persists; no chemical options` |
| AC-3 | `customer-auto-reports.spec.ts` — `AC-3: job detail paid-extra send-report toggle persists` |
| AC-4/5/6 (E2E) | `customer-auto-reports.spec.ts` — `AC-4/AC-5/AC-6: completing job with filter_change sends delivery` and `AC-4: chemical_reading-only visit yields skipped` (ephemeral QA tenant, Resend test sink) |
| AC-4 | `admin-portal/src/lib/customer-reports/__tests__/decide.test.ts` — `decideCustomerReport` / `collectRecordedEvents` cases |
| AC-5 | `admin-portal/src/lib/customer-reports/__tests__/mailer.test.ts` — From, idempotency, no chemicals |
| AC-6 | `admin-portal/src/app/api/jobs/[id]/__tests__/route.test.ts` — PATCH completed calls `processCustomerReportForJob` |
| AC-7 | Cron route thin; covered by process module + vercel.json schedule (add dedicated cron unit test if needed before close) |
| AC-8 | `customer-auto-reports.spec.ts` — `autoReportSchemaReady` / `test.skip` when schema missing |
| AC-9 | Migration applied 2026-11-17 and verified (one settings row per company, RLS on, trigger present) |
| AC-10 | `admin-portal/src/lib/customer-reports/__tests__/kill-switch.test.ts` |

## As built

- Built as specified, plus a global kill switch (AC-10, ADR-5): production ships with customer emails **off**; the owner enables them by setting `CUSTOMER_AUTO_REPORTS_ENABLED=true` in Vercel.
- E2E runs against an ephemeral `qa-billing-*` tenant created with the service role and deleted afterwards; the send test emails Resend's test sink only.
- Migration `20261117120000_customer_auto_reports.sql` applied to the shared DB on 2026-11-17 (rollback: drop the two new tables, the trigger/functions and the three new columns).
- E2E recording: https://github.com/AGASocial/caicos-pool-service/raw/e2e-media/kan-151-auto-reports.mp4
- Jira: https://agasocial.atlassian.net/browse/KAN-151
- PR: see the KAN-151 pull request to `develop` (linked from Jira).
