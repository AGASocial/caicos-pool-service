# KAN-152 — Customer report delivery log & "unsent" view

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-152 |
| **Status** | In progress |
| **PR** | _(link when open)_ |

> Privacy: no customer data in this file. Details in Jira.

## Problem

Since KAN-151, a pool service company's customers can receive an automatic visit report email when a job closes. Office staff have no way to see whether a given property's report actually went out, which ones failed, or which are still pending, without opening the mail provider or the mailbox. They need a single place to answer "was the report for property X sent?" and to retry what did not go out.

## Scope

### In scope

- Every send attempt (automatic from the KAN-151 cron / job-complete hook, or manual retry from the portal) is recorded in `customer_report_deliveries` with status, recipient, job, property, actor, timestamp and error details.
- `GET /api/report-deliveries`: company-scoped query with status group, property search / `property_id`, `job_id`, date range and pagination.
- `POST /api/report-deliveries/[id]/retry`: manual retry of a failed/pending delivery, recording the actor.
- Admin portal "Report delivery log" page under Reports, with a prominent **Unsent** tab (pending + failed), plus All / Sent / Failed / Pending and a search box.
- Delivery status indicator on the job detail page and the property detail page.
- en + es i18n, Jest unit tests, Playwright E2E.

### Non-goals

- Changing report email content, auto-send rules, or the kill switch semantics from KAN-151.
- Bulk retry, scheduled digest of unsent reports, SMS delivery.
- Back-filling a log row for completed jobs that were never processed (the KAN-151 cron already picks those up).
- Webhook-based delivery/bounce tracking from the mail provider.

## Requirements

1. One log row represents the **current state of the report for a job**; retries update that row (attempt count, actor, timestamp) instead of piling up new rows.
2. Statuses exposed to users: `sent`, `failed`, `pending` (stored as `queued`), `skipped`. **Unsent = pending + failed.**
3. Each row records who triggered the latest attempt: `auto` (system) or a user (`manual` / `retry`).
4. Error details are stored in `reason` for failed (and skipped) attempts, truncated to a safe length.
5. The log API is scoped to the caller's company (RLS plus an explicit `company_id` filter) and requires the `report.view` entitlement. Retry requires `report.edit` (office roles).
6. Automatic retries are capped (3 attempts); beyond that only a manual retry re-sends.
7. Manual retry honors the KAN-151 global kill switch (`CUSTOMER_AUTO_REPORTS_ENABLED`): when off, nothing is sent and the row is not modified.
8. Rollout-safe: if the migration is not applied yet, sending keeps working (legacy columns only) and the log API reports a clear "schema pending" error.

## Acceptance criteria

- [x] **AC-1:** Every automatic send outcome (sent / failed / skipped / pending-before-send) is recorded with recipient, job, property and `trigger_source = auto`, no user.
- [x] **AC-2:** A manual retry records the acting user (`triggered_by`, `trigger_source = retry`) and updates the existing row (attempt count incremented) rather than inserting a duplicate.
- [x] **AC-3:** Failed attempts store error details in `reason`; sent attempts clear it.
- [x] **AC-4:** The status-group filter maps `unsent` → pending + failed, `pending` → queued, and `all` → no status filter; invalid values fall back to `all`.
- [x] **AC-5:** `GET /api/report-deliveries` supports `property_id`, `job_id`, `q` (property name/address or recipient), `date_from`/`date_to` and pagination; malformed ids/dates are rejected with 400.
- [x] **AC-6:** The log API is company scoped: 401 unauthenticated, 403 without company or without `report.view`, every query filtered by the caller's `company_id`.
- [x] **AC-7:** `POST /api/report-deliveries/[id]/retry` returns 401/403/404 for unauthenticated / non-office / other-company callers, 409 when the delivery is not retryable (sent/skipped) or the kill switch is off, and otherwise re-processes the job with the caller as actor.
- [x] **AC-8:** Automatic processing stops retrying a failed delivery after 3 attempts; manual retry is still allowed.
- [ ] **AC-9:** Report delivery log page (under Reports, linked from navigation) shows tabs Unsent / All / Sent with the **Unsent** tab selected by default, plus Failed / Pending, and a search box; rows show status badge, recipient, property, job link, actor (user or "Automatic"), timestamp and error reason; en + es messages.
- [ ] **AC-10:** Searching or filtering by property in the log answers whether that property's report was sent.
- [ ] **AC-11:** Job detail and property detail pages show a delivery status indicator (latest delivery) without opening email.
- [ ] **AC-12:** Failed/pending rows show a Retry action for office roles; sent rows do not.
- [ ] **AC-13:** E2E uses an ephemeral `qa-billing-*` tenant, supports `RECORD_VIDEO=1`, seeds sent/failed/pending rows, verifies the Unsent view and property search, cleans up, and skips cleanly without env vars or schema.

