# KAN-152 — Technical plan

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-152 |
| **Status** | In progress |

## Approach

1. Additive migration on KAN-151's `customer_report_deliveries`: property reference, actor, attempt count, updated timestamp, indexes (ADR-001).
2. Refactor `customer-reports/process.ts` to record a pending row before sending, then update the same row with the outcome; record actor, property and attempt count. Fall back to legacy columns if the migration is not applied yet (ADR-004).
3. Pure query module (`delivery-log-query.ts`) for status groups, parameter validation and filters; shared by the list route and unit tests.
4. API: `GET /api/report-deliveries` and `POST /api/report-deliveries/[id]/retry`, both session-authenticated, company scoped.
5. UI: `/reports/deliveries` page (Unsent default tab), navigation entry, a status badge component reused on job detail and property detail.
6. Tests: Jest for recording, filters, auth/company scoping, retry; Playwright E2E on an ephemeral tenant.

## Components

| Area | Change |
|------|--------|
| DB / migrations | `20261127120000_report_delivery_log.sql` + rollback; `docs/schema.sql` updated |
| API / cron | `report-deliveries` list + retry routes; cron caps automatic retries |
| Admin UI | Delivery log page, nav item, Reports page link, job/property status indicator |
| Mobile | None |
| Email / external | None (mailer unchanged) |

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Code deployed before migration is applied | Writes fall back to legacy columns; list API returns `SCHEMA_PENDING`; E2E skips |
| Double send on manual retry | Reject recent pending rows; Resend idempotency key `customer-report/{jobId}` stays in place |
| Automatic retry loop spamming a failing recipient | Cap automatic attempts at 3 (ADR-003) |
| Cross-tenant leakage | RLS on the table + explicit `company_id` filter + retry loads the row through the caller's client |
| Filter injection via search text | Strip PostgREST filter metacharacters; property ids are UUID-validated |
| Public repo privacy | Generic fixtures only (`QA Pool Customer`, example addresses) |

## Test plan

- Unit: `delivery-log.test.ts`, `delivery-log-query.test.ts`, `process-delivery-log.test.ts`, list + retry route tests, `ReportDeliveryStatus.test.tsx`.
- E2E: `report-delivery-log.spec.ts` against an ephemeral `qa-billing-*` tenant (never production data).
- Manual / ops: apply migration through the normal process, then open Reports → Delivery log.

## Rollout

1. Owner applies `20261127120000_report_delivery_log.sql` (not applied by agent tooling).
2. Deploy admin-portal; no new env vars (reuses `CUSTOMER_AUTO_REPORTS_ENABLED`, `RESEND_API_KEY`, `CRON_SECRET`).
3. Rollback: `supabase/migrations/rollback/20261127120000_report_delivery_log_rollback.sql`.
