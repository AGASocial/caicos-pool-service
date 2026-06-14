# Backend User Stories

Performance & scalability backlog for **Next.js API routes**, cron, BFF layer, and infrastructure.  
Default agent: **NextJS Developer** · QA for US-B-016

---

## US-B-001 — Cursor pagination on list endpoints

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Critical |
| **Phase** | 0 |
| **Source findings** | A-4 |

### Description

As an **admin user**, I want job and property lists to load in pages so that responses stay fast as my company grows to thousands of records.

Currently GET `/api/jobs` and `/api/properties` return unbounded arrays.

### Acceptance criteria

- [ ] `limit` (default 50, max 100) and cursor params on jobs and properties
- [ ] Response includes `hasMore` and `nextCursor`
- [ ] Frontend supports pagination or load-more
- [ ] Tests cover empty, single-page, and multi-page results

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-001-1 | Define pagination contract (limit, cursor, hasMore, total optional) | PENDING |
| T-B-001-2 | Add pagination to GET /api/jobs (default limit=50) | PENDING |
| T-B-001-3 | Add pagination to GET /api/properties | PENDING |
| T-B-001-4 | Add pagination to GET /api/routes list response if needed | PENDING |
| T-B-001-5 | Update frontend list pages to support load-more or paged UI | PENDING |
| T-B-001-6 | Add API route tests for pagination edge cases | PENDING |

---

## US-B-002 — Push jobs day-of-week filter to SQL

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | High |
| **Phase** | 0 |
| **Source findings** | A-2 |

### Description

As an **admin filtering jobs by weekday**, I want the database to filter rows so that the API does not fetch an entire date range and filter in Node.

### Acceptance criteria

- [ ] `day_of_week` param filters in Postgres
- [ ] In-memory filter removed from `api/jobs/route.ts`
- [ ] Unit test added

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-002-1 | Add Postgres filter using EXTRACT(DOW FROM scheduled_date) in jobs route | PENDING |
| T-B-002-2 | Remove in-memory day_of_week filter from route handler | PENDING |
| T-B-002-3 | Add unit test for day_of_week query param | PENDING |

---

## US-B-003 — Rewrite unassigned properties as SQL anti-join

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | High |
| **Phase** | 0 |
| **Source findings** | A-3 |

### Description

As an **admin editing routes**, I want the unassigned-properties query to scale so that adding stops does not load every route stop ID into memory.

### Acceptance criteria

- [ ] `?unassigned=true` uses NOT EXISTS or LEFT JOIN anti-join
- [ ] No full-table scan of `cadenza_route_stops` into Node
- [ ] RLS still enforced

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-003-1 | Replace load-all-stops + NOT IN with NOT EXISTS or LEFT JOIN IS NULL | PENDING |
| T-B-003-2 | Verify RLS still scopes results to company | PENDING |
| T-B-003-3 | Benchmark with 1000+ properties fixture | PENDING |

---

## US-B-004 — SQL aggregation for reports endpoint

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | High |
| **Phase** | 1 |
| **Source findings** | A-5 |

### Description

As an **admin viewing reports**, I want aggregated stats computed in the database so that large date ranges do not OOM Vercel functions.

### Acceptance criteria

- [ ] GET `/api/reports/jobs` uses GROUP BY, not full row load
- [ ] Response JSON shape unchanged for frontend
- [ ] Handles 90-day range for 10k+ jobs per company

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-004-1 | Replace full-row fetch with GROUP BY status aggregation query | PENDING |
| T-B-004-2 | Add technician breakdown via SQL GROUP BY technician_id | PENDING |
| T-B-004-3 | Maintain existing JSON response shape for frontend compatibility | PENDING |
| T-B-004-4 | Add tests for date range and empty result sets | PENDING |

---

## US-B-005 — Fix team endpoint N+1 Auth Admin calls

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Critical |
| **Phase** | 0 |
| **Depends on** | US-D-003 |
| **Source findings** | A-6 |

### Description

As an **admin viewing the team page**, I want it to load in one query so that Auth Admin API rate limits are not hit under load.

