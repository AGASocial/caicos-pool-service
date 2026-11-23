# KAN-148 — Billing dunning & payment-failure grace

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-148 |
| **Status** | Built |
| **PR** | https://github.com/AGASocial/caicos-pool-service/pull/33 |

> Privacy: no customer data. Details in Jira.

## Problem

When a paid subscription invoice fails, a pool service company needs a fixed grace window with full product access, clear UI/email signals, and automatic downgrade when grace expires—without extending grace on every subsequent failure.

## Scope

### In scope

- On payment failure → subscription `past_due`; set `payment_failed_at` / `grace_period_ends_at` (≈14 days) once
- Later failures do **not** extend grace
- Full access during grace (`past_due` treated as entitled)
- Cron `process-grace-expirations` cancels expired past_due and moves company to Free
- Grace banner on billing UI; billing emails (payment failed, related lifecycle)
- Stripe TEST-mode E2E; never production keys

### Non-goals

- Free-plan time-box read-only (KAN-147)
- Custom per-company grace lengths
- Live-mode Stripe charges in CI

## Requirements

1. First `invoice.payment_failed` starts grace; subsequent failures keep original end.
2. `invoice.paid` clears grace and restores active period.
3. Daily (or scheduled) cron processes expired grace → cancel + Free tier.
4. Owner sees grace messaging; receives billing emails.

## Acceptance criteria

- [x] **AC-1:** Payment failure → `past_due` + grace columns set (~14d).
- [x] **AC-2:** Second failure does not extend `grace_period_ends_at`.
- [x] **AC-3:** During grace, mutating APIs still succeed (full access).
- [x] **AC-4:** Billing page shows grace banner when past_due.
- [x] **AC-5:** Cron after backdated grace → canceled + Free.
- [x] **AC-6:** Billing mailer covers payment-failed (and related) paths; unit-tested.
- [x] **AC-7:** E2E aborts unless Stripe key is `sk_test_`; uses test PaymentMethod, not raw PAN entry in app flows where attach API is used.

## Data model & API

- `cadenza_billing_subscriptions.payment_failed_at`, `grace_period_ends_at` (migration `20261112140000_billing_grace_period_columns.sql` — record-only if already applied).
- Webhook handling in `BillingService` + Stripe normalizer.
- `GET /api/cron/process-grace-expirations` (Bearer `CRON_SECRET`); Vercel cron ~07:30 UTC.
- Billing UI reads subscription grace fields.

## Edge cases

- Columns already present in shared DB → idempotent `ADD COLUMN IF NOT EXISTS` / record-only migration.
- Missing `CRON_SECRET` → E2E may skip cron step.
- Live Stripe key → E2E hard-aborts.

## AC → test traceability

| AC | Test file / name |
|----|------------------|
| AC-1 | `admin-portal/src/lib/billing/__tests__/dunning.test.ts` — dunning webhooks / grace start; `e2e/billing-dunning.spec.ts` |
| AC-2 | `dunning.test.ts` — no extend; `billing-dunning.spec.ts` — second failure |
| AC-3 | `billing-dunning.spec.ts` — mutating API during grace |
| AC-4 | `billing-dunning.spec.ts` — grace banner |
| AC-5 | `dunning.test.ts` — grace cron; `billing-dunning.spec.ts` — backdate + cron |
| AC-6 | `admin-portal/src/lib/email/__tests__/billing-mailer.test.ts` |
| AC-7 | `billing-dunning.spec.ts` — `sk_test_` guard + `pm_card_chargeCustomerFail` |

## As built

- **What shipped:** Grace columns, webhook dunning, grace cron, billing emails, banner, Jest dunning/mailer tests, Playwright dunning E2E (Stripe test mode).
- **PR:** https://github.com/AGASocial/caicos-pool-service/pull/33
- **Jira:** https://agasocial.atlassian.net/browse/KAN-148
- **Notes / deltas:** Commit `fc100e0` on the merge path; retroactive brief spec.
