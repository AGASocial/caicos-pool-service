# Mobile User Stories

Performance & scalability backlog for the **Expo technician app**.  
Default agent: **React Native Developer**

---

## US-M-001 — Deduplicate job list fetches on tab focus

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Medium |
| **Phase** | 0 |
| **Source findings** | Mobile assessment |

### Description

As a **technician**, I want my job list to load once when I open the app so that switching tabs does not trigger duplicate Supabase queries.

Today `app/(app)/(tabs)/index.tsx` fetches on both `useEffect` mount and `useFocusEffect` every time the tab gains focus.

### Acceptance criteria

- [ ] Tab focus does not refetch if data is fresh (< 30s or configurable)
- [ ] Pull-to-refresh still forces refetch
- [ ] No duplicate network calls on tab switch in dev tools

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-M-001-1 | Remove redundant useFocusEffect fetch when useEffect already loaded | PENDING |
| T-M-001-2 | Use staleTime or lastFetchedAt guard before refetch on focus | PENDING |
| T-M-001-3 | Keep pull-to-refresh as explicit user-triggered refetch | PENDING |

### Tech refinement notes

Consider Zustand store or TanStack Query if adopted in mobile app later.

---

## US-M-002 — Session-aware fetch without getUser per request

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Medium |
| **Phase** | 0 |
| **Source findings** | Mobile assessment |

### Description

As a **technician**, I want job queries to use my cached session so that every list load does not add an extra Auth round-trip.

`fetchJobs` calls `supabase.auth.getUser()` before every query.

### Acceptance criteria

- [ ] User id sourced from auth state listener, not getUser per fetch
- [ ] Signed-out state handled without extra round-trip
- [ ] No regression when session refreshes

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-M-002-1 | Subscribe to supabase.auth.onAuthStateChange for session user id | PENDING |
| T-M-002-2 | Replace getUser() in fetchJobs with cached session user id | PENDING |
| T-M-002-3 | Handle signed-out state without extra round-trip | PENDING |

---

## US-M-003 — Parallelize job detail data loading

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Medium |
| **Phase** | 0 |
| **Source findings** | Mobile assessment |

### Description

As a **technician opening a job**, I want job details, service report, and photos to load as fast as possible so that I can start service quickly.

Current waterfall: job → report → photos → signed URLs (sequential effects).

### Acceptance criteria

- [ ] Job + report fetched in parallel where job id is known
- [ ] Progressive UI: customer info visible before photos load
- [ ] Measured reduction in time-to-interactive vs baseline

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-M-003-1 | Combine job + report fetch into single Promise.all where possible | PENDING |
| T-M-003-2 | Defer photo signed URL batch until report id is known | PENDING |
| T-M-003-3 | Show progressive loading states per section | PENDING |

---

## US-M-004 — Cache signed photo URLs client-side

| Field | Value |
|-------|-------|
| **Status** | `PENDING` |
| **Priority** | Low |
| **Phase** | 1 |
| **Source findings** | N-3 |

### Description

As a **technician revisiting a job**, I want photo URLs reused until near expiry so that the app does not regenerate signed URLs on every screen open.

Signed URLs expire in 3600s; regenerated on each job detail load today.

### Acceptance criteria

- [ ] URLs cached with expiry timestamp
- [ ] Refresh only when within 5 min of expiry
- [ ] Cache invalidated after new photo upload

### Child tasks

| ID | Task | Status |
|----|------|--------|
| T-M-004-1 | Store signed URLs with expiry timestamp in component or Zustand | PENDING |
| T-M-004-2 | Refresh URLs only when within 5min of expiry | PENDING |
| T-M-004-3 | Verify no stale URL display after report update | PENDING |
