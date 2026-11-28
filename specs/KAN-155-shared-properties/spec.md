# KAN-155 — Shared properties and last-service summary

| Field | Value |
|-------|-------|
| **Jira** | https://agasocial.atlassian.net/browse/KAN-155 |
| **Status** | In progress |
| **PR** | _(link when open)_ |

> Privacy: no customer data in this file. Details in Jira.

## Problem

Some properties are visited more than once a week, sometimes by different technicians in the **same company**. The second technician needs a short view of what the first already did (filter cleaning, salt reading) without opening the other technician’s full report flow.

This ticket is **not** about sharing a property or its reports across companies / tenants. Isolation by `company_id` does not change.

## Scope

### In scope

- Office can mark a property as shared (multi-technician / dual visit) in the admin portal.
- On a job for a shared property, the assigned technician sees a last-service summary from the most recent completed visit on that property (another job), including whether the filter was cleaned / backwashed and the salt reading, plus who did it and when.
- The summary is visible on the job card / job detail without entering the other technician’s full report editor.
- New last-service HTTP endpoint(s) that return 401 when unauthenticated and never return another company’s data.

### Non-goals

- Cross-company / cross-tenant property sharing, joint ownership, or any RLS change that lets company A read company B.
- Admin pricing or billing for dual-visit houses.
- Changing route assignment or scheduling rules.
- Auto-detecting which properties are shared (no backfill).
- Showing the last-service card on properties that are not marked shared.

## Requirements

1. Additive `is_shared boolean not null default false` on `cadenza_properties`, with a SQL comment that this means “visited by more than one technician in the same company,” not cross-tenant sharing.
2. Only office roles (`owner`, `admin`, `operations`) may toggle `is_shared`, via the existing property create/update APIs and the property form (en/es). Technicians can read the flag (existing property SELECT is company-scoped) but cannot change it.
3. `GET /api/properties/[id]/last-service` (and/or `GET /api/jobs/[id]/last-service` that resolves the job’s property) requires a session (401 if missing). It returns a compact summary only when the property is in the caller’s company and `is_shared` is true. Otherwise `{ is_shared: false, last_service: null }` or 404 for a foreign/missing property. Never include voice-note transcripts, follow-up notes, customer email, or photos in this payload.
4. Last-service definition: same `company_id` and `property_id`, job `status = 'completed'`, report and job not soft-deleted, not the current job when a job id is provided, newest by `scheduled_date` then `created_at`. Fields: visit date, technician display name (not email), `cleaned_filter`, `backwashed`, `salt_level`, and relevant `service_event_types` (filter cleaning / salt) if present.
5. Technician app job detail shows this summary in a compact card when the property is shared and a prior completed visit exists. Do not send the user into another technician’s report editor to see it.
6. Do not loosen RLS. Existing company-scoped SELECT on reports is enough for reads; any new RPC or query must table-qualify `company_id` and keep the caller’s company filter. No backfill, so no backup table; rollback drops the column and index.

## Acceptance criteria

- [ ] **AC-1:** Office can mark a property shared (and unmark it). The flag persists and is company-scoped. Technicians cannot change it.
- [ ] **AC-2:** On a shared-property job, technician B sees that technician A cleaned the filter and/or recorded salt on the previous completed visit, with date and technician name, without opening A’s full report flow.
- [ ] **AC-3:** The last-service card is omitted (or empty) when the property is not shared, when there is no prior completed visit, or when the only report is the current job.
- [ ] **AC-4:** Unauthenticated calls to the new last-service endpoint return 401. A foreign-company id returns 404 (not another company’s summary).

## Data model & API

### Column

`cadenza_properties.is_shared boolean not null default false`. Partial index optional: `(company_id) where is_shared`. No backfill.

### HTTP

- Extend `GET`/`PUT` `/api/properties` and `/api/properties/[id]` (and the form payload) with `is_shared`.
- `GET /api/properties/[id]/last-service?job_id=optional`
- Response shape (illustrative): `{ is_shared, last_service: { job_id, scheduled_date, technician_name, cleaned_filter, backwashed, salt_level, service_event_types } | null }`

### Technician app

- Job loader reads `is_shared` with the property/job.
- Shared helper builds the card from the last-service payload or an equivalent same-company Supabase query.
- en/es strings.

## Edge cases

- Two visits the same day: pick the latest completed by time/`created_at`.
- Soft-deleted jobs or reports are ignored.
- Schema pending (column missing): fail clearly (no silent empty success for schema errors), similar to SCHEMA_PENDING elsewhere.
- Current job already has a report: still show the *previous* visit, not the in-progress one.
- Technician name missing: show a generic “Technician” label, never an email.

## AC → test traceability

| AC | Test file / name |
|----|------------------|
| AC-1 | unit + Playwright: office can toggle; technician cannot |
| AC-2 | Playwright or API + technician-app unit: last-service shows filter/salt and tech A |
| AC-3 | unit + E2E: not shared / no prior visit / current job only |
| AC-4 | E2E: 401 unauthenticated; foreign company 404 |

## As built

<!-- Fill on close. -->

- **What shipped:** …
- **PR:** …
- **Release PR:** …
- **Jira:** https://agasocial.atlassian.net/browse/KAN-155
- **Vercel production deploy:** …
- **Migration:** …
- **Notes / deltas from this spec:** …
