# KAN-147 — Technical plan

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-147 |
| **Status** | Built |

## Approach

Pure expiry helper + company access resolution; enforce writes in middleware so individual routes need not each special-case Free expiry. Banner via existing billing/layout queries. E2E creates a disposable QA company, backdates Free `current_period_end`, asserts 402 + banner + checkout.

## Components

| Area | Change |
|------|--------|
| DB / migrations | None required for core behavior (uses existing Free plan features) |
| API / cron | Middleware `enforceApiWriteAccess` |
| Admin UI | `FreePlanExpiredBanner` |
| Mobile | Out of scope |
| Email / external | None |

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Blocking billing upgrade while read-only | Allowlist billing/checkout paths in write guard |
| Flaky shared QA tenant | E2E creates/cleans throwaway users |

## Test plan

- Unit: `company-access.test.ts`
- E2E: `billing-free-readonly.spec.ts` (no live Stripe charges)

## Rollout

Merged via PR #32 to `develop`. Production cutover tracked with release PR #34.
