# KAN-148 — Technical plan

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-148 |
| **Status** | Built |

## Approach

Extend billing webhook handling: first payment failure stamps grace; paid clears it. Scheduled cron cancels expired `past_due` and provisions Free. UI banner + Resend billing emails. E2E uses Stripe test PaymentMethod that attaches then fails charges.

## Components

| Area | Change |
|------|--------|
| DB / migrations | `payment_failed_at`, `grace_period_ends_at` (idempotent / record-only) |
| API / cron | Webhooks + `/api/cron/process-grace-expirations` |
| Admin UI | Billing page grace banner |
| Mobile | Out of scope |
| Email / external | `billing-mailer` (payment failed, trial ending, canceled) |

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Double-running migration on shared DB | Record-only / `IF NOT EXISTS` |
| Accidental live charges in E2E | Require `sk_test_`; abort otherwise |
| Extending grace on retries | Only set grace columns when previously null |

## Test plan

- Unit: `dunning.test.ts`, `billing-mailer.test.ts`
- E2E: `billing-dunning.spec.ts` (Stripe TEST only)

## Rollout

PR #33. Cron registered in `admin-portal/vercel.json`.
