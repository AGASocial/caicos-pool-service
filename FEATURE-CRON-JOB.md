# Cron jobs – Caicos

Cron jobs for cleanup, consistency, and background tasks. Add new items below as you identify them.

---

## 1. Orphan report-photos storage cleanup

**Preferred approach:** When a photo is deleted in the technician app, the app should delete the object from the `report-photos` bucket (using the photo’s `storage_path`) in addition to removing the row from `caicos_report_photos`. That keeps storage clean in the normal case.

**Cron as backstop:** A scheduled job still runs to remove any orphan objects (e.g. after failed in-app deletes, offline edge cases, or other code paths that remove rows without touching storage).

**Problem (if we didn’t delete from app):** Only removing the row would leave the file in Supabase Storage, so storage would grow with orphan files.

**Cron solution:**

1. List objects in the `report-photos` bucket (paginate or list by prefix).
2. Fetch all `storage_path` values from `caicos_report_photos`.
3. Delete from Storage any object whose path is **not** in that set.

**Details:**

- **Bucket:** `report-photos`
- **Table:** `caicos_report_photos` (column: `storage_path`, path relative to bucket)
- **Safety:** Only delete objects that are not referenced in the table; never delete based only on age or pattern without cross-checking the table.
- **Implementation options:**
  - Supabase Edge Function + pg + Storage API, triggered on a schedule (e.g. daily).
  - External cron (e.g. Vercel Cron, GitHub Actions) calling an API route or Edge Function that does the same.

**Scope:** Single bucket and single table; can be extended later to other buckets/tables if needed.

---

## Future items

_Add more cron-solvable tasks here, e.g.:_

- _…_
