---
name: performance-qa
description: Validates Cadenza plan story implementations — acceptance criteria, lint/build, RLS security, and load testing (US-B-016). Use when QA-validating plan tasks or before marking stories DONE.
---

# Performance QA Specialist

Validate plan story implementations before marking `DONE`.

## When to run

- After all child tasks for a story are implemented
- Before updating story status to `DONE` in manifest
- US-B-016 is QA-owned end-to-end

## Validation checklist

### Code quality

- [ ] TypeScript strict — no new `any` without justification
- [ ] No hardcoded secrets or credentials
- [ ] Lint clean in affected app

### Build verification

| App changed | Commands |
|-------------|----------|
| `admin-portal` | `npm run lint` && `npm run build` |
| `technician-app` | `npm run lint` (and build if available) |

Report **FAIL** on first error with file, line, and severity.

### Acceptance criteria

Read the story's `USER-STORIES.md` section. Verify each criterion against the implementation. Check off criteria only when verified.

### RLS / security (database and API stories)

- [ ] Queries scoped by `company_id`
- [ ] No service-role bypass in user-facing routes
- [ ] Migrations preserve or strengthen RLS
- [ ] Rate limits return 429, not 500
- [ ] Cache headers don't leak user-specific data (US-B-013)

### Performance-specific checks

| Story type | Verify |
|------------|--------|
| Pagination (US-B-001) | Default limit 50; cursor works across pages |
| N+1 fix (US-B-005) | No per-user Auth Admin loop in team endpoint |
| RSC (US-F-001) | Initial HTML contains data; no post-hydration waterfall |
| React Query (US-F-002) | Duplicate calls deduplicated on navigation |
| Mobile dedup (US-M-001) | Tab focus doesn't refetch when data fresh |

### Load testing (US-B-016)

1. Create k6 scripts for: dashboard, jobs list, team, mobile job fetch
2. Run against staging; record p50/p95/p99
3. Document spike/soak scenarios in `plan/` or `docs/`
4. Publish baseline report

## Report format

```markdown
## QA Report — [US-*-###] [title]

**Verdict:** PASS | WARNINGS | FAIL

### Checks
- Lint: [pass/fail]
- Build: [pass/fail]
- Acceptance criteria: [N/M met]
- RLS: [pass/fail/n/a]

### Blockers (if FAIL)
- [CRITICAL] ...

### Warnings (if any)
- [MEDIUM] ...
```

## On FAIL

1. Report blockers to implementing agent (do not mark story DONE)
2. Re-validate after fixes
3. Escalate to Master Agent if CRITICAL persists after one fix cycle

## On PASS

1. Check off acceptance criteria in USER-STORIES.md
2. Set story + all tasks to `DONE` in manifest.json and USER-STORIES.md
3. Notify orchestrator for next story assignment

## References

- `plan/agents/qa-specialist.md`
- `docs/specs/FEATURE-ADMIN-PORTAL.md`
- `docs/specs/FEATURE-TECHNICIAN-APP.md`
