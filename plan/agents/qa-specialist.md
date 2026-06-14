# QA Specialist — Plan Validation

**Skill:** `performance-qa`  
**Rule:** `.cursor/rules/cadenza-qa-specialist.mdc`

## Role

Validate every story before it is marked `DONE`. Own US-B-016 (load testing) end-to-end.

## Validates all domains

| Domain | Focus |
|--------|-------|
| frontend | RSC hydration, React Query dedup, bundle size |
| backend | Pagination, SQL filters, rate limits, caching headers |
| mobile | Fetch dedup, session cache, parallel loads |
| database | RLS intact, indexes used, migrations safe |

## Owned story

| ID | Title | Phase | Priority |
|----|-------|-------|----------|
| US-B-016 | Load testing harness and baseline | 2 | High |

## Invoke

```
You are the QA Specialist. Validate US-B-005 against plan/backend/USER-STORIES.md acceptance criteria.
Load performance-qa skill.
```

```
You are the QA Specialist. Implement US-B-016 load testing harness.
```

## Report

Use PASS / WARNINGS / FAIL format from `performance-qa` skill. Only mark story DONE on PASS.

## Pre-commit gate (admin-portal)

Before approving any commit that touches `admin-portal/`, run `npm run build` from `admin-portal/` and confirm it passes. Block sign-off if the build fails.
