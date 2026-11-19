# KAN-147 — Free plan expiry → company read-only

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-147 |
| **Status** | Built |
| **PR** | https://github.com/AGASocial/caicos-pool-service/pull/32 |

> Privacy: no customer data. Details in Jira.

## Problem

When a pool service company’s Free subscription period ends, the company must not keep full write access. Staff should still view data and upgrade/checkout, but mutating APIs must be blocked until they subscribe.

## Scope

### In scope

- Evaluate Free-plan expiry from subscription + plan duration fields
- Company access mode: `full` vs `read_only`
- Central API write guard (middleware) returning **402** for mutating requests when read-only
- In-app banner when Free plan is expired
- Billing plans / checkout still available while read-only
- Unit + E2E coverage on a throwaway QA tenant

### Non-goals

- Changing paid-plan entitlements beyond Free expiry
- Payment-failure grace / dunning (see KAN-148)
- Deleting historical data on expiry

## Requirements

1. Free plan with elapsed period → company `read_only`.
2. Mutating admin API calls while read-only → **402**.
3. Read/GET and billing upgrade paths remain usable.
4. UI shows a Free-expired read-only banner.

## Acceptance criteria

- [x] **AC-1:** Expired Free subscription evaluates as expired / read-only.
- [x] **AC-2:** Mutating API under read-only returns 402.
- [x] **AC-3:** Read-only banner visible in admin UI when applicable.
- [x] **AC-4:** Plans page + checkout session creation still work while read-only (test-mode checkout URL only).

## Data model & API

- Uses existing `cadenza_billing_subscriptions` / `cadenza_billing_plans` (`plan_free`, `plan_duration_days`, `current_period_end`).
- Access helpers: `evaluateFreePlanExpiry`, `enforceApiWriteAccess` / company access mode.
- Middleware runs write guard on `/api` mutating methods.

## Edge cases

- Missing Supabase env → guard skips (logged); do not brick local without billing env.
- Paid / active / trialing / past_due (grace) keep write access (past_due owned by KAN-148).
- Prefers `current_period_end`; falls back to `createdAt + planDurationDays`.

## AC → test traceability

| AC | Test file / name |
|----|------------------|
| AC-1 | `admin-portal/src/lib/__tests__/company-access.test.ts` — `evaluateFreePlanExpiry` |
| AC-2 | `company-access.test.ts` — `enforceApiWriteAccess`; `admin-portal/e2e/billing-free-readonly.spec.ts` — mutating API 402 |
| AC-3 | `billing-free-readonly.spec.ts` — banner shows |
| AC-4 | `billing-free-readonly.spec.ts` — checkout still works (`cs_test_` URL) |

## As built

- **What shipped:** Free-plan expiry evaluation, company read-only mode, middleware API write guard (402), FreePlanExpiredBanner, Jest + Playwright E2E on QA billing tenant.
- **PR:** https://github.com/AGASocial/caicos-pool-service/pull/32 (merged to `develop`; release to `main` pending in PR #34).
- **Jira:** https://agasocial.atlassian.net/browse/KAN-147
- **Notes / deltas:** Commit `4d53512` on the merge path; retroactive brief spec.
