# KAN-153 — Open-issue carry-forward on the next visit

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-153 |
| **Status** | Approved |
| **PR** | _(link when open)_ |

> Privacy: no customer data in this file. Details in Jira.

## Problem

Open issues found on a visit (equipment problems, chemistry exceptions, and similar) are recorded once and then dropped. The technician who returns to the same property does not see them, so they are not re-checked, the office queue has no sense of how long they have been open, and follow-up work is lost. This ticket carries those open issues onto the next scheduled visit and shows their age in the office queue.

## Scope

### In scope

- Surface prior **open issues for the same property** on the next scheduled visit in the technician app (list card badge + visit screen with Resolved? Yes/No).
- Persist the technician's Yes/No so the office follow-up queue updates (resolved items leave the queue; "still open" items stay and record a review).
- Show **days open** (age) in the office issue queue (dashboard card and Jobs "Needs follow-up" list), with age column, sort, and minimum-age filters.
- Include **voice-note problems** (effective `category = 'problem'`) in the same open-issue list, using the existing `getOpenVoiceNoteProblems` helper (extended as needed). KAN-165 already reserved this hook.
- Additive migration + rollback; technician review goes through a tightly scoped `SECURITY DEFINER` RPC (technicians cannot today update another technician's report, and only office can update voice notes).
- Unit tests mapped to each AC, plus a Playwright E2E against a temporary `qa-billing-*` tenant (Development only).

### Non-goals

- Monday digest of open issues (KAN-154).
- An AI agent that notifies technicians (later phase).
- Direct customer messaging from the app (explicitly out of scope).
- Changing how a technician flags a **new** issue on the current visit (existing report fields stay as they are).
- Automatic emails or any message to real customers.
- Vercel production env var changes.

## Requirements

1. An **open issue** is either:
   - a service report with `follow_up_status = 'open'` and (`follow_up_needed` or a non-empty `issue_categories` array), or
   - a voice note with effective `category = 'problem'`, `status = 'done'`, and `follow_up_status` distinct from `'resolved'`.
2. On a later job for the **same property**, the technician app lists those open issues (origin job ≠ current job) with a short summary and **Resolved? Yes / No**. The today's-jobs list card shows a badge when the property has at least one such issue.
3. **Yes** sets the source record's `follow_up_status` to `'resolved'` and writes a follow-up action (`resolved`) on the review job. **No** leaves the issue open, records `last_reviewed_at` / `last_reviewed_job_id` / `last_reviewed_by`, and writes a follow-up action (`still_open`).
4. Completing the visit while any carry-forward item is unanswered prompts the technician to answer first (blocking alert). Leaving them unanswered must not corrupt data; unanswered items stay open.
5. The office queue (dashboard "Jobs with issues" and Jobs filtered by "Needs follow-up") includes jobs that have either kind of open issue, shows **days open** for the oldest issue on that job/property grouping, defaults to oldest-first when the follow-up filter is on, and offers minimum-age filters: All, 7+, 14+, 30+ days.
6. Days open is the whole number of calendar days between the source record's `created_at` date (local `YYYY-MM-DD`, same helper as the rest of the portal) and today. A same-day issue shows `0`.
7. Office staff can still resolve issues from the existing job follow-up UI; resolving a report does not auto-resolve a distinct voice-note problem on the same job (and vice versa). The office UI can resolve each source independently.
8. Company scoping and RLS stay intact. Unauthenticated calls to new API routes return 401. No customer PII is logged. Seed data is only created in `qa-billing-*` tenants and is cleaned up after tests.

## Acceptance criteria

- [ ] **AC-1:** After an open issue is recorded on a property, the next scheduled visit for that property in the technician app shows the issue with Resolved? Yes/No. The today's-jobs list card shows a visible badge when prior open issues exist.
- [ ] **AC-2:** Answering **Yes** marks that issue resolved and removes it from the office follow-up queue. Answering **No** keeps it in the queue and records a "still open" review (timestamp + review job).
- [ ] **AC-3:** The office issue queue (dashboard and Jobs "Needs follow-up") shows days open for open items, can be filtered by minimum age (7 / 14 / 30 days), and sorts oldest-first when the follow-up filter is on.
- [ ] **AC-4:** Voice-note problems (effective category `problem`, not resolved) appear in the same carry-forward list and office queue, including their age. Correcting a note from problem to routine removes it from the open list without requiring a review.
- [ ] **AC-5:** A technician assigned to the later job can review an issue originally recorded by a different technician on that property. They cannot review an issue on a different property or a different company. Office roles can review any issue in their company.
- [ ] **AC-6:** New/changed API routes return 401 when unauthenticated, never leak another company's issues, and do not send customer email.
- [ ] **AC-7:** Completing a visit is blocked with a prompt until every visible carry-forward item has Yes or No.
- [ ] **AC-8:** Additive migration is reversible; backfilled voice-note rows are copied to a `_backup_kan153_*` table first. Existing open service-report follow-ups keep working without a required backfill of new required columns.

## Data model & API

### Additive columns

**`cadenza_service_reports`**

- `last_reviewed_at timestamptz`
- `last_reviewed_job_id uuid` (FK to `cadenza_service_jobs`, ON DELETE SET NULL)
- `last_reviewed_by uuid` (FK to `cadenza_profiles`, ON DELETE SET NULL)

Days open is computed from `created_at`; no new "opened at" column.

**`cadenza_job_voice_notes`**

- `follow_up_status text` CHECK (`'open'` | `'resolved'`) — nullable (routine / unclassified notes stay NULL)
- `last_reviewed_at`, `last_reviewed_job_id`, `last_reviewed_by` (same shape as reports)

Backfill (after backup): `follow_up_status = 'open'` where `category = 'problem'` AND `status = 'done'` AND `follow_up_status IS NULL`.

**`cadenza_job_follow_up_actions.action_type`**

- Extend the CHECK constraint to include `'still_open'` (keep existing `'note' | 'email_sent' | 'resolved' | 'call'`).

### RPC `review_open_issue`

```
review_open_issue(
  p_source text,            -- 'service_report' | 'voice_note'
  p_id uuid,
  p_review_job_id uuid,
  p_resolved boolean,
  p_note text default null
) returns jsonb
```

`SECURITY DEFINER`, `SET search_path = public`. All table/column references must be table-qualified to avoid the ambiguous `company_id` RLS bug. Granted to `authenticated` only.

Preconditions:

- Caller is authenticated.
- Review job exists, is not deleted, and belongs to the caller's company.
- Caller is office (`owner`/`admin`/`operations`) **or** `technician_id` of the review job is `auth.uid()`.
- The issue belongs to the same company and the same property as the review job, is currently open, and the origin job is **not** the review job (carry-forward only; office can still resolve from the existing follow-up card on the origin job).

Effects: update the source row as in Requirements §3; insert a follow-up action on the **review** job (`action_type` `resolved` or `still_open`, `metadata` includes `source`, `source_id`, `origin_job_id`).

### API (admin-portal)

- `GET /api/open-issues` — office queue: open issues for the caller's company with `days_open`, source, property, origin job, summary, optional `min_days` query param. 401 unauthenticated.
- `GET /api/jobs/:id/open-issues` — open issues to carry onto this job (same property, origin ≠ this job). Available to office and to the assigned technician. 401 unauthenticated.
- `POST /api/open-issues/review` — body `{ source, id, review_job_id, resolved, note? }`; calls the RPC. 401 unauthenticated. Office or assigned technician.

The Jobs list API (`GET /api/jobs?needs_follow_up=true`) must include jobs whose only open issue is a voice-note problem, and when the follow-up filter is on it returns `days_open` (max/oldest on that job) and supports `min_days`.

Dashboard server data uses the same open-issue definition and attaches `days_open`.

### Domain modules

- Extend `admin-portal/src/lib/follow-up-jobs.ts` (and tests) with `daysOpen(openedAt, now)`, open-issue typing, and queue helpers.
- Extend `getOpenVoiceNoteProblems` so callers can omit the default 7-day window and exclude resolved notes (`follow_up_status IS DISTINCT FROM 'resolved'`). Carry-forward and the office queue use the unbounded form.
- Classification/correction paths that set effective `category = 'problem'` should set `follow_up_status = 'open'` when it is null; changing the effective category to `routine` drops the note from the open list (query is driven by effective category).

### Technician app

- Job list: batch-load open-issue counts/summaries for the listed jobs' properties and show a badge + short label on the card.
- Job detail: a "Previous open issues" section (i18n en + es) above the current-visit report, Yes/No per item, persist via `supabase.rpc('review_open_issue', …)` (or the POST route if a bearer call is already convenient). Block "Complete" until all are answered (AC-7).

## Edge cases

- No later job is scheduled: the issue stays in the office queue and accrues age; it appears automatically when a later job is created.
- Several open issues (mixed reports and voice notes) on one property: all appear; each is answered independently.
- Same property, same calendar day, a later job: still counts as a later job if `id` ≠ origin job.
- Soft-deleted reports, jobs, or voice notes are excluded.
- A report with `follow_up_status = 'resolved'` or empty categories and `follow_up_needed` false is not an open issue.
- Company B must never see company A's issues (API + RPC).
- Rollout: API/RPC should fail clearly if the migration is not applied yet (no silent empty success that hides a schema error from office staff — match KAN-152's rollout-safe posture where practical).
- Voice notes still processing (`status != 'done'`) are not open issues yet.

## AC → test traceability

| AC | Test file / name |
|----|------------------|
| AC-1 | `technician-app` unit tests for the carry-forward section/list badge helpers (if extracted); Playwright E2E seeds a past open issue + later job and checks the office-visible effects; job-detail query helper tests in admin-portal |
| AC-2 | Jest: review helper / API route tests for yes → resolved (leaves queue) and no → still open + last_reviewed_*; E2E: POST review as the later-job technician, then queue updates |
| AC-3 | Jest: `daysOpen` + min-days filter + oldest-first sort; E2E: dashboard and `/jobs?needs_follow_up=1` show age, 7+/14+/30+ filters hide newer items |
| AC-4 | Jest: extended `getOpenVoiceNoteProblems` (unbounded, excludes resolved, ignores routine); E2E: a problem voice note appears with age and disappears after category correction to routine **or** after Yes |
| AC-5 | Jest/API: assigned tech on later job can review another tech's report; different property / other company / unassigned tech is rejected; office allowed |
| AC-6 | E2E/API: unauthenticated GET `/api/open-issues` and POST `/api/open-issues/review` return 401; other-company rows are absent |
| AC-7 | Unit test of the "all answered?" guard used by the complete-visit action |
| AC-8 | Migration + rollback SQL reviewed in PR; backup table created before voice-note backfill (applied in the shared DB as documented in As built) |

## As built

<!-- Fill on close. -->

- **What shipped:** …
- **PR:** …
- **Release PR:** …
- **Jira:** https://agasocial.atlassian.net/browse/KAN-153
- **Vercel production deploy:** …
- **Notes / deltas from this spec:** …
