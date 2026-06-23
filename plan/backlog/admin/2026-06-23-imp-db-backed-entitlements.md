# Database-backed entitlements

**Created:** 2026-06-23  
**Type:** imp  
**Priority:** Medium  
**Agent:** NextJS Developer  
**App:** admin-portal  
**Source:** Admin portal RBAC follow-up after static `lib/entitlements.ts` rollout

## Context

The admin portal now uses a static role → entitlement map in `admin-portal/src/lib/entitlements.ts` with UI gates (`EntitlementGate`, nav filtering) and API checks (`hasEntitlement`, `entitlementError`).

This works for the current four roles (`owner`, `admin`, `operations`, `technician`) but does not support:

- Custom roles per company
- Per-user entitlement overrides
- Granular grants without code deploys (e.g. `TEAM.CREATE`, `REPORT.VIEW`)
- Auditing who changed permissions

## Tasks

| ID | Date | Description | Status |
|----|------|-------------|--------|
| ADM-IMP-2026-06-23-001 | 2026-06-23 | Design schema: `cadenza_roles`, `cadenza_entitlements`, `cadenza_role_entitlements` (or JSON policy per company) with RLS | PENDING |
| ADM-IMP-2026-06-23-002 | 2026-06-23 | Seed default policies from current `ROLE_ENTITLEMENTS` map | PENDING |
| ADM-IMP-2026-06-23-003 | 2026-06-23 | Load entitlements in `/api/auth/session` and cache in TanStack Query | PENDING |
| ADM-IMP-2026-06-23-004 | 2026-06-23 | Replace static `hasEntitlement()` lookups with DB resolver; keep static map as fallback | PENDING |
| ADM-IMP-2026-06-23-005 | 2026-06-23 | Owner settings UI to assign roles / view effective entitlements (Phase 2) | PENDING |
| ADM-IMP-2026-06-23-006 | 2026-06-23 | Tighten Postgres RLS SELECT policies for technicians to match scoped data | PENDING |

## Out of scope

- Billing-plan feature flags (separate from RBAC)
- Technician mobile app permissions (uses same profile.role today)

## Definition of done

- [ ] Entitlements can be resolved from the database for at least the default roles
- [ ] API routes use the same resolver as the client
- [ ] Migration path documented from static map to DB policies
- [ ] QA validates technician cannot bypass UI restrictions via direct API calls

## Status values

| Status | Meaning |
|--------|---------|
| `PENDING` | Not started |
| `IN-PROGRESS` | Actively being developed |
| `DONE` | Implemented and verified |

Update this file and `INDEX.md` when tasks move forward.
