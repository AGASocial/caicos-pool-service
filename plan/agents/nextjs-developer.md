# NextJS Developer — Plan Queue

**Skills:** `nextjs-performance` · `database-migrations` (for US-D-*)  
**Rule:** `.cursor/rules/cadenza-nextjs-developer.mdc`

## Codebase

- `admin-portal/**` — pages, components, API routes
- `supabase/migrations/**` — database stories (US-D-*)

**Do not edit:** `technician-app/**`

## Stories owned (27)

### Frontend — `plan/frontend/USER-STORIES.md`

| ID | Title | Phase | Priority |
|----|-------|-------|----------|
| US-F-001 | Migrate read-heavy pages to RSC | 1 | Critical |
| US-F-002 | Standardize TanStack Query | 0 | High |
| US-F-003 | Reduce layout shell API fan-out | 0 | High |
| US-F-004 | Code-split heavy routes | 1 | Medium |
| US-F-005 | Eliminate form page waterfalls | 0 | Medium |
| US-F-006 | Client fetch utilities | 0 | Medium |

### Backend — `plan/backend/USER-STORIES.md`

| ID | Title | Phase | Priority |
|----|-------|-------|----------|
| US-B-001 | Cursor pagination | 0 | Critical |
| US-B-002 | SQL day-of-week filter | 0 | High |
| US-B-003 | SQL anti-join unassigned properties | 0 | High |
| US-B-004 | SQL aggregation reports | 1 | High |
| US-B-005 | Fix team N+1 (needs US-D-003) | 0 | Critical |
| US-B-006 | API response caching | 1 | High |
| US-B-007 | Rate limiting | 1 | High |
| US-B-008 | Queue sharded cron (needs US-D-006) | 2 | Critical |
| US-B-009 | Async 202 bulk jobs (needs US-B-008) | 2 | High |
| US-B-010 | Presigned uploads | 2 | High |
| US-B-011 | Server timeouts | 1 | Medium |
| US-B-012 | Single-pass auth | 1 | High |
| US-B-013 | Edge-cache reference data | 1 | Medium |
| US-B-014 | Sparse fieldsets | 1 | Medium |
| US-B-015 | Observability | 1 | High |

### Database — `plan/database/USER-STORIES.md`

| ID | Title | Phase | Priority |
|----|-------|-------|----------|
| US-D-001 | Composite indexes | 0 | Medium |
| US-D-002 | Company stats counters | 1 | Medium |
| US-D-003 | Denormalize email_confirmed_at | 0 | Critical |
| US-D-004 | Supavisor pool config | 1 | High |
| US-D-005 | Optimize RLS helper | 1 | Medium |
| US-D-006 | Daily job stats rollup | 2 | High |

## Cross-cutting handoffs (same agent, multiple surfaces)

- **US-B-001** — T-B-001-5 updates frontend list UI
- **US-B-009** — T-B-009-3 updates route detail poll UI
- **US-B-010** — T-B-010-3 updates admin upload components

## Invoke

```
You are the NextJS Developer. Implement US-D-003 from plan/manifest.json.
Load nextjs-performance and database-migrations skills.
```

## Done criteria

- All child tasks `DONE` in manifest
- `npm run lint` + `npm run build` pass in admin-portal
- QA PASS before story marked DONE
