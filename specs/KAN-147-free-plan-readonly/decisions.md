# KAN-147 — Decision log

---

## ADR-001: Central middleware write guard vs per-route checks

**Status:** Accepted

### Context

Many mutating admin API routes must refuse writes when Free plan is expired.

### Options

1. Add a check inside every mutating handler.
2. Enforce once in middleware for `/api` mutating methods, with billing allowlist.

### Decision

Option 2 — `enforceApiWriteAccess` in middleware.

### Consequences

- Positive: one choke point; hard to miss a route.
- Negative / follow-ups: allowlist must stay accurate for auth/billing endpoints.

---

## ADR-002: Prefer `current_period_end` for Free expiry

**Status:** Accepted

### Context

Free plans may have `plan_duration_days` and/or an explicit period end set at onboarding.

### Options

1. Always `createdAt + durationDays`.
2. Prefer `current_period_end`, fall back to created + duration.

### Decision

Option 2 (`evaluateFreePlanExpiry`).

### Consequences

- Positive: backdating period end in tests/ops is straightforward.
- Negative: inconsistent period ends if data is poorly maintained.
