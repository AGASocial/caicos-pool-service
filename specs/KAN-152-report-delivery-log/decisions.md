# KAN-152 — Decision log

Chronological.

---

## ADR-001: Extend the KAN-151 delivery table instead of a new table

**Status:** Accepted

### Context

KAN-151 created `customer_report_deliveries` with status (`queued` / `sent` / `failed` / `skipped`), recipient, reason, job and company. The status vocabulary already covers the required statuses (`queued` is shown to users as "pending"), and `reason` already holds error details. Missing: actor, property reference, attempt tracking, last-attempt time.

### Options

1. New log table alongside the old one.
2. Additive columns on the existing table.
3. No schema change; derive property from the job join and drop actor.

### Decision

Option 2. A migration is required (actor is a hard requirement). It adds `property_id`, `trigger_source`, `triggered_by`, `attempt_count`, `updated_at` plus two indexes; everything is `IF NOT EXISTS` and idempotent, with a rollback file. Status CHECK, RLS and existing columns are unchanged. The migration is authored only; it is applied by the owner.

### Consequences

- Positive: no data migration between tables; KAN-151 code paths keep working.
- Negative / follow-ups: `property_id` is denormalized from the job (backfilled; kept in sync by `process.ts`).

---

## ADR-002: One row per job with in-place updates, not an append-only attempt history

**Status:** Accepted

### Context

KAN-151 inserted a new row per attempt. A failed send followed by a successful retry would leave a stale failed row in the "Unsent" view, which defeats its purpose.

### Options

1. Append-only attempts; compute latest-per-job at read time (DISTINCT ON / view).
2. Update the job's delivery row in place (status, reason, actor, `attempt_count`, `updated_at`).

### Decision

Option 2. A pending (`queued`) row is written before sending and updated with the outcome. Filters and pagination become plain row filters.

### Consequences

- Positive: simple, indexable queries; Unsent reflects current truth.
- Negative / follow-ups: no per-attempt history beyond the attempt count and the latest actor/reason. Legacy duplicate rows created before this change stay as they are.

---

## ADR-003: Cap automatic retries at 3; manual retry is unlimited

**Status:** Accepted

### Context

KAN-151's cron treats `failed` as non-terminal and retries every 5 minutes indefinitely. With a persistent failure (e.g. invalid recipient) this would retry forever and keep rewriting the row.

### Options

1. Keep unlimited automatic retries.
2. Cap automatic attempts (3) and leave the row `failed` for staff to retry manually.

### Decision

Option 2 via `MAX_AUTO_ATTEMPTS = 3`. Manual retry from the log ignores the cap.

### Consequences

- Positive: bounded provider traffic; persistent failures surface in Unsent for a human.
- Negative / follow-ups: a transient outage longer than ~15 minutes needs a manual retry.

---

## ADR-004: Rollout-safe writes (legacy fallback) and 503 on missing schema

**Status:** Accepted

### Context

The migration is applied by the owner, possibly after the code ships. A write that references missing columns would fail, and since KAN-151 uses delivery rows for idempotency, failed log writes could cause duplicate customer emails.

### Options

1. Require the migration before deploy.
2. Detect "missing column" errors and retry with legacy columns only; make the list API return `SCHEMA_PENDING`.

### Decision

Option 2.

### Consequences

- Positive: safe in any deploy order; idempotency preserved.
- Negative / follow-ups: the fallback code can be removed once the migration is applied everywhere.

---

## ADR-005: Manual retry honors the global kill switch

**Status:** Accepted

### Context

KAN-151 ADR-5: no customer email is sent unless `CUSTOMER_AUTO_REPORTS_ENABLED=true`. A manual "Retry" button could be read as an explicit human override.

### Options

1. Manual retry always sends.
2. Manual retry is blocked (409, no row change) when the switch is off.

### Decision

Option 2. The switch is the owner's single control over customer-facing email; the UI shows the API error message.

### Consequences

- Positive: no accidental customer email while disabled.
- Negative / follow-ups: office staff cannot retry until the switch is enabled; a per-company control could come later.

---

## ADR-006: Page-based pagination for the log

**Status:** Accepted

### Context

Other list APIs use cursor pagination, but the log UI needs "page N of M" and a total for tab context, and rows are ordered by time with modest volume per company.

### Decision

`page` + `limit` (max 100) with an exact count and `hasMore`; rows ordered by `created_at DESC, id DESC`.

### Consequences

- Positive: simple UI and tests.
- Negative / follow-ups: deep pages are offset-based; revisit if volumes grow.
