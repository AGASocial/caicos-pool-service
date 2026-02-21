---
name: "/assign-task"
description: Assign a feature or task to the appropriate Caicos team member. Automatically routes to Master Agent who delegates to the right specialist (NextJS, React Native, or QA).
---

# /assign-task

Delegate a feature or task to the Caicos development team.

## Usage

```
/assign-task [feature description]
```

## Examples

```
/assign-task Build the daily jobs dashboard for technicians

/assign-task Create the admin properties management page with CRUD operations

/assign-task Implement service form with chemical readings and photo capture

/assign-task Validate the authentication code for security compliance
```

## What Happens

1. **Invoke Master Agent Coordinator**
   - Skill loaded: Master Agent coordinates the request

2. **Master Agent validates scope**
   - ✅ MVP feature → Delegate to appropriate agent
   - ❌ Phase 2+ feature → Add to backlog with timeline
   - ⚠️ Unclear → Ask clarifying questions

3. **Assign to specialist**
   - NextJS Developer for: Admin portal pages, web APIs
   - React Native Developer for: Mobile screens, technician features
   - QA Agent for: Code validation, testing

4. **Track assignment**
   - Task gets tracked in Master Agent's worklog
   - Dependencies identified
   - Status monitoring begins

## What Master Agent Looks For

- **Scope**: Is this MVP or Phase 2?
- **Dependencies**: What needs to be done first?
- **Effort**: Is this complex or straightforward?
- **Skills**: Which specialist is best positioned?
- **Blockers**: What could prevent completion?

## Response Example

```
✅ TASK ASSIGNED

Feature: Service Form with Chemical Readings
Scope: MVP ✓
Assigned to: React Native Developer Agent
Dependencies: Job detail screen (ready), Supabase schema (ready)
Estimated effort: 3-4 days
Blockers: None identified

Starting task assignment...
```
