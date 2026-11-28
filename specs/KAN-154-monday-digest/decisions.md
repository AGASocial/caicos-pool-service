# KAN-154 — Decision log

ADR-style entries, chronological.

---

## ADR-001: Ship the email path behind a default-off env flag

**Status:** Accepted

### Context

A Monday digest is an email. Production and Development share operational credentials, and sending to real office or customer addresses without approval is not allowed.

### Options

1. Ship the cron fully live in production.
2. Ship the cron and screen, but keep sending behind `MONDAY_DIGEST_ENABLED` (default off) and do not set the flag in Vercel production in this ticket.
3. Omit the cron entirely and only ship the admin screen.

### Decision

Option 2. The DoD allows email and/or a screen; both ship, but production sending stays off until an operator enables the flag. The screen is always available to office users.

### Consequences

- Positive: production deploy is safe; unauthenticated calls still 401; authorized calls no-op.
- Negative / follow-ups: enabling later is a manual env change (documented in the plan and the handoff).

---

## ADR-002: Non-production sends are QA-tenant addresses only

**Status:** Accepted

### Context

E2E and Development must be able to exercise the send path without mailing real people if the flag is accidentally set on a non-production deployment.

### Options

1. Rely only on the enable flag.
2. Additionally, when `VERCEL_ENV !== production`, allow only `qa-billing-…@cadenzaops.com` recipients.

### Decision

Option 2. The QA guard is independent of the enable flag and has no override env.

### Consequences

- Positive: Development / Preview cannot blast real inboxes.
- Negative / follow-ups: a Preview test with a non-QA user will not receive mail (expected).

---

## ADR-003: Reuse the KAN-153 open-issue union; add a send-log table only

**Status:** Accepted

### Context

Days open and the open-issue set already exist. The ticket also needs Monday-week idempotency for email.

### Options

1. New open-issues table or materialized snapshot.
2. Reuse `fetchOpenIssues` / `getOpenVoiceNoteProblems` and add only `cadenza_monday_digest_sends` for send idempotency.

### Decision

Option 2. No backup table, because nothing is backfilled.

### Consequences

- Positive: one definition of “open”; small migration.
- Negative / follow-ups: the digest is a live snapshot, not a frozen “Friday close” export (acceptable for v1).

---

## ADR-004: Recipients are office-role users, not technicians and not customers

**Status:** Accepted

### Context

The digest exists so the office does not have to chase each technician by hand. Emailing technicians or customers is out of scope and unsafe.

### Decision

Send only to profiles with role `owner`, `admin`, or `operations` for that company. Resolve email from the auth user / profile the same way other transactional mailers do. Never use property or customer emails.

### Consequences

- Positive: matches the product intent and the “no customer email” rule.
- Negative / follow-ups: technicians do not receive the Monday list (they already see carry-forward on the next visit).
