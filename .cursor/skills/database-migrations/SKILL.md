---
name: database-migrations
description: Implements Cadenza database performance stories (US-D-*) — migrations, indexes, denormalization, RLS optimization, rollups, and Supavisor config. Use when working on supabase/migrations or US-D-* plan tasks.
---

# Database Migrations Developer

Implement database performance stories. Used by NextJS Developer for US-D-*; validated by QA.

## Scope

| Owns | Location |
|------|----------|
| SQL migrations | `supabase/migrations/` |
| Schema reference | `docs/schema.sql` |
| RLS policies | Migration files + `docs/schema.sql` |

## Before starting

1. Read story in `plan/manifest.json` and `plan/database/USER-STORIES.md`
2. Check `dependsOn` blockers for downstream stories (US-D-003 unblocks US-B-005; US-D-006 unblocks US-B-008)
3. Set story + task to `IN-PROGRESS`

## Story guidance

| Story | Work |
|-------|------|
| US-D-001 | Composite indexes: `(company_id, scheduled_date DESC)`, `(company_id, status, scheduled_date)` |
| US-D-002 | `cadenza_company_stats` table or counter columns + triggers |
| US-D-003 | Add `email_confirmed_at` to `cadenza_profiles`; backfill; sync trigger from auth |
| US-D-004 | Supavisor transaction mode; update pooler connection strings |
| US-D-005 | Verify `get_my_company_id` is STABLE; audit RLS subqueries |
| US-D-006 | `cadenza_job_stats_daily` rollup + nightly pg_cron or queue job |

## Migration conventions

- Filename: `YYYYMMDDHHMMSS_description.sql`
- Always include `company_id` on tenant tables
- RLS policies must use `get_my_company_id()` or equivalent
- Add `EXPLAIN ANALYZE` notes in story tech refinement when benchmarking
- Backfills: idempotent; safe to re-run

## Multi-tenant safety

```sql
-- ✅ Index scoped to tenant query patterns
CREATE INDEX idx_jobs_company_date
  ON cadenza_service_jobs (company_id, scheduled_date DESC);
```

Never disable RLS. Never add policies that leak cross-company data.

## Task completion

1. Write migration SQL
2. Update `docs/schema.sql` if structural change is permanent
3. Mark task `DONE` in manifest + USER-STORIES.md
4. Note any API changes needed for downstream stories

## Definition of done (story)

- [ ] Migration applies cleanly
- [ ] RLS still enforces tenant isolation (QA verifies)
- [ ] `EXPLAIN ANALYZE` shows index usage where applicable
- [ ] Downstream `dependsOn` stories unblocked

## References

- `plan/agents/nextjs-developer.md` (US-D-* queue)
- Supabase postgres best practices skill when optimizing queries
