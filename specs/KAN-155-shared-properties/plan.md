# KAN-155 — Technical plan

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-155 |
| **Status** | In progress |

## Approach

Same-company feature only. Add a boolean on the property, an office toggle, a compact last-service reader that reuses existing company-scoped report SELECT, and a technician-app card. Do not change RLS boundaries between companies.

## Components

| Area | Change |
|------|--------|
| DB / migrations | `is_shared` on `cadenza_properties`; rollback SQL; update `docs/schema.sql` if maintained. No backup table (no backfill). Apply via Supabase MCP `apply_migration` after review. Shared DB: do not migrate from CI. |
| API | Property GET/PUT includes `is_shared`. New `GET /api/properties/[id]/last-service`. 401 / 404 as specified. |
| Admin UI | Checkbox + help text on `PropertyForm` (en/es). |
| Mobile | Job detail last-service card when `is_shared`. Helper covered by unit tests. |
| Email / external | None. |

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Misreading “shared” as cross-company | ADR-001; no RLS change; every query filters `company_id`. Stop if a later request asks to share across tenants. |
| Last-service payload too wide | Allow-list fields (filter, salt, date, tech name). No transcripts, emails, photos, follow-up notes. |
| Ambiguous `company_id` in SQL | Table-qualify every column. |
| Expo-web E2E fragility | Cover the summary via the HTTP endpoint + unit tests; add a tech-app E2E only if the existing Expo-web pattern is reliable. |

## Test plan

- Unit: flag parsing/payload, last-service picker (exclude current job, ignore soft-deleted, newest completed), 401/404, non-shared returns null, technician cannot PATCH the flag (if tested at API level).
- E2E: ephemeral `qa-billing-*` tenant; office toggles shared; seed tech A completed visit (filter/salt); last-service API as tech B; 401 unauthenticated; foreign tenant 404; `cleanupBillingQaUsers`; `RECORD_VIDEO=1`; no customer emails; no live charges. Playwright via `playwright.local-chrome.config.ts`.
- Production smoke: `/login` 200, `/api/billing/plans` 200, unauthenticated `GET /api/properties/<uuid>/last-service` 401.

## Rollout

1. Apply additive migration, merge to `develop`, then `develop` → `main`.
2. No new Vercel env vars.
3. Office marks properties shared after release; nothing is auto-flagged.
