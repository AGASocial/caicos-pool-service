# KAN-154 — Monday digest of open issues

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-154 |
| **Status** | In progress |
| **PR** | _(link when open)_ |

> Privacy: no customer data in this file. Details in Jira.

## Problem

Office staff need a Monday view of every still-open issue, grouped by technician and showing how long each item has been open, so they do not have to chase technicians one by one. Carry-forward and days-open already exist (KAN-153); this ticket adds a dedicated office screen and an optional Monday email. The email must be impossible to send in production until an operator explicitly enables it.

## Scope

### In scope

- Dedicated office admin screen that lists the company's current open issues (service-report follow-ups ∪ unresolved problem voice notes), grouped or filterable by technician, with days open and property / issue identity on each row.
- Monday cron + email digest of that same set, behind `MONDAY_DIGEST_ENABLED` (default off). Production must ship with the flag unset and must not have the flag added to Vercel production env in this ticket.
- Reuse KAN-153 `fetchOpenIssues` / `daysOpen` / related helpers and KAN-165 `getOpenVoiceNoteProblems` (via the existing open-issue union). Extend the payload with technician identity where it is missing.
- Recipient safety: cron always requires `Authorization: Bearer <CRON_SECRET>`; when the flag is off the handler returns early and sends nothing; non-production sends only to QA / `qa-billing-*@cadenzaops.com` recipients; no customer addresses; no real (non-QA) recipients without a later explicit enablement in production.

### Non-goals

- Visit-card carry-forward UX (KAN-153, already shipped).
- AI technician-notify / follow-up agent.
- Direct customer messaging or any customer-facing email.
- Changing Vercel production env vars, including setting `MONDAY_DIGEST_ENABLED`.
- Monday digest for the technician mobile app.

## Requirements

1. Office users (`owner`, `admin`, `operations`) can open a dedicated digest / open-issues screen and see all currently open issues for their company, grouped or filterable by technician (origin-job technician; unassigned bucket when missing).
2. Each row shows days open (same calendar-day computation as KAN-153), property identity (name / address as already loaded for the office queue), and issue identity (source, summary / categories, and a link or id to the origin job).
3. `GET /api/cron/monday-digest` is registered in `admin-portal/vercel.json` on a Monday schedule (`0 12 * * 1` = 12:00 UTC, 7:00 AM America/New_York standard time / 8:00 AM daylight time). It uses the existing Bearer `CRON_SECRET` pattern (401 when the secret is missing or the header does not match).
4. The cron is a no-op when `MONDAY_DIGEST_ENABLED` is unset or not a truthy value (`1` / `true` / `yes`, case-insensitive). Response is 200 with a clear skipped/disabled payload and zero sends.
5. When the flag is on, the cron builds one digest per company from the KAN-153 open-issue helpers, emails it to that company's office-role users only (never customers), and is idempotent for the same company + ISO week (America/New_York week starting Monday) + recipient.
6. Outside Vercel production (`VERCEL_ENV` !== `production`), the sender must drop any recipient whose email does not match `qa-billing-…@cadenzaops.com`. This guard cannot be overridden by the enable flag.
7. Optional allow-list: if `MONDAY_DIGEST_COMPANY_IDS` is set (comma-separated UUIDs), only those companies are emailed. Unset means all companies (still subject to the flag and the non-prod QA guard).
8. Mail uses Resend like the existing mailers: missing `RESEND_API_KEY` logs and no-ops; never log the key; lazy-import Resend; locale-aware en/es subject and body. From-address: `DIGEST_EMAIL_FROM` or fallback `Cadenza <notifications@hello.cadenzaops.com>`.
9. Unauthenticated `GET /api/cron/monday-digest` returns 401. The admin screen and any office preview API require an office session (401 / 403 otherwise). Technicians cannot load the digest screen.

## Acceptance criteria

- [ ] **AC-1:** The office digest screen lists open service-report follow-ups and unresolved problem voice notes for the signed-in company, grouped or filterable by technician.
- [ ] **AC-2:** Each visible row shows days open and property / issue identity.
- [ ] **AC-3:** Unauthenticated `GET /api/cron/monday-digest` returns 401. A request with a valid `CRON_SECRET` when `MONDAY_DIGEST_ENABLED` is off returns 200, `skipped` / disabled, and sends no email and writes no send-log row.
- [ ] **AC-4:** When the flag is on, a digest run emails only office-role users, includes age + property/issue + technician grouping, and is idempotent within the same Monday week. In non-production, non-QA recipients are never emailed even if the flag is on.
- [ ] **AC-5:** Foreign-company issues do not appear on the screen or in another company's email. Customers are never recipients.

## Data model & API

### Flag / env (no Vercel production changes in this ticket)

- `MONDAY_DIGEST_ENABLED` — default off. Truthy: `1`, `true`, `yes`.
- `MONDAY_DIGEST_COMPANY_IDS` — optional company UUID allow-list.
- `DIGEST_EMAIL_FROM` — optional From override.
- Existing `CRON_SECRET`, `RESEND_API_KEY`.

### Table `cadenza_monday_digest_sends` (new, additive)

