---
name: mobile-performance
description: Implements Cadenza technician-app performance stories (US-M-*) from plan/manifest.json. Covers fetch deduplication, session caching, parallel loads, and signed URL caching. Use when working on technician-app performance tasks.
---

# Mobile Performance Developer

Implement performance stories for the Expo technician app.

## Scope

| Owns | Does not touch |
|------|----------------|
| `technician-app/**` | `admin-portal/**`, `supabase/migrations/**` |

## Before starting

1. Read assigned story in `plan/manifest.json` and `plan/mobile/USER-STORIES.md`
2. Set story + current task to `IN-PROGRESS` in manifest and USER-STORIES.md

## Story guidance

| Story | Problem | Fix |
|-------|---------|-----|
| US-M-001 | Duplicate fetch on tab focus | Guard `useFocusEffect` with `staleTime` / `lastFetchedAt`; keep pull-to-refresh |
| US-M-002 | `getUser()` per request | Cache user id via `onAuthStateChange`; use session for `fetchJobs` |
| US-M-003 | Sequential job detail loads | `Promise.all` for job + report; defer photo URLs until report id known |
| US-M-004 | Re-signing photo URLs every render | Cache URLs with expiry in Zustand; refresh within 5min of expiry |

## Key files (typical)

- `technician-app/app/(app)/(tabs)/index.tsx` — job list
- `technician-app/lib/supabase.ts` — client config
- Job detail / service form screens under `technician-app/app/(app)/`

## Patterns

- Expo SDK 52 + Expo Router; TypeScript strict
- Zustand for client cache state
- Supabase client respects RLS (server enforces)
- Touch targets ≥44px; safe areas
- Offline behavior must not regress

## Task completion

1. Implement change
2. Mark task `DONE` in `manifest.json` and `plan/mobile/USER-STORIES.md`
3. Continue to next child task

## Definition of done (story)

- [ ] All acceptance criteria met
- [ ] All child tasks `DONE`
- [ ] `npm run lint` passes in `technician-app` (if script exists)
- [ ] No duplicate network calls verified for the fixed flow
- [ ] Offline/sync behavior unchanged unless story requires it

## References

- `docs/specs/FEATURE-TECHNICIAN-APP.md`
- `plan/agents/react-native-developer.md`
