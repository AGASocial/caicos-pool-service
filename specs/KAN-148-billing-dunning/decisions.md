# KAN-148 — Decision log

---

## ADR-001: Record-only idempotent migration for grace columns

**Status:** Accepted

### Context

`payment_failed_at` / `grace_period_ends_at` already existed on the shared database when the ticket landed.

### Options

1. Fresh destructive migration assuming columns are absent.
2. Idempotent `ADD COLUMN IF NOT EXISTS` migration treated as record-only for environments where columns exist.

### Decision

Option 2 — record-only idempotent migration (`20261112140000_billing_grace_period_columns.sql`).

### Consequences

- Positive: safe on shared develop/prod; history documents the schema.
- Negative: agents must not “re-apply” as a mutating ops step against shared DBs.

---

## ADR-002: Stripe test PaymentMethod `pm_card_chargeCustomerFail` in E2E

**Status:** Accepted

### Context

E2E must force invoice payment failure without embedding raw card-number UX fragility.

### Options

1. Type declining test card numbers into Checkout Elements.
2. Attach Stripe test PaymentMethod `pm_card_chargeCustomerFail` via API, then create/pay invoice.

### Decision

Option 2 (with comments noting the underlying test card identity for Stripe docs).

### Consequences

- Positive: stable attach-then-fail behavior in test mode.
- Negative: depends on Stripe continuing to support that test PM id.

---

## ADR-003: E2E never hits production Stripe

**Status:** Accepted

### Context

Dunning E2E creates customers, invoices, and failing charges.

### Options

1. Allow any `STRIPE_SECRET_KEY`.
2. Hard-require `sk_test_` and abort otherwise.

### Decision

Option 2.

### Consequences

- Positive: no accidental live charges.
- Negative: local runs need a test secret configured.