### Acceptance criteria

- [ ] GET `/api/team` makes zero `getUserById` calls
- [ ] `email_confirmed` read from `cadenza_profiles.email_confirmed_at`
- [ ] Team UI behavior unchanged

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-005-1 | Read email_confirmed from cadenza_profiles after US-D-003 migration | PENDING |
| T-B-005-2 | Remove Promise.all getUserById loop from GET /api/team | PENDING |
| T-B-005-3 | Verify team page UI unchanged | PENDING |

---

## US-B-006 — API response caching layer

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | High |
| **Phase** | 1 |
| **Source findings** | B-4, N-1 |

### Description

As the **platform**, I want slow-changing reference data cached so that repeated reads do not hit Postgres on every request.

### Acceptance criteria

- [ ] Visit reasons and routes list cached per company
- [ ] TTL documented; invalidation on writes
- [ ] Cache hit rate measurable

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-006-1 | Select cache backend (Vercel KV or unstable_cache for MVP) | PENDING |
| T-B-006-2 | Cache GET visit-reasons, routes list with company-scoped keys | PENDING |
| T-B-006-3 | Add cache invalidation on relevant mutations | PENDING |
| T-B-006-4 | Document TTL policy in plan/backend notes | PENDING |

---

## US-B-007 — Rate limiting on API routes

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | High |
| **Phase** | 1 |
| **Source findings** | B-5 |

### Description

As the **platform**, I want per-user rate limits so that abuse and retry storms cannot exhaust Supabase connections.

### Acceptance criteria

- [ ] 429 returned with Retry-After when exceeded
- [ ] Auth, security, upload endpoints have stricter limits
- [ ] Limits keyed by authenticated user id

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-007-1 | Implement rate limit middleware/helper keyed by user.id | PENDING |
| T-B-007-2 | Apply to auth, security, and write endpoints first | PENDING |
| T-B-007-3 | Return 429 with Retry-After header | PENDING |
| T-B-007-4 | Configure stricter limits on /api/storage/upload | PENDING |

---

## US-B-008 — Queue-based sharded job generation cron

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Critical |
| **Phase** | 2 |
| **Depends on** | US-D-006 (optional) |
| **Source findings** | B-1 |

### Description

As the **platform**, I want route job generation sharded by company so that the daily cron does not timeout when hundreds of tenants have active routes.

### Acceptance criteria

- [ ] Cron enqueues work per `company_id`, not one global loop
- [ ] Workers idempotent; safe to retry
- [ ] Completes for 500+ companies within SLA

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-008-1 | Design queue worker contract (company_id shard, idempotent upsert) | PENDING |
| T-B-008-2 | Refactor cron to enqueue per-company jobs instead of global loop | PENDING |
| T-B-008-3 | Implement worker endpoint or Edge Function with CRON_SECRET auth | PENDING |
| T-B-008-4 | Add dead-letter and retry with exponential backoff | PENDING |
| T-B-008-5 | Load test cron for 500+ companies within timeout budget | PENDING |

---

## US-B-009 — Async 202 pattern for bulk job generation

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | High |
| **Phase** | 2 |
| **Depends on** | US-B-008 |
| **Source findings** | B-2 |

### Description

As an **admin generating jobs for a route**, I want long-running generation to return immediately so that the HTTP request does not block a serverless worker for minutes.

### Acceptance criteria

- [ ] Large batch returns 202 + job_id
- [ ] Status polling endpoint available
- [ ] Route detail UI shows progress

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-009-1 | POST /api/routes/[id]/generate-jobs returns 202 + job_id for large batches | PENDING |
| T-B-009-2 | Add GET /api/jobs/generation-status/:id polling endpoint | PENDING |
| T-B-009-3 | Update route detail UI to poll generation status | PENDING |

---

## US-B-010 — Presigned direct-to-storage uploads

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | High |
| **Phase** | 2 |
| **Source findings** | B-3 |

### Description

