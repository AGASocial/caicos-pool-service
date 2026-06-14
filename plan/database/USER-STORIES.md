# Database User Stories

Performance & scalability backlog for **Supabase Postgres** migrations, indexes, RLS, and pooling.  
Default agent: **NextJS Developer** · **QA Specialist** validates RLS

Migrations live at repo root: `supabase/migrations/`

---

## US-D-001 — Composite indexes for admin query patterns

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Medium |
| **Phase** | 0 |
| **Source findings** | D-1 |

### Description

As the **platform**, I want indexes aligned to admin list and filter queries so that job lists and reports stay fast beyond 100k rows per tenant.

Schema defines `idx_cadenza_service_jobs_tech_date` (mobile path) but admin queries often filter `company_id + scheduled_date + status`.

### Acceptance criteria

- [ ] Migration adds `(company_id, scheduled_date DESC)` index
- [ ] Migration adds `(company_id, status, scheduled_date)` index
- [ ] EXPLAIN ANALYZE shows index usage on jobs list query

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-D-001-1 | Add migration idx_jobs_company_date on (company_id, scheduled_date DESC) | PENDING |
| T-D-001-2 | Add idx_jobs_company_status_date on (company_id, status, scheduled_date) | PENDING |
| T-D-001-3 | Run EXPLAIN ANALYZE on jobs list and reports queries | PENDING |

---

## US-D-002 — Company stats counters for dashboard

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Medium |
| **Phase** | 1 |
| **Source findings** | D-2 |

### Description

As an **admin**, I want dashboard totals to load instantly so that count queries do not scan entire tables as job volume grows.

GET `/api/dashboard` runs four `count: 'exact', head: true` queries on full tables per request.

### Acceptance criteria

- [ ] O(1) read for totalJobs, totalRoutes, totalTeamMembers, totalProperties
- [ ] Counters stay consistent within acceptable lag (≤5 min or trigger-maintained)
- [ ] Dashboard API updated to use new source

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-D-002-1 | Design counter columns or cadenza_company_stats table | PENDING |
| T-D-002-2 | Add triggers or periodic refresh to maintain counts | PENDING |
| T-D-002-3 | Update GET /api/dashboard to read from stats source | PENDING |

---

## US-D-003 — Denormalize email_confirmed_at on cadenza_profiles

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Critical |
| **Phase** | 0 |
| **Source findings** | A-6 |
| **Unblocks** | US-B-005 |

### Description

As the **platform**, I want email confirmation status on `cadenza_profiles` so that the team API does not call Auth Admin once per team member.

### Acceptance criteria

- [ ] Column `email_confirmed_at TIMESTAMPTZ` on `cadenza_profiles`
- [ ] Existing users backfilled
- [ ] Trigger syncs on auth.users email confirmation change
- [ ] RLS policies unchanged for profiles

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-D-003-1 | Add email_confirmed_at TIMESTAMPTZ column to cadenza_profiles | PENDING |
| T-D-003-2 | Backfill from auth.users via one-time script | PENDING |
| T-D-003-3 | Add trigger on auth user update to sync confirmed_at | PENDING |
| T-D-003-4 | Unblocks US-B-005 team endpoint fix | PENDING |

---

## US-D-004 — Supavisor connection pool configuration

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | High |
| **Phase** | 1 |
| **Source findings** | D-4 |

### Description

As the **platform**, I want serverless functions to use a connection pooler so that burst traffic does not exhaust Postgres max connections.

### Acceptance criteria

- [ ] Supavisor transaction mode enabled on Supabase project
- [ ] Vercel env uses pooler connection string
- [ ] Runbook documents pool size and monitoring

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-D-004-1 | Enable Supavisor transaction mode on Supabase project | PENDING |
| T-D-004-2 | Update connection strings for Vercel serverless (pooler URL) | PENDING |
| T-D-004-3 | Document pool size limits and monitoring in plan/database | PENDING |

---

## US-D-005 — Optimize RLS get_my_company_id helper

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Medium |
| **Phase** | 1 |
| **Source findings** | D-3 |

### Description

As the **platform**, I want RLS policies to add minimal per-query overhead so that high QPS from mobile and admin does not multiply function call cost.

### Acceptance criteria

- [ ] `get_my_company_id()` verified STABLE with indexed profile lookup
- [ ] No redundant subqueries in hot-path policies
- [ ] Benchmark documents before/after overhead

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-D-005-1 | Verify get_my_company_id is STABLE and uses indexed lookup | PENDING |
| T-D-005-2 | Review RLS policies for redundant subqueries | PENDING |
| T-D-005-3 | Benchmark RLS overhead before/after on hot tables | PENDING |

---

## US-D-006 — Daily job stats rollup table

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | High |
| **Phase** | 2 |
| **Source findings** | A-5, D-2 |
| **Supports** | US-B-004, US-B-008 |

### Description

As an **admin running reports**, I want pre-aggregated daily stats so that reporting over months does not scan millions of job rows.

### Acceptance criteria

- [ ] Table `cadenza_job_stats_daily` with company_id, date, status counts, technician breakdown optional
- [ ] Nightly job populates rollups idempotently
- [ ] Reports API uses rollups for ranges > 7 days

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-D-006-1 | Create cadenza_job_stats_daily (company_id, date, status counts) | PENDING |
| T-D-006-2 | Add nightly pg_cron or queue job to populate rollups | PENDING |
| T-D-006-3 | Point reports API to rollup for ranges > 7 days | PENDING |
