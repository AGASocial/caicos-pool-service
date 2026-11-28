# KAN-154 — Tasks

Jira: https://agasocial.atlassian.net/browse/KAN-154

- [x] Spec drafted
- [x] Migration written + rollback + `docs/schema.sql` (apply via Supabase MCP after review: not applied by the implementing agent)
- [x] Domain helpers (flag, recipient guard, grouping, runner) reusing KAN-153 / KAN-165 open-issue loaders
- [x] Cron route + `vercel.json` entry; mailer
- [x] Office digest screen (en/es) + technician on the open-issue payload
- [x] Unit tests mapped to ACs
- [x] E2E spec written (`admin-portal/e2e/monday-digest.spec.ts`); ran locally with the flag off, 6 passed / 1 skipped (authorized-cron case needs `CRON_SECRET`)
- [ ] PR to develop, release to main, production smoke, As built, Jira Done
- [ ] Status → Built (on close)
