# KAN-154 — Technical plan

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-154 |
| **Status** | In progress |

## Approach

Admin-portal only. Build on the KAN-153 open-issue union (reports + voice-note problems) and days-open helpers. Add a dedicated office screen first (always available, read-only, no email). Then a cron + Resend mailer that is disabled unless `MONDAY_DIGEST_ENABLED` is truthy, so production can ship the route and schedule as a no-op. A small send-log table gives per-week idempotency without backfill.

## Components

| Area | Change |
|------|--------|
| DB / migrations | New `cadenza_monday_digest_sends` + RLS + unique key; rollback SQL; update `docs/schema.sql`. No backup table (no backfill). Apply via Supabase MCP `apply_migration` (name `monday_open_issues_digest`) after SQL review. Shared DB: do not rely on CI to migrate. |
| API / cron | `GET /api/cron/monday-digest` + `vercel.json` entry `0 12 * * 1`. Extend open-issue payload with technician. Optional thin office GET if the page needs it. |
| Admin UI | Office page (en/es) grouped / filterable by technician; link from the existing jobs / follow-up area; last-sent if a log row exists. |
| Mobile | None. |
| Email / external | New digest mailer (Resend, lazy import, no key logging). Recipients = office-role users only. Non-prod QA-email guard. |

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Accidental customer or real-company email | Flag defaults off; do not set it in Vercel production; non-prod QA recipient allow-list; office-role recipients only; never use property / customer emails. |
| Cron runs in production after deploy | Flag short-circuit is the first logic after auth; returns 200 skipped with no DB blast required. Verify unauthenticated 401 after deploy. |
| Double send on retry | Unique `(company_id, week_start, recipient_email)` plus Resend idempotency key. |
| Ambiguous `company_id` in RLS / SQL | Table-qualify every column; review policies the same way as KAN-153. |
| Open-issue definition drifts | Do not re-query reports/voice notes ad hoc; call `fetchOpenIssues` / existing union helpers. |
| Missing technician on the current OpenIssue type | Extend the loader from the origin job; do not invent a second source of truth. |

## Test plan

- Unit: enabled/disabled, recipient guard, company allow-list, grouping, empty company skip, idempotency, mailer no-op without API key, schema-pending.
- E2E: ephemeral `qa-billing-*` tenant only; office screen AC-1/AC-2; cron 401; cron authorized + flag off = skipped; `cleanupBillingQaUsers`; `RECORD_VIDEO=1`; no customer email; no live charges. Playwright via `playwright.local-chrome.config.ts` (system Chrome, untracked).
- Production smoke: `/login` 200, `/api/billing/plans` 200, unauthenticated `GET /api/cron/monday-digest` 401. Do not call the cron with the production secret as part of this ticket.

## Rollout

1. Apply additive migration to the shared DB, then merge to `develop`, then `develop` → `main`.
2. Leave `MONDAY_DIGEST_ENABLED` unset everywhere in Vercel, especially production.
3. To turn the digest on later (operator steps, not this ticket): set `MONDAY_DIGEST_ENABLED=1` on Vercel project `cadenza.app` production (and confirm `CRON_SECRET` and `RESEND_API_KEY` are already set; set `DIGEST_EMAIL_FROM` if the fallback from-address is not verified). Optionally set `MONDAY_DIGEST_COMPANY_IDS` to a single company UUID for a staged first send. Recipients are that company's office-role users (`owner`, `admin`, `operations`). Schedule is Vercel Cron `0 12 * * 1` (Monday 12:00 UTC). Redeploy or wait for the env to attach, then confirm the first Monday send.