As an **admin uploading files**, I want uploads to go directly to Supabase Storage so that Vercel functions are not blocked by CPU-bound encryption streams.

### Acceptance criteria

- [ ] Presign endpoint returns upload URL + path
- [ ] Large files no longer stream through Vercel
- [ ] Security model documented (encryption scope)

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-010-1 | Add POST /api/storage/presign returning signed upload URL + path | PENDING |
| T-B-010-2 | Move encryption off hot path or document client-side envelope for report photos | PENDING |
| T-B-010-3 | Update admin upload components to use presigned flow | PENDING |
| T-B-010-4 | Deprecate streaming encrypt-through-Vercel for large files | PENDING |

---

## US-B-011 — Server-side timeouts and resilience patterns

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Medium |
| **Phase** | 1 |
| **Source findings** | A-7, R-1 |

### Description

As the **platform**, I want Supabase calls to timeout predictably so that slow DB queries do not hold serverless workers until platform timeout.

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-011-1 | Configure Supabase client fetch with 10s timeout in supabase-server.ts | PENDING |
| T-B-011-2 | Add structured error responses for timeout vs 500 | PENDING |
| T-B-011-3 | Document circuit breaker approach for Supabase outages | PENDING |

---

## US-B-012 — Single-pass auth validation

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | High |
| **Phase** | 1 |
| **Source findings** | S-1, F-4 |

### Description

As the **platform**, I want each user action to validate auth once so that Supabase Auth API QPS stays within limits at scale.

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-012-1 | Evaluate JWT local verify in middleware for routing-only decisions | PENDING |
| T-B-012-2 | Pass verified claims to API routes to skip redundant getUser | PENDING |
| T-B-012-3 | Measure Auth API call reduction in staging | PENDING |

---

## US-B-013 — Edge-cache reference data endpoints

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Medium |
| **Phase** | 1 |
| **Source findings** | S-2, N-1 |

### Description

As the **platform**, I want public reference data (billing plans) edge-cached so that identical reads do not hit the database.

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-013-1 | Add Cache-Control s-maxage=3600 to GET /api/billing/plans | PENDING |
| T-B-013-2 | Add stale-while-revalidate for visit-reasons per company | PENDING |
| T-B-013-3 | Verify cache headers do not leak user-specific data | PENDING |

---

## US-B-014 — Sparse fieldsets and payload optimization

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Medium |
| **Phase** | 1 |
| **Source findings** | N-2 |

### Description

As an **admin viewing job lists**, I want smaller JSON payloads so that mobile and slow networks load faster.

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-014-1 | Add fields= query param support to GET /api/jobs for list vs detail shapes | PENDING |
| T-B-014-2 | Create GET /api/jobs/form-data composite endpoint for new job page | PENDING |
| T-B-014-3 | Reduce nested join payload on list views | PENDING |

---

## US-B-015 — Production observability instrumentation

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | High |
| **Phase** | 1 |
| **Source findings** | Review §6 metrics |

### Description

As an **operator**, I want request duration and error metrics so that I can detect degradation before users report outages.

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-015-1 | Add request duration logging with route label in API middleware wrapper | PENDING |
| T-B-015-2 | Integrate Vercel Observability or OpenTelemetry exporter | PENDING |
| T-B-015-3 | Define alert thresholds document in plan/README or runbook | PENDING |
| T-B-015-4 | Add slow query logging hook for Supabase errors | PENDING |

---

## US-B-016 — Load testing harness and performance baseline

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | High |
| **Phase** | 2 |
| **Agent** | QA Specialist |
| **Source findings** | Review §4 Load Testing |

### Description

As a **QA engineer**, I want repeatable load tests so that we can prove scalability improvements and catch regressions before production.

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-B-016-1 | Create k6 scripts for dashboard, jobs list, team, mobile job fetch | PENDING |
| T-B-016-2 | Run baseline against staging and record p50/p95/p99 | PENDING |
| T-B-016-3 | Add spike and soak scenarios to CI or manual runbook | PENDING |
| T-B-016-4 | Publish baseline report in plan/ or docs/ | PENDING |
