# Admin Portal — Technician Visit Form Sync

**Created:** 2026-06-18  
**Source:** WhatsApp route analysis (RUTA 1, 3, 4, 7, 24) + `technician-app` visit screen refactor  
**Primary agent:** NextJS Developer  
**Related mobile work:** `technician-app/app/(app)/job/[id].tsx`, `technician-app/lib/visitForm.ts`  
**Related migrations:**  
- `supabase/migrations/20260618180000_service_report_issue_category.sql` (superseded)  
- `supabase/migrations/20260618200000_service_report_issue_categories_array.sql`  

## Context

The technician visit form was redesigned to match WhatsApp workflows:

- **Photos first** — unlimited photos per visit (`Take Photo` / `From Gallery`); at least one required
- **Issue Found** — multiselect categories stored in `issue_categories TEXT[]`
- **Visit Extras** — optional toggles: filter serviced, extra vacuum, low water, salt/chemicals (`other_chemicals`)
- **Equipment / Chemical readings** — optional, collapsed in mobile app
- **Follow-up** — auto-flagged when issues, low water, or manual toggle

The admin portal currently loads **photos only** on job detail (`GET /api/jobs/[id]`) and does **not** read or display report fields from `cadenza_service_reports`.

---

## Task backlog

| ID | Date | Description | Status |
|----|------|-------------|--------|
| ADM-2026-06-18-001 | 2026-06-18 | Apply Supabase migrations for `issue_categories` on remote (run `supabase db push` or deploy migrations) | DONE |
| ADM-2026-06-18-002 | 2026-06-18 | Extend `GET /api/jobs/[id]` to return the latest `cadenza_service_reports` row: `issue_categories`, `notes`, `follow_up_needed`, `follow_up_notes`, `other_chemicals`, `cleaned_filter`, `vacuumed`, equipment flags (`pump_ok`, `filter_ok`, `heater_ok`, `cleaner_ok`), and chemical reading fields | DONE |
| ADM-2026-06-18-003 | 2026-06-18 | Job detail page (`jobs/[id]/page.tsx`) — add **Service Report** card showing multiselect issue badges (motor, filter, circulation, timer, chemistry, other) | DONE |
| ADM-2026-06-18-004 | 2026-06-18 | Job detail page — show **Visit Extras** when set: filter serviced, extra vacuum; show **Salt / chemicals** from `other_chemicals` | DONE |
| ADM-2026-06-18-005 | 2026-06-18 | Job detail page — show technician **service notes**, **follow-up needed** flag, and **follow-up notes** | DONE |
| ADM-2026-06-18-006 | 2026-06-18 | Job detail page — improve photo gallery for multiple images (grid, count, lightbox); remove reliance on `photo_type` labels (mobile stores all as `general`) | DONE |
| ADM-2026-06-18-007 | 2026-06-18 | Add i18n strings (`messages/en.json`, `messages/es.json`) for issue categories, visit extras, and follow-up labels | DONE |
| ADM-2026-06-18-008 | 2026-06-18 | Reports or jobs list — add filter/view for visits with `follow_up_needed = true` or non-empty `issue_categories` (office follow-up queue) | DONE |
| ADM-2026-06-18-009 | 2026-06-18 | Optional: collapsible **Chemical readings** and **Equipment status** on job detail when report data exists | DONE |
| ADM-2026-06-18-010 | 2026-06-18 | Future: **Filter-day** flag on scheduled jobs so office can require filter photos on specific route days (Filipo/Luis workflow); needs schema + route schedule UI | PENDING |

---

## Out of scope (mobile-only for now)

- Do **not** rebuild the old six task toggles (skim, brush, baskets, etc.) in admin — mobile assumes standard service unless extras are flagged
- Do **not** require separate pool vs filter photo types in admin — technicians add photos freely

---

## Definition of done (epic)

- [x] Migrations applied to production Supabase
- [x] Job detail shows full service report aligned with technician visit form
- [x] Office can see multiselect issues and follow-ups without reading WhatsApp
- [x] i18n complete for en/es
- [x] `npm run build` passes in `admin-portal/`

---

## Status values

| Status | Meaning |
|--------|---------|
| `PENDING` | Not started |
| `IN-PROGRESS` | Actively being developed |
| `DONE` | Implemented and verified |

Update this file when tasks move forward.
