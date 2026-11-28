# KAN-153 — Tasks

Jira: https://agasocial.atlassian.net/browse/KAN-153

- [x] T1. Move Jira to In Progress; write SDD (`spec.md`, `plan.md`, `decisions.md`, `tasks.md`) and index row; commit/push.
- [x] T2. Additive migration + rollback; review RPC/RLS for ambiguous `company_id`; include backup + voice-note backfill.
- [x] T3. Domain helpers and unit tests (`daysOpen`, open-issue union, min-days filter, extended `getOpenVoiceNoteProblems`, complete-visit guard).
- [x] T4. Portal APIs (`/api/open-issues`, `/api/jobs/:id/open-issues`, `POST /api/open-issues/review`) + Jobs/dashboard query updates; API unit tests (401, company scope, AC-5).
- [x] T5. Portal UI: age column/badge, oldest-first, 7+/14+/30+ filters; office resolve per source; en/es messages.
- [x] T6. Technician app: list badge, previous-issues Yes/No section, RPC persist, complete-visit guard, en/es.
- [x] T7. Hook classification/correction to set/open voice-note `follow_up_status` without breaking KAN-165 tests.
- [ ] T8. Apply migration on project `ejhrfnauifgvopshnnuv` (backup first). `lint` / `tsc` / `npm test`.
- [ ] T9. Playwright E2E (`e2e/carry-forward.spec.ts`) on Development, system Chrome, video → H.264 MP4 + short GIF, push `e2e-media`. _(spec written; run after the migration is applied)_
- [ ] T10. PR to `develop` (embed MP4 like PR #39), CI, merge; release PR to `main`; confirm production READY; smoke-test login, `/api/billing/plans` (200), `/api/open-issues` (401); As built + Jira Done.
