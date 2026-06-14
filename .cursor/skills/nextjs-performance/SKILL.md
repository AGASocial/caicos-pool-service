---
name: nextjs-performance
description: Implements Cadenza admin-portal and API performance stories (US-F-*, US-B-*) from plan/manifest.json. Covers RSC, TanStack Query, API routes, caching, rate limits, and cron. Use when working on admin-portal or Next.js API performance tasks.
---

# NextJS Performance Developer

Implement frontend and backend performance stories for the admin portal.

## Scope

| Owns | Does not touch |
|------|----------------|
| `admin-portal/**` | `technician-app/**` |
| `admin-portal/app/api/**` | Mobile-specific optimizations (US-M-*) |

Database migrations for US-D-*: load `database-migrations` skill alongside this one.

## Before starting

1. Read assigned story in `plan/manifest.json` and `plan/{frontend,backend}/USER-STORIES.md`
2. Note `sourceFindings` for context
3. Set story + current task to `IN-PROGRESS` in manifest and USER-STORIES.md

## Codebase patterns

- **App Router** — prefer RSC for read-heavy pages; client islands for interactivity
- **Data layer** — TanStack Query with shared query keys (`lib/` hooks pattern from `team.ts`, `billing-queries.ts`)
- **API routes** — `createRouteClient` / server Supabase; always RLS-scoped by `company_id`
- **Auth** — never bypass multi-tenant rules; validate session in route handlers

## Story-type guidance

### Frontend (US-F-*)

| Story | Key approach |
|-------|--------------|
| US-F-001 | Server fetch in page.tsx; extract interactive parts to `'use client'` islands |
| US-F-002 | Shared `queryKeys` module; `useJobs`, `useProperties`, `useRoutes` hooks |
| US-F-003 | React Query for auth/security/billing with `staleTime`; remove pathname-driven refetch |
| US-F-004 | `next/dynamic` for Stripe/billing and legacy routes |
| US-F-005 | `Promise.all` for parallel form data loads |
| US-F-006 | `lib/api-fetch.ts` with 10s AbortSignal timeout |

### Backend (US-B-*)

| Story | Key approach |
|-------|--------------|
| US-B-001 | Cursor pagination: `limit`, `cursor`, `hasMore`, `nextCursor` |
| US-B-002 | `EXTRACT(DOW FROM scheduled_date)` in SQL, not Node filter |
| US-B-003 | `NOT EXISTS` or `LEFT JOIN ... IS NULL` anti-join |
| US-B-004 | `GROUP BY` aggregation; preserve response shape |
| US-B-005 | Read `email_confirmed_at` from `cadenza_profiles` (requires US-D-003) |
| US-B-006 | Vercel KV or `unstable_cache`; company-scoped keys |
| US-B-007 | Rate limit by `user.id`; 429 + `Retry-After` |
| US-B-008 | Queue per-company shards; idempotent upsert |
| US-B-009 | 202 + poll endpoint for bulk job generation |
| US-B-010 | Presigned upload URLs; direct-to-storage |
| US-B-011 | 10s Supabase fetch timeout in `supabase-server.ts` |
| US-B-012 | Reduce redundant `getUser` via middleware claims |
| US-B-013 | `Cache-Control: s-maxage=3600` on reference data |
| US-B-014 | `fields=` param; composite `/api/jobs/form-data` |
| US-B-015 | Request duration logging; Vercel Observability |

## Task completion

For each child task:

1. Implement the change
2. Mark task `DONE` in `manifest.json` and USER-STORIES.md
3. Move to next task

## Definition of done (story)

- [ ] All acceptance criteria checked off in USER-STORIES.md
- [ ] All child tasks `DONE`
- [ ] `npm run lint` passes in `admin-portal`
- [ ] `npm run build` passes in `admin-portal`
- [ ] No RLS bypass; `company_id` scoping intact
- [ ] Handoff tasks completed if story has `handoffs`

## References

- `docs/specs/FEATURE-ADMIN-PORTAL.md` — feature contracts
- `admin-portal/REFERENCE.md` — app patterns
- `plan/agents/nextjs-developer.md` — story queue
