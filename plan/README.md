# Cadenza Performance & Scalability Plan

Backlog derived from the [Performance & Scalability Review](../docs/) (June 2026). User stories are grouped by domain and intended for tech refinement before assignment to development agents.

## Folder structure

```
plan/
├── README.md                 ← You are here
├── manifest.json             ← Machine-readable index (status, tasks, agents)
├── frontend/USER-STORIES.md
├── backend/USER-STORIES.md
├── mobile/USER-STORIES.md
└── database/USER-STORIES.md
```

## Status values

| Status | Meaning |
|--------|---------|
| `PENDING` | Not started; awaiting refinement or assignment |
| `IN-PROGRESS` | Actively being developed |
| `DONE` | Implemented and verified |

Update status in **both** `manifest.json` and the relevant `USER-STORIES.md` when work moves forward.

## Agent assignment (default)

| Domain | Primary agent |
|--------|----------------|
| `frontend/` | NextJS Developer |
| `backend/` | NextJS Developer (API routes, cron, BFF) |
| `mobile/` | React Native Developer |
| `database/` | NextJS Developer + QA (migrations, RLS) |

Cross-cutting stories (observability, load testing) default to **NextJS Developer** with **QA Specialist** for verification.

## Phases (recommended order)

| Phase | Focus | Target score impact |
|-------|--------|---------------------|
| **0** | Quick wins (pagination, N+1, layout cache, SQL fixes) | 38 → ~55 |
| **1** | Structural (RSC, React Query, caching, rate limits) | 55 → ~72 |
| **2** | Scale architecture (queues, rollups, upload path) | 72 → ~85 |
| **3** | 10k concurrent (read path optimization, bulkheads) | 85 → ~90+ |

## Summary index

| ID | Title | Domain | Phase | Priority | Status |
|----|-------|--------|-------|----------|--------|
| US-F-001 | Migrate read-heavy pages to RSC | frontend | 1 | Critical | PENDING |
| US-F-002 | Standardize TanStack Query data layer | frontend | 0 | High | PENDING |
| US-F-003 | Reduce layout shell API fan-out | frontend | 0 | High | PENDING |
| US-F-004 | Code-split heavy and legacy routes | frontend | 1 | Medium | PENDING |
| US-F-005 | Eliminate form page API waterfalls | frontend | 0 | Medium | PENDING |
| US-F-006 | Client fetch utilities (timeout, abort) | frontend | 0 | Medium | PENDING |
| US-B-001 | Cursor pagination on list endpoints | backend | 0 | Critical | PENDING |
| US-B-002 | SQL day-of-week filter for jobs | backend | 0 | High | PENDING |
| US-B-003 | SQL anti-join for unassigned properties | backend | 0 | High | PENDING |
| US-B-004 | SQL aggregation for reports | backend | 1 | High | PENDING |
| US-B-005 | Fix team endpoint N+1 Auth Admin | backend | 0 | Critical | PENDING |
| US-B-006 | API response caching layer | backend | 1 | High | PENDING |
| US-B-007 | Rate limiting on API routes | backend | 1 | High | PENDING |
| US-B-008 | Queue-based sharded job generation cron | backend | 2 | Critical | PENDING |
| US-B-009 | Async 202 for bulk job generation | backend | 2 | High | PENDING |
| US-B-010 | Presigned direct-to-storage uploads | backend | 2 | High | PENDING |
| US-B-011 | Server-side timeouts and resilience | backend | 1 | Medium | PENDING |
| US-B-012 | Single-pass auth validation | backend | 1 | High | PENDING |
| US-B-013 | Edge-cache reference data endpoints | backend | 1 | Medium | PENDING |
| US-B-014 | Sparse fieldsets / payload optimization | backend | 1 | Medium | PENDING |
| US-B-015 | Production observability instrumentation | backend | 1 | High | PENDING |
| US-B-016 | Load testing harness and baseline | backend | 2 | High | PENDING |
| US-M-001 | Deduplicate job list fetches on focus | mobile | 0 | Medium | PENDING |
| US-M-002 | Session-aware fetch without getUser | mobile | 0 | Medium | PENDING |
| US-M-003 | Parallelize job detail data loading | mobile | 0 | Medium | PENDING |
| US-M-004 | Cache signed photo URLs client-side | mobile | 1 | Low | PENDING |
| US-D-001 | Composite indexes for admin queries | database | 0 | Medium | PENDING |
| US-D-002 | Company stats counters for dashboard | database | 1 | Medium | PENDING |
| US-D-003 | Denormalize email_confirmed_at on profiles | database | 0 | Critical | PENDING |
| US-D-004 | Supavisor connection pool configuration | database | 1 | High | PENDING |
| US-D-005 | Optimize RLS get_my_company_id helper | database | 1 | Medium | PENDING |
| US-D-006 | Daily job stats rollup table | database | 2 | High | PENDING |

**Total:** 30 user stories · 113 child tasks (all `PENDING`)

## Workflow

1. **Tech refinement** — Review acceptance criteria, estimate, add technical notes to the story file.
2. **Assign** — Master Agent assigns story to specialist; set story + first task to `IN-PROGRESS`.
3. **Develop** — Complete child tasks; mark `DONE` individually.
4. **QA** — QA Specialist validates; mark story `DONE` when all tasks pass.

## Source findings map

Each story references IDs from the performance review (F-*, A-*, B-*, D-*, N-*, S-*, M-*).
