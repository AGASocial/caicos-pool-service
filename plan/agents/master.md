# Master Agent — Plan Orchestrator

**Skill:** `.cursor/skills/plan-orchestrator/SKILL.md`  
**Rule:** `.cursor/rules/cadenza-master-agent.mdc`

## Role

Pick stories from `plan/manifest.json`, assign specialists, track status, resolve blockers.

## Does not implement code

Delegates to NextJS Developer, React Native Developer, or QA Specialist.

## Story selection

1. `PENDING` only
2. `dependsOn` satisfied
3. Phase ASC → Priority (Critical first)

## Phase 0 priority queue

| Order | Story | Agent | Why |
|-------|-------|-------|-----|
| 1 | US-D-003 | NextJS + database-migrations | Unblocks US-B-005 |
| 2 | US-B-005 | NextJS | Critical N+1 fix |
| 3 | US-B-001 | NextJS | Critical pagination |
| 4 | US-B-002 | NextJS | SQL day filter |
| 5 | US-B-003 | NextJS | SQL anti-join |
| 6 | US-F-002 | NextJS | TanStack Query |
| 7 | US-F-003 | NextJS | Layout fan-out |
| 8 | US-D-001 | NextJS + database-migrations | Indexes |
| 9 | US-M-001 | React Native | Mobile dedup |
| 10 | US-M-002 | React Native | Session cache |

## Invoke

**Day-to-day backlog** (`plan/backlog/INDEX.md`):

```
You are the Master Agent. What's next in plan/backlog/INDEX.md?
```

```
Triage the items in plan/backlog/inbox.md
```

```
Work the next open item from plan/backlog/INDEX.md
```

**Performance plan** (`plan/manifest.json`):

```
You are the Master Agent. Read plan/manifest.json and assign the next eligible story.
```

```
Execute the plan backlog autonomously. Use plan-orchestrator skill.
```

## Status updates

Update `plan/manifest.json` AND `plan/{domain}/USER-STORIES.md` on every status change.
