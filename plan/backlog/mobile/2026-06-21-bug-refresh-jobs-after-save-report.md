# Refresh jobs list after saving service report

**Created:** 2026-06-21  
**Type:** bug  
**Priority:** High  
**Agent:** React Native Developer  
**App:** technician-app  
**Source:** User report

## Context

After completing a visit and saving the service report, the technician returns to the jobs list but the UI still shows the old state (job appears pending/in-progress, daily progress bar unchanged).

**Root cause:** `technician-app/app/(app)/(tabs)/index.tsx` only fetches jobs on mount (`useEffect`). `handleComplete()` in `job/[id].tsx` calls `router.back()` after updating job status to `completed`, but the list screen does not refetch. `FOCUS_STALE_MS` is defined in `index.tsx` but not wired to `useFocusEffect`.

**Related flows that may need the same fix:**
- `job/[id]/cant-service.tsx` — sets status to `skipped`, navigates via `router.replace('/(app)/(tabs)')`
- `job/[id].tsx` — `handlePutOnHold()` calls `router.back()` after status change
- `calendar.tsx` — week view may also show stale status after job completion

## Tasks

| ID | Date | Description | Status |
|----|------|-------------|--------|
| MOB-BUG-2026-06-21-001 | 2026-06-21 | Add `useFocusEffect` to jobs list (`(tabs)/index.tsx`) to refetch when screen regains focus (use existing `FOCUS_STALE_MS` or always refetch on focus) | DONE |
| MOB-BUG-2026-06-21-002 | 2026-06-21 | Verify completed job shows "Completed" badge and daily progress updates immediately after save | DONE |
| MOB-BUG-2026-06-21-003 | 2026-06-21 | Apply same refresh pattern to calendar tab if it shows stale status after job completion | DONE |

## Out of scope

- Pull-to-refresh UX changes (already works manually)
- Admin portal job list

## Definition of done

- [x] Save report on job detail → return to jobs list → job shows completed status without manual pull-to-refresh
- [x] Daily progress bar reflects new completion count
- [x] Cant-service (skipped) and put-on-hold flows also refresh the list
- [x] No duplicate fetch storms on every tab switch (respect stale window or debounce)

## Status values

| Status | Meaning |
|--------|---------|
| `PENDING` | Not started |
| `IN-PROGRESS` | Actively being developed |
| `DONE` | Implemented and verified |

Update this file and `INDEX.md` when tasks move forward.
