# KAN-152 — Tasks

Jira: https://agasocial.atlassian.net/browse/KAN-152

- [x] Spec / plan / decisions drafted (`spec.md`, `plan.md`, `decisions.md`)
- [x] Migration authored: `supabase/migrations/20261127120000_report_delivery_log.sql` + rollback (**not applied** — owner approval)
- [ ] Migration applied (owner) — blocked on owner
- [x] Domain: `delivery-log.ts` (record + save + legacy fallback), `process.ts` actor/property/attempts, auto-retry cap
- [x] Domain: `delivery-log-query.ts` (status groups, params, filters, row mapping)
- [x] API: `GET /api/report-deliveries`
- [x] API: `POST /api/report-deliveries/[id]/retry`
- [x] UI: Report delivery log page (`/reports/deliveries`), navigation + Reports page link
- [x] UI: Delivery status indicator on job detail and property detail
- [x] i18n: `en.json` + `es.json`
- [x] Unit tests: `delivery-log.test.ts`, `delivery-log-query.test.ts`, `process-delivery-log.test.ts`, list + retry route tests, `ReportDeliveryStatus.test.tsx`
- [x] E2E: `admin-portal/e2e/report-delivery-log.spec.ts` (skips without env / schema)
- [x] `billing-qa-cleanup.ts` already deletes `customer_report_deliveries` for QA tenants (no change needed)
- [ ] E2E run against a QA environment with the migration applied
- [ ] Open PR; link here and in As built
- [ ] Fill As built; status → Built
