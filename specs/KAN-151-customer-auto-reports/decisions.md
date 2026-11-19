# KAN-151 — Decision log

---

## ADR-001: Per-job booleans vs line items for paid extras

**Status:** Accepted

### Context

Paid add-on work may warrant a customer email, but inventory/line-item modeling is out of scope.

### Options

1. Structured paid line items on the job/report.
2. Two booleans: `has_paid_extras` and `send_paid_extra_report`.

### Decision

Option 2.

### Consequences

- Positive: minimal schema; clear technician/admin UX toggle.
- Negative / follow-ups: email can only say “billable add-on work,” not itemize.

---

## ADR-002: Cron-based catch-up vs inline-only send

**Status:** Accepted

### Context

Admin job complete can call process inline; technician app often writes completion directly to Supabase without hitting the admin API.

### Options

1. Inline-only on admin routes (miss tech closes).
2. Inline on admin complete + cron `process-customer-reports` for pending completed jobs.
3. Database webhook / edge function on every job update.

### Decision

Option 2 (cron every 5 minutes).

### Consequences

- Positive: covers tech-app path without coupling mobile to Resend.
- Negative: up to ~5 minutes latency after technician close.

---

## ADR-003: Allow-list CHECK constraints on event type arrays

**Status:** Accepted

### Context

Event tags must stay within a known vocabulary for settings and emails.

### Options

1. Free-form text arrays.
2. Postgres CHECK that arrays are subsets of fixed allow-lists (settings = routine only; reports = routine + chemical tags).

### Decision

Option 2.

### Consequences

- Positive: DB enforces vocabulary; chemicals can be stored without being emailable.
- Negative: adding a new event type needs a migration.

---

## ADR-004: Delivery log table now (UI later — KAN-152)

**Status:** Accepted

### Context

Need idempotency and observability for sends; a delivery-log UI is a follow-up ticket.

### Options

1. Defer logging until KAN-152.
2. Create `customer_report_deliveries` now; UI later.

### Decision

Option 2.

### Consequences

- Positive: idempotent process and audit trail from day one.
- Negative: table exists before dedicated UI; RLS insert limited to office (service-role used by cron/process).


## ADR-5: Default-off kill switch for customer emails

- **Context:** The migration seeds default auto-send event types for every company, so deploying the code would immediately start emailing end customers. The owner must approve any customer email.
- **Options:** (a) seed settings empty; (b) per-company enabled flag (new migration); (c) env-level kill switch.
- **Decision:** (c) `CUSTOMER_AUTO_REPORTS_ENABLED` must equal `true`; otherwise deliveries are recorded as `skipped` / `auto_send_disabled`.
- **Consequences:** Safe to ship; no extra migration; enabling is a single env change. Jobs closed while disabled are never back-filled. A per-company flag can come later if needed.
