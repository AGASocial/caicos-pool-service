# React Native Developer — Plan Queue

**Skill:** `mobile-performance`  
**Rule:** `.cursor/rules/cadenza-react-native-developer.mdc`

## Codebase

- `technician-app/**` only

**Do not edit:** `admin-portal/**`, `supabase/migrations/**`

## Stories owned (4)

From `plan/mobile/USER-STORIES.md`:

| ID | Title | Phase | Priority |
|----|-------|-------|----------|
| US-M-001 | Deduplicate job list fetches on focus | 0 | Medium |
| US-M-002 | Session-aware fetch without getUser | 0 | Medium |
| US-M-003 | Parallelize job detail loading | 0 | Medium |
| US-M-004 | Cache signed photo URLs client-side | 1 | Low |

## Can run in parallel with

Phase 0 web/database work — no `dependsOn` conflicts with US-F-* or US-B-*.

## Invoke

```
You are the React Native Developer. Implement US-M-001 from plan/manifest.json.
Load mobile-performance skill.
```

## Done criteria

- All child tasks `DONE` in manifest
- Lint passes in technician-app
- QA PASS before story marked DONE