## Data model & API

### Table `customer_report_deliveries` (KAN-151) — additive columns

Migration `supabase/migrations/20261127120000_report_delivery_log.sql` (rollback in `supabase/migrations/rollback/`). KAN-151's table already had `company_id`, `job_id`, `recipient`, `status`, `reason`, `provider_message_id`, `created_at` and a status CHECK covering `queued` / `sent` / `failed` / `skipped`; those are reused unchanged (see ADR-001).

| Column | Type | Notes |
|--------|------|-------|
| `property_id` | UUID → `cadenza_properties` ON DELETE SET NULL | Denormalized from the job for property filtering; backfilled |
| `trigger_source` | text NOT NULL DEFAULT `auto` | CHECK `auto` \| `manual` \| `retry` |
| `triggered_by` | UUID → `cadenza_profiles` ON DELETE SET NULL | Acting user; NULL for automatic |
| `attempt_count` | integer NOT NULL DEFAULT 1 | CHECK ≥ 1 |
| `updated_at` | timestamptz NOT NULL DEFAULT now() | Time of the latest attempt |

Indexes: `(company_id, status, created_at DESC)`, `(property_id, created_at DESC)`. RLS is unchanged (company SELECT, office INSERT); writes go through the service role in `process.ts`.

### API

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| GET | `/api/report-deliveries` | Session, `report.view` | Query params: `status` (`all`\|`unsent`\|`sent`\|`failed`\|`pending`\|`skipped`), `q`, `property_id`, `job_id`, `date_from`, `date_to` (YYYY-MM-DD, on `created_at`), `page`, `limit` (≤ 100). Returns `{ data, pagination, unsent_count }` |
| POST | `/api/report-deliveries/[id]/retry` | Session, `report.edit` | Re-process the delivery's job as the caller; returns the new status |

Response row: `id`, `status` (`sent`\|`failed`\|`pending`\|`skipped`), `recipient`, `reason`, `attempt_count`, `created_at`, `updated_at`, `job { id, scheduled_date, status }`, `property { id, customer_name, address, city }`, `actor { type: system \| user, user_id, name }`, `can_retry`.

### Domain modules

- `admin-portal/src/lib/customer-reports/delivery-log.ts` — record building, save/upsert with legacy-schema fallback, actor types.
- `admin-portal/src/lib/customer-reports/delivery-log-query.ts` — query parsing, status groups, filter application, row mapping.
- `admin-portal/src/lib/customer-reports/process.ts` — now records actor/property/attempts.

## Edge cases

| Case | Behavior |
|------|----------|
| Migration not applied | Sending continues with legacy columns; log API returns 503 `SCHEMA_PENDING`; E2E skips |
| Job has no customer email | Row is `skipped` / `no_customer_email`; shown under All, not Unsent |
| Retry of a sent / skipped row | 409 `not_retryable` |
| Retry of a pending row that is still very recent | 409 `attempt_in_progress` (guards against double-send) |
| Kill switch off on manual retry | 409 `auto_send_disabled`; row unchanged |
| Legacy duplicate failed rows for one job (pre-migration behavior) | Listed individually; new attempts update the latest row |
| Property later deleted | `property_id` set NULL; row still listed with the job link |
| Search text contains PostgREST filter characters | Stripped before building the filter |
| Technician role | No `report.view`: log page/API are office-only; job/property indicator hidden |

## AC → test traceability

