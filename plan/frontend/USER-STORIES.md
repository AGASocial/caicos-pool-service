# Frontend User Stories

Performance & scalability backlog for the **Next.js admin portal**.  
Default agent: **NextJS Developer**

---

## US-F-001 — Migrate read-heavy pages to React Server Components

| Field | Value |
|-------|-------|
| **Status** | `DONE` |
| **Priority** | Critical |
| **Phase** | 1 |
| **Source findings** | F-1, A-1 |

### Description

As an **admin user**, I want dashboard and list pages to load with data already present so that I see content faster and the app makes fewer round-trips under load.

Today all dashboard pages are `'use client'` with post-mount `fetch('/api/*')`, causing blank screens, hydration waterfalls, and double-hop latency (browser → Vercel → Supabase).

### Acceptance criteria

- [ ] Dashboard, jobs list, and properties list render initial data from the server
- [ ] Interactive filters remain client components (islands)
- [ ] No regression in auth/RLS scoping
- [ ] LCP improves measurably vs CSR baseline

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-F-001-1 | Audit dashboard/jobs/properties/routes pages for RSC candidacy | DONE |
| T-F-001-2 | Create server-side data fetch helpers using createRouteClient | DONE |
| T-F-001-3 | Migrate dashboard page to RSC with client islands for interactivity | DONE |
| T-F-001-4 | Migrate jobs list page to RSC + client filter bar island | DONE |
| T-F-001-5 | Migrate properties list page to RSC | DONE |
| T-F-001-6 | Verify LCP and eliminate post-hydration fetch waterfall on migrated pages | DONE |

### Tech refinement notes

_(Add during refinement)_

---

## US-F-002 — Standardize TanStack Query across admin data layer

| Field | Value |
|-------|-------|
| **Status** | `DONE` |
| **Priority** | High |
| **Phase** | 0 |
| **Source findings** | F-2 |

### Description

As a **developer**, I want a single data-fetching pattern so that duplicate API calls are deduplicated and cache invalidation is consistent across pages.

Only `lib/team.ts` and `lib/billing-queries.ts` use React Query today; jobs, properties, routes use raw `fetch` + `useState`.

### Acceptance criteria

- [ ] Shared query keys for jobs, properties, routes, dashboard
- [ ] Jobs, properties, routes pages use hooks instead of raw fetch
- [ ] Mutations invalidate related queries

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-F-002-1 | Define shared query keys module (jobs, properties, routes, dashboard) | DONE |
| T-F-002-2 | Create useJobs, useProperties, useRoutes hooks mirroring team.ts pattern | DONE |
| T-F-002-3 | Replace raw fetch+useState on jobs page with useJobs | DONE |
| T-F-002-4 | Replace raw fetch on properties and routes pages | DONE |
| T-F-002-5 | Add mutation invalidation for create/update/delete flows | DONE |

---

## US-F-003 — Reduce layout shell API fan-out on navigation

| Field | Value |
|-------|-------|
| **Status** | `DONE` |
| **Priority** | High |
| **Phase** | 0 |
| **Source findings** | F-3 |

### Description

As an **admin user**, I want navigating between pages to feel instant so that the app does not re-fetch session, security, and billing data on every route change.

`LayoutWrapper` currently triggers ~4 API calls per navigation via `useAuth`, `SecurityContext` (on pathname change), and `SessionBillingPrefetch`.

### Acceptance criteria

- [ ] Security check does not run on every pathname change
- [ ] Session and billing data cached with ≥5 min staleTime
- [ ] Measured ≤1 call per resource type per session on navigation

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-F-003-1 | Remove pathname dependency from SecurityContext checkStatus effect | DONE |
| T-F-003-2 | Move useAuth session to React Query with 5min staleTime | DONE |
| T-F-003-3 | Move security check-session to React Query; revalidate on PIN success only | DONE |
| T-F-003-4 | Deduplicate SessionBillingPrefetch with existing billing query hooks | DONE |
| T-F-003-5 | Verify single network call per resource per session on route navigation | DONE |

---

## US-F-004 — Code-split heavy and legacy routes

| Field | Value |
|-------|-------|
| **Status** | `DONE` |
| **Priority** | Medium |
| **Phase** | 1 |
| **Source findings** | F-5 |

### Description

As an **admin user on a slow connection**, I want core pages (jobs, properties) to load minimal JavaScript so that time-to-interactive stays low.

### Acceptance criteria

- [ ] Billing/Stripe loaded via `next/dynamic`
- [ ] Legacy donor-app pages lazy-loaded
- [ ] Initial bundle size reduced ≥15% on core routes

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-F-004-1 | Add next/dynamic for billing pages (Stripe components) | DONE |
| T-F-004-2 | Lazy-load legacy wizard/digital-assets/beneficiaries pages | DONE |
| T-F-004-3 | Remove unused framer-motion dependency if confirmed unused | DONE |
| T-F-004-4 | Measure initial JS bundle size before/after with next build analyze | DONE |

---

## US-F-005 — Eliminate form page API waterfalls

| Field | Value |
|-------|-------|
| **Status** | `DONE` |
| **Priority** | Medium |
| **Phase** | 0 |
| **Source findings** | F-6 |

### Description

As an **admin dispatching a job**, I want the new-job form to load all dropdown data in parallel so that the form is ready in one round-trip, not three sequential ones.

### Acceptance criteria

- [ ] `jobs/new` loads properties, routes, visit-reasons in parallel
- [ ] Route detail initial load uses `Promise.all` for route + unassigned properties

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-F-005-1 | Refactor jobs/new to parallel fetch (Promise.all or composite hook) | DONE |
| T-F-005-2 | Refactor route detail page initial load to parallel fetch | DONE |
| T-F-005-3 | Optional: consume GET /api/jobs/form-data composite endpoint when US-B-014 ready | DONE |

---

## US-F-006 — Client fetch utilities with timeout and abort

| Field | Value |
|-------|-------|
| **Status** | `DONE` |
| **Priority** | Medium |
| **Phase** | 0 |
| **Source findings** | A-7 |

### Description

As a **developer**, I want a shared fetch wrapper with timeouts so that hung requests fail fast and do not block the UI indefinitely.

### Acceptance criteria

- [ ] `lib/api-fetch.ts` with 10s default timeout
- [ ] Used by all React Query queryFns
- [ ] Documented retry alignment with QueryClient

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-F-006-1 | Create lib/api-fetch.ts with 10s AbortSignal timeout wrapper | DONE |
| T-F-006-2 | Replace direct fetch calls in hooks with apiFetch | DONE |
| T-F-006-3 | Document retry policy alignment with QueryClient defaults | DONE |

---

## US-F-007 — Billing UI alignment

| Field | Value |
|-------|-------|
| **Status** | `DONE` |
| **Priority** | High |
| **Phase** | 3 |
| **Depends on** | US-B-017 |
| **Source** | `plan/billing/BILLING-ASSESSMENT.md` |

### Description

As an **admin**, I want the billing dashboard and plans page to show the correct charge (**$14.99 × billed technicians**) and reflect the Standard tier.

### Acceptance criteria

- [ ] Next payment uses subscription `quantity`, not team headcount
- [ ] Plans page shows Standard as featured; yearly toggle hidden when no active yearly plans
- [ ] Quantity passed on plan change PATCH
- [ ] Plans API unit test matches `{ plans }` response shape

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-F-007-1 | Fix next payment calculation on billing dashboard | DONE |
| T-F-007-2 | Plans page Standard badge, yearly toggle, quantity on PATCH | DONE |
| T-F-007-3 | Fix plans route unit test; quantity on subscription API | DONE |
