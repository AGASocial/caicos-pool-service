# KAN-155 — Decision log

ADR-style entries, chronological.

---

## ADR-001: “Shared property” means same-company multi-technician visits, not cross-tenant sharing

**Status:** Accepted

### Context

The ticket title can be read as sharing a property between companies. The body is about houses visited twice a week by different technicians, and about technician B seeing A’s last filter/salt work. Route assignment and dual-visit billing are explicitly out of scope.

Existing RLS already lets users SELECT reports in their own company and never in another. Changing that would be a data-sharing decision across tenants.

### Options

1. Treat this as cross-company shared properties (new join table, relaxed RLS).
2. Treat this as a same-company flag plus a last-service summary. Do not change cross-tenant isolation.

### Decision

Option 2. If product later wants two companies to share one property, that is a new ticket and must not be guessed here.

### Consequences

- Positive: no tenant-isolation change; matches the DoD.
- Negative / follow-ups: a property cannot be owned or serviced jointly by two companies under this work.

---

## ADR-002: No backfill, no backup table

**Status:** Accepted

### Context

There is no reliable existing signal for “this house is a dual-visit property.” Auto-flagging would be a guess.

### Decision

Default `is_shared` to false. Office opts in per property. Because nothing is backfilled, no `_backup_kan155_*` table is created. Rollback drops the column and index.

### Consequences

- Positive: no accidental flags or backup of customer rows.
- Negative / follow-ups: office must mark properties after launch.

---

## ADR-003: Last-service endpoint returns a compact allow-listed summary, and only when the property is shared

**Status:** Accepted

### Context

Technicians can already SELECT company reports, but the DoD is a short summary without opening the other technician’s full report flow. A wide payload would create a new export surface.

### Decision

The new endpoint (and the mobile card) include only date, technician display name, filter-cleaned / backwashed, salt level, and relevant service event types. If `is_shared` is false, `last_service` is null. Foreign properties 404. Unauthenticated 401.

### Consequences

- Positive: smaller privacy surface; matches the “without opening the full report” DoD.
- Negative / follow-ups: other report fields (chemicals besides salt, notes) are not in this card for v1.