Unit paths are under `admin-portal/`. AC-9 … AC-13 are covered by the Playwright spec, which skips without a service-role QA environment with the migration applied; AC-11 also has a Jest component test. Playwright E2E was run locally against Development (9/9) before merge; recording is on `e2e-media`.

| AC | Test file / name |
|----|------------------|
| AC-1 | `src/lib/customer-reports/__tests__/delivery-log.test.ts` — `buildDeliveryRecord` (automatic actor, all statuses); `src/lib/customer-reports/__tests__/process-delivery-log.test.ts` — `AC-1: records an automatic sent attempt…`, pending-before-send, skipped, kill switch |
| AC-2 | `process-delivery-log.test.ts` — `AC-2: a manual retry records the acting user and updates the existing row in place`; `src/app/api/report-deliveries/[id]/retry/__tests__/route.test.ts` — `AC-2/AC-7: retries a failed delivery as the calling user…` |
| AC-3 | `delivery-log.test.ts` — `keeps error details for failed and skipped, clears them for sent and pending`, truncation; `process-delivery-log.test.ts` — `AC-1/AC-3: records a failed attempt with error details` |
| AC-4 | `src/lib/customer-reports/__tests__/delivery-log-query.test.ts` — `status groups (AC-4)`; `src/app/api/report-deliveries/__tests__/route.test.ts` — `AC-4: the unsent group filters pending + failed` |
| AC-5 | `delivery-log-query.test.ts` — `parseDeliveryLogQuery (AC-5)`, `applyDeliveryLogFilters`; `report-deliveries/__tests__/route.test.ts` — `AC-5: …` (property/job/date/pagination/search, 400s); `e2e/report-delivery-log.spec.ts` — `AC-5/AC-6: API filters and company scoping` |
| AC-6 | `report-deliveries/__tests__/route.test.ts` — `AC-6: 401 / 403 / always filters by the caller company_id`; `retry/__tests__/route.test.ts` — `AC-6/AC-7: 404 when the delivery is not visible…`; `process-delivery-log.test.ts` — `AC-6: refuses to process a job that belongs to another company`; E2E — `AC-6: unauthenticated callers get 401` |
| AC-7 | `src/app/api/report-deliveries/[id]/retry/__tests__/route.test.ts` — `AC-7: 401 / 403 / 400`, `not_retryable`, `attempt_in_progress`, `ADR-005: 409 auto_send_disabled…` |
| AC-8 | `process-delivery-log.test.ts` — `AC-8: automatic processing stops after the retry cap; manual retry still works`, `AC-8: the cron scan leaves capped failures for manual retry` |
| AC-9 | `e2e/report-delivery-log.spec.ts` — `AC-9: Unsent view is the default…`, `AC-9: All / Sent / Failed / Pending tabs and user actor`, `AC-9: log is reachable from Reports and navigation`, `AC-9: Spanish messages` |
| AC-10 | `e2e/report-delivery-log.spec.ts` — `AC-10: searching by property answers whether its report was sent` |
| AC-11 | `src/components/__tests__/ReportDeliveryStatus.test.tsx` — `LatestDeliveryIndicator (AC-11)`; E2E — `AC-11: job and property detail show the delivery status` |
| AC-12 | `e2e/report-delivery-log.spec.ts` — `AC-12: retry action only for failed / pending rows, and it records the actor` |
| AC-13 | `e2e/report-delivery-log.spec.ts` — file-level `test.skip` (no env), schema probe + `beforeEach` skip, `afterAll` → `cleanupBillingQaUsers` |

## As built

- PR: [#39](https://github.com/AGASocial/caicos-pool-service/pull/39) (develop)
- Jira: [KAN-152](https://agasocial.atlassian.net/browse/KAN-152)
- Migration: `supabase/migrations/20261127120000_report_delivery_log.sql` (applied; rollback in `supabase/migrations/rollback/20261127120000_report_delivery_log_rollback.sql`)
- Portal: Unsent-first delivery log at `/reports/deliveries`, job/property status indicators, `GET /api/report-deliveries` and `POST /api/report-deliveries/[id]/retry`.
- Verification: `admin-portal` lint/tsc/jest (55 suites, 318 tests); Playwright E2E (`e2e/report-delivery-log.spec.ts`) 9/9 against Development, recording on `e2e-media`.
