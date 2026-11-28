# KAN-153 — Decision log

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-153 |
| **Status** | Approved |

## ADR-001: Reuse service-report follow-up rows plus voice notes, no new open-issues table

### Context

The office already has a follow-up queue built on `cadenza_service_reports.follow_up_status` and issue categories. KAN-165 also requires problem voice notes to appear on this list.

### Options

1. New `cadenza_open_issues` table fed by reports and voice notes.
2. Keep reports as the source of truth and ignore voice notes until a later ticket.
3. Treat an open issue as the union of open follow-up reports and unresolved problem voice notes, with shared review columns and a single review RPC.

### Decision

Option 3.

### Consequences

- Less migration risk and the existing dashboard/Jobs filter keep working.
- The queue query must also include jobs that only have a voice-note problem.
- Two items can exist for one visit (a flagged report and a problem note); they are reviewed independently.

## ADR-002: SECURITY DEFINER RPC instead of broadening UPDATE RLS

### Context

Technicians can only update reports they authored. Office-only policies protect voice-note updates. Carry-forward requires a later-job technician (possibly someone else) to change only follow-up/review fields.

### Options

1. Broaden UPDATE policies on reports and voice notes (risky: could allow editing chemistry, transcripts, etc.).
2. Column-level grants / triggers (awkward in Postgres and easy to get wrong).
3. A narrow `review_open_issue` function, `SECURITY DEFINER`, with explicit company/property/role checks and table-qualified columns.

### Decision

Option 3. Also expose `POST /api/open-issues/review` for the portal and E2E.

### Consequences

- Writes are auditable (follow-up action row) and limited to review fields.
- SQL review must catch always-true predicates (qualify `company_id`).
- The function is granted only to `authenticated`.

## ADR-003: Days open is computed, not stored

### Context

The office needs an age column and filters (7+/14+/30+).

### Options

1. Stored generated column, updated by trigger.
2. Compute from `created_at` in the API/UI with the existing local `YYYY-MM-DD` helper.

### Decision

Option 2. Age is a display/filter concern; storing it would drift and requires more backfill.

### Consequences

- Simple additive migration (nullable review columns only).
- Filters and sort happen in the API after computing `days_open` (acceptable for current queue sizes). Revisit if the queue grows large enough to need a SQL expression index.

## ADR-004: Voice-note problems are first-class open issues

### Context

KAN-165 AC-7 says problem notes appear on the KAN-153 list. `getOpenVoiceNoteProblems` currently defaults to the last 7 days and has no resolved flag.

### Options

1. Leave voice notes out and document a follow-up.
2. Include them with a `follow_up_status` (and review columns) and extend the helper to support an unbounded, unresolved query.

### Decision

Option 2. Classification that sets effective category `problem` also sets `follow_up_status = 'open'` when null. A correction to `routine` removes the note from the open list via the category filter. Existing done problem notes are backfilled to `'open'` after a backup table is created.

### Consequences

- KAN-154 can reuse the same helper/unresolved definition.
- The default 7-day window stays available for digest-style callers but must not be used for the office queue or carry-forward.

## ADR-005: Block visit completion until every carry-forward item is answered

### Context

The original failure mode is that issues are never re-checked. A soft reminder is easy to dismiss.

### Decision

The Complete action is blocked with a prompt until each visible prior issue has Yes or No. Unanswered items are not auto-resolved. Office-only resolution on the origin job remains available.

### Consequences

- Slightly stricter technician UX; matches the ticket's "must re-check" intent.
- Completing with zero prior issues is unchanged.

## ADR-006: Age filters are minimum days on the Jobs follow-up list and dashboard uses the same age display

### Context

The ticket asks for an age column and filters on the office follow-up queue.

### Decision

When "Needs follow-up" is on, the Jobs list sorts oldest-first and offers All / 7+ / 14+ / 30+ filters on the oldest issue's `days_open` for that job. The dashboard issue card shows a days-open badge and is also ordered oldest-first. No new standalone queue page.

### Consequences

- Small, focused UI change on screens the office already uses.
- `GET /api/jobs` and dashboard data must share the open-issue definition (reports ∪ voice notes).
