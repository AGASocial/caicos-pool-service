# KAN-151 — Technical plan

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-151 |
| **Status** | In progress |

## Approach

1. Additive migration: company settings, job flags, report event tags, delivery log + RLS/seed/trigger.
2. Pure decide + Resend mailer + process (idempotent via delivery rows; service-role inserts).
3. Admin settings page + job toggles; invoke process on admin job complete; Vercel cron every 5 minutes for tech-app completions.
4. Technician app writes `service_event_types` from visit extras (storage only for chemicals).
5. Tests: Jest decide/mailer/jobs route; Playwright settings/job (skip if schema absent).

## Components

| Area | Change |
|------|--------|
| DB / migrations | `20261117120000_customer_auto_reports.sql` (awaiting owner approval) |
| API / cron | `customer-report-settings`, jobs PATCH hook, `process-customer-reports` cron |
| Admin UI | Settings → Customer reports; job paid-extra toggles |
| Mobile | Visit form → `service_event_types` |
| Email / external | Resend; `REPORTS_EMAIL_FROM` optional |

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Applying migration to shared DB from agents | Owner-approved migration process only |
| Duplicate emails | Terminal delivery check + Resend idempotency key |
| Chemical leakage in email | Decide filters chemical tags; mailer only formats routine labels + paid-extra line |
| Tech close without admin PATCH | 5-minute cron catch-up |
| Pre-migration CI red | E2E skips when settings API indicates missing schema |

## Test plan

- Unit: `decide.test.ts`, `mailer.test.ts`, jobs `[id]` route test
- E2E: `customer-auto-reports.spec.ts` against QA tenant after migration
- Manual: confirm cron auth + one completed job delivery row

## Rollout

1. Owner applies migration.
2. Deploy admin-portal (cron entry already in `vercel.json`).
3. Ensure `RESEND_API_KEY` / optional `REPORTS_EMAIL_FROM` / `CRON_SECRET` set.
4. Open PR; fill As built; status → Built.
