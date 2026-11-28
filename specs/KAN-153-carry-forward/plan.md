# KAN-153 — Technical plan

## Approach

Reuse the existing office follow-up model (`cadenza_service_reports.follow_up_status`, dashboard / Jobs `needs_follow_up` filter, `FollowUpActionsCard`) rather than introducing a separate open-issues table. Extend it so that (1) technicians can resolve or confirm issues on a **later** job for the same property, (2) the queue shows **days open** and age filters, and (3) KAN-165 voice-note problems join the same list.

Technicians talk to Supabase directly today and may only update reports they authored; voice notes are office-update only. A single `SECURITY DEFINER` RPC (`review_open_issue`) is the write path for reviews, with an admin-portal API wrapper for the office UI and E2E. Reads for the technician app can stay on RLS (company SELECT is already allowed).

## Components

1. **Migration** `supabase/migrations/20261127180000_open_issue_carry_forward.sql` (+ matching rollback). Additive columns, extended `action_type` check, RPC, grants, indexes on `(follow_up_status)` / open voice notes, voice-note backfill after `_backup_kan153_voice_note_problems`.
2. **Domain** `admin-portal/src/lib/follow-up-jobs.ts`, `admin-portal/src/lib/voice-notes/open-problems.ts` (and classification hook to set `follow_up_status = 'open'`).
3. **Portal APIs** `GET /api/open-issues`, `GET /api/jobs/[id]/open-issues`, `POST /api/open-issues/review`; extend `GET /api/jobs` and `fetchDashboardServerData`.
4. **Portal UI** Dashboard `IssueJobRow` age badge; Jobs list age column + `min_days` filter when follow-up is on; job detail shows age and a resolve control for each open source (report and voice note) without auto-coupling them.
5. **Technician app** List badge on `app/(app)/(tabs)/index.tsx` (and calendar cards if the same component is used); previous-issues section on `app/(app)/job/[id].tsx`; en/es strings; complete-visit guard.
6. **Tests** Jest for days-open, filters, open-issue definition, RPC/API wrappers, complete-visit guard, open-problems helper. Playwright `admin-portal/e2e/carry-forward.spec.ts` on a `qa-billing-*` tenant, `RECORD_VIDEO=1`, system Chrome via `playwright.local-chrome.config.ts` (local file, channel `chrome`; do not need to commit it if it stays untracked).

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Ambiguous `company_id` in RPC/policies makes a check always true | Table-qualify every column; review SQL before apply |
| Technician updates the wrong report (chemistry, notes) | RPC updates only follow-up/review columns; no generic UPDATE policy expansion |
| Voice-note backfill on the shared prod/develop DB | Backup table first; rollback SQL drops new objects and leaves backup in place until explicitly dropped |
| Double counting a visit that has both a flagged report and a problem voice note | Show both as independent items (KAN-165 problems must appear even when the written report was not flagged) |
| E2E hits production or sends customer mail | Local Development `.env.local` only; ephemeral `qa-billing-*` tenant; cleanup in `afterAll`; no Resend calls |
| Completing a visit with unanswered items silently drops issues | Block complete with a prompt (AC-7); unanswered items remain open |

## Test plan

- `admin-portal`: `npm run lint`, `npx tsc --noEmit --skipLibCheck`, `npm test`.
- Playwright locally: `npx playwright test --config=playwright.local-chrome.config.ts e2e/carry-forward.spec.ts` with `RECORD_VIDEO=1`, `SUPABASE_URL` from Development `.env.local` (never print values). Convert the video with ffmpeg to H.264 (`-c:v libx264 -pix_fmt yuv420p -movflags +faststart`) plus a short GIF, push to `e2e-media`, embed the MP4 inline in the develop PR like PR #39.
- Technician-app TypeScript check if a script exists; at minimum the touched TS/TSX must typecheck with the project config.

## Rollout

1. Commit/push spec, then migration, then implementation, then E2E, on `feat/kan-153-carry-forward`.
2. Apply the migration with the Supabase MCP `apply_migration` on project `ejhrfnauifgvopshnnuv` **after** the backup step in the SQL (or a pre-step). Prod and develop share this DB. No migrations from CI.
3. PR to `develop`, wait for CI. Merge with `--squash --admin` if the only CI E2E failures are the known Stripe webhook 302s on Preview.
4. Release PR `develop` → `main`, merge `--merge --admin` once core checks pass.
5. Confirm Vercel production (`cadenza.app`) is READY. Smoke-test `https://admin.cadenzaops.com/login` and `/api/billing/plans` (200) plus `GET /api/open-issues` (401 unauthenticated).
6. Fill As built, mark the README row Built, move Jira to Done with PR and deploy IDs.
