---
name: "/status"
description: Get current team status, work distribution, blockers, and project progress. Shows what each agent is working on and what's blocking progress.
---

# /status

Get the current status of the Caicos development team.

## Usage

```
/status [scope: team|sprint|blockers|all]
```

## Examples

```
/status team

/status sprint

/status blockers

/status all
```

## Status Scopes

### team
Shows current work distribution:
```
📊 TEAM STATUS

NextJS Developer Agent:
  ├─ Current: Admin Dashboard (in progress)
  ├─ Next: Jobs Management Page
  └─ Capacity: 2 tasks remaining

React Native Developer Agent:
  ├─ Current: Service Form (in progress)
  ├─ Next: Daily Jobs List
  └─ Capacity: 2 tasks remaining

QA Specialist Agent:
  ├─ Current: Validating Auth Code
  ├─ Queue: 3 items pending
  └─ Capacity: Available for next

Master Agent:
  ├─ Tasks assigned: 8
  ├─ In progress: 3
  ├─ Completed: 2
  └─ Blocked: 1
```

### sprint
Shows sprint-level progress:
```
🏃 SPRINT PROGRESS

MVP Scope Completion: 35%
├─ Complete: 5 features
├─ In Progress: 3 features
├─ Pending: 14 features
└─ Blocked: 1 feature

Team Velocity: 4 features/week
Burn Down: On track
Days Remaining: 12

Upcoming Milestones:
  ✓ Week 1: Auth + Dashboard (complete)
  ⏳ Week 2: CRUD Operations (in progress)
  📅 Week 3: Service Forms (scheduled)
```

### blockers
Shows what's preventing progress:
```
🚨 BLOCKERS (1 ACTIVE)

BLOCKER 1: Database Schema Finalization
  Blocking: Admin team (Jobs/Properties/Team pages)
  Reason: Missing fields in service_reports table
  Impact: 3 features blocked
  Resolution: Needs DBA review
  Assigned to: Master Agent (escalate)
  Status: In progress (schema review underway)
```

### all
Shows everything:
```
═════════════════════════════════════════
CAICOS TEAM - COMPLETE STATUS REPORT
═════════════════════════════════════════

👥 TEAM DISTRIBUTION
  NextJS Dev: 2 active tasks
  RN Dev: 2 active tasks
  QA: 1 active task + 3 queue
  Master: Coordinating 8 total

📈 SPRINT PROGRESS
  35% complete (5/22 MVP features)
  On track for timeline
  12 days remaining in sprint

⏳ CURRENT WORK
  Service Form (Mobile) - 60% complete
  Admin Dashboard (Web) - 40% complete
  Auth Code QA - In progress
  Jobs Schema - Design phase

🚨 BLOCKERS
  Database schema refinement needed
  Impacts: 3 features
  Status: In progress

✅ COMPLETED (THIS SPRINT)
  ✓ Authentication system
  ✓ Login/Register screens
  ✓ Technician onboarding flow

🎯 NEXT PRIORITIES
  1. Complete database schema
  2. Finish service form
  3. Start admin CRUD pages
  4. Begin QA validation phase

═════════════════════════════════════════
```

## Response Time

Status updates are typically real-time or very recent, based on:
- Last assignment: Master Agent tracking
- Current work: Developer Agent status
- Blockers: Explicit blocker list
- Completions: QA validation results

## Using Status Information

**To understand progress:**
```
/status sprint
```

**To find out what someone is working on:**
```
/status team
```

**To identify what's blocking progress:**
```
/status blockers
```

**To get full picture:**
```
/status all
```

## Next Steps Based on Status

```
If on track:
  → Continue with next priority
  → Assign next feature: /assign-task

If blocked:
  → Identify blocker: /status blockers
  → Escalate to Master Agent
  → Work on unblocked items meanwhile

If ahead of schedule:
  → Pull from backlog
  → Start Phase 2 features (if approved)
  → Technical debt/refactoring
```
