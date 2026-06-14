---
name: Execute Plan Story
aliases: [plan-story, execute-plan, backlog]
description: "Pick and execute the next (or specified) user story from plan/manifest.json. Coordinates Master → Specialist → QA loop with status sync."
---

# Execute Plan Story

Load **plan-orchestrator** skill (`.cursor/skills/plan-orchestrator/SKILL.md`).

## Workflow

1. Read `plan/manifest.json`
2. If user named a story (e.g. `US-D-003`), use that; else pick next eligible PENDING story
3. Verify `dependsOn` stories are `DONE`
4. Assign to agent per story `agent` field
5. Load specialist skill and implement all child tasks
6. Run QA (`performance-qa` skill)
7. Update status in manifest.json + `plan/{domain}/USER-STORIES.md`
8. Report progress; continue to next story if user said "autonomous" or "open card"

## Agent skills

| Agent | Skill |
|-------|-------|
| NextJS Developer | `nextjs-performance` (+ `database-migrations` for US-D-*) |
| React Native Developer | `mobile-performance` |
| QA Specialist | `performance-qa` |

## Status sync

Always update **both** `plan/manifest.json` and the domain `USER-STORIES.md` when changing status.

## Examples

```
/execute-plan-story US-D-003
```

```
Execute the plan backlog — start with Phase 0 critical items.
```

```
You are the Master Agent. Assign the next story and hand off to the right developer.
```

Reference: `plan/README.md`, `plan/agents/`, `AGENTS.md`.