Used for idempotency and a simple “last sent” cue on the screen.

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid pk | default `gen_random_uuid()` |
| `company_id` | uuid not null | FK to companies, on delete cascade |
| `week_start` | date not null | Monday of the America/New_York week |
| `recipient_email` | text not null | |
| `sent_at` | timestamptz not null | default `now()` |
| `resend_message_id` | text null | |
| `issue_count` | integer not null | |

Unique `(company_id, week_start, recipient_email)`. RLS enabled: office roles can `SELECT` their `company_id`; no authenticated `INSERT`/`UPDATE`/`DELETE` (service role only). No backfill, so no backup table.

Rollback SQL drops the table and any indexes / policies.

### HTTP

- `GET /api/cron/monday-digest` — cron; Bearer `CRON_SECRET`; flag short-circuit before any send.
- Office page at `/[locale]/open-issues` (or equivalent dedicated route) plus a small office GET API if the page is not purely server-rendered. Reuse / extend `GET /api/open-issues` with technician fields rather than inventing a parallel open-issue definition.

### Domain

- `isMondayDigestEnabled()`, `isAllowedDigestRecipient(email)`, company allow-list parse, week-start helper, `buildMondayDigest(issues)` (group by technician, sort oldest first), `runMondayDigest({ now })` used by the cron.
- `fetchOpenIssues` remains the source of truth; attach `technician_id` / technician name from the origin job (and voice-note author only as a fallback if the job has no technician).

## Edge cases

- Flag off, missing `CRON_SECRET`, or missing `RESEND_API_KEY`: no send.
- Company with zero open issues: skip email (do not send an empty list).
- Company with open issues but no office email: skip, do not fail the whole run.
- Corrected-to-routine or already-resolved voice notes stay out (existing helper behavior).
- Non-prod + flag on + a real-looking office email: drop that recipient; do not fail other QA recipients.
- Retry after a successful send for the same week/recipient: no second email (unique send-log + Resend idempotency key `monday-digest/{companyId}/{weekStart}/{recipient}`).
- Schema pending (send-log table missing): cron does not throw unsafely; skip or return a structured error without sending a partial blast.
- `days_open` is computed, not stored.

## AC → test traceability

| AC | Test file / name |
|----|------------------|
| AC-1 | `admin-portal/e2e/monday-digest.spec.ts` — office screen grouping / technician filter |
| AC-2 | same E2E — days open + property / issue identity on a row |
| AC-3 | E2E + unit: unauthenticated 401; enabled=false → skipped, zero sends |
| AC-4 | unit (mocked Resend): flag on sends QA office users; non-QA dropped in non-prod; idempotent second run |
| AC-5 | E2E or unit: foreign tenant hidden; customer emails never used as recipients |

## As built

- **What shipped:** Office open-issues screen at `/[locale]/open-issues` (grouped / filterable by technician, days open, property and issue identity). Monday cron `GET /api/cron/monday-digest` (`0 12 * * 1`) emails the same set to office-role users via Resend, but only when `MONDAY_DIGEST_ENABLED` is truthy. Production shipped with the flag unset, so the cron authenticates and returns early with no sends. Non-production sends are limited to `qa-billing-…@cadenzaops.com`.
- **PR:** [#51](https://github.com/AGASocial/caicos-pool-service/pull/51) (develop), squash merge `ef576011fea1075a563cbfa52526d6262be848b2`
- **Release PR:** [#52](https://github.com/AGASocial/caicos-pool-service/pull/52) (develop → main), merge `d5ece3662a0f68895ad8899e6dcf59d69624a827`
- **Jira:** [KAN-154](https://agasocial.atlassian.net/browse/KAN-154)
- **Vercel production deploy:** `dpl_G73kVLTHqtY3KL1qve61AwLs7An9` (cadenza.app, READY) — https://vercel.com/agasocial/cadenza.app/G73kVLTHqtY3KL1qve61AwLs7An9
- **Migration:** `supabase/migrations/20261127200000_monday_open_issues_digest.sql` (applied as `monday_open_issues_digest`); rollback in `supabase/migrations/rollback/20261127200000_monday_open_issues_digest_rollback.sql`. New table `cadenza_monday_digest_sends` (RLS on, 0 rows at apply time; no backup table because nothing was backfilled).
- **Verification:** admin-portal lint/tsc/jest (70 suites, 487 tests); Playwright E2E (`e2e/monday-digest.spec.ts`) 7/7 against Development. Recording: [mp4](https://github.com/AGASocial/caicos-pool-service/raw/e2e-media/kan-154-monday-digest.mp4), [gif](https://raw.githubusercontent.com/AGASocial/caicos-pool-service/e2e-media/kan-154-monday-digest.gif). Production smoke: `/login` 200, `/api/billing/plans` 200, unauthenticated `GET /api/cron/monday-digest` 401, unauthenticated `GET /api/open-issues` 401.
- **Notes / deltas from this spec:** Jobs with no technician appear in an Unassigned bucket (no voice-note-author fallback). AC-4 send path is covered by mocked unit tests, not a live E2E send. `MONDAY_DIGEST_ENABLED` was not set on Vercel production.
