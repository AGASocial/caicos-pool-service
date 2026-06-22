# Cadenza Backlog — Bugs, Improvements & Chores

Day-to-day work that doesn't belong in the phased performance plan (`plan/manifest.json`).

## Folder structure

```
plan/backlog/
├── README.md           ← You are here
├── INDEX.md            ← Open items at a glance (keep updated)
├── inbox.md            ← Quick capture — paste bugs here
├── TEMPLATE.md         ← Copy when triaging a new item
├── admin/              ← Admin portal items
├── mobile/             ← Technician app items
├── backend/            ← API routes, cron, BFF
├── database/           ← Migrations, RLS, indexes
└── archive/            ← Completed items (optional, by month)
```

## File naming

```
YYYY-MM-DD-{type}-{short-slug}.md
```

| Type prefix | Meaning |
|-------------|---------|
| `bug` | Something broken |
| `imp` | Improvement / enhancement |
| `chore` | Maintenance, deps, cleanup |
| `spike` | Research or prototype |

Example: `2026-06-21-bug-follow-up-filter-reset.md`

## Task ID format

```
{DOMAIN}-{TYPE}-{DATE}-{SEQ}
```

| Domain prefix | Area |
|---------------|------|
| `ADM` | Admin portal |
| `MOB` | Technician app |
| `API` | Backend / API routes |
| `DB` | Database / Supabase |

Example: `ADM-BUG-2026-06-21-001`

## Workflow

1. **Capture** — Paste into `inbox.md` (one line per item is fine).
2. **Triage** — Create a dated file from `TEMPLATE.md`, assign agent + priority, add row to `INDEX.md`.
3. **Work** — Status: `PENDING` → `IN-PROGRESS` → `DONE` (same as performance plan).
4. **Close** — Mark tasks done in the file, remove from `INDEX.md` open section (or move file to `archive/YYYY-MM/`).

## When to use which system

| Situation | Use |
|-----------|-----|
| Single bug or small fix | One dated file, 1–3 tasks |
| Multi-task feature sync | Dated epic file (see `admin/2026-06-18-technician-visit-admin-sync.md`) |
| Large phased initiative with dependencies | `plan/manifest.json` |
| "I noticed something" | `inbox.md` until triaged |

## Agent assignment

| Folder | Primary agent |
|--------|---------------|
| `admin/` | NextJS Developer |
| `backend/` | NextJS Developer |
| `database/` | NextJS Developer + QA |
| `mobile/` | React Native Developer |

## Invoke agents

```
Triage the items in plan/backlog/inbox.md
```

```
Work the next open item from plan/backlog/INDEX.md
```

```
You are the Master Agent. What's next in plan/backlog/INDEX.md?
```

```
Implement ADM-BUG-2026-06-21-001 from plan/backlog/admin/2026-06-21-bug-example.md
```

## Status values

| Status | Meaning |
|--------|---------|
| `PENDING` | Not started |
| `IN-PROGRESS` | Actively being developed |
| `DONE` | Implemented and verified |

Update the item file **and** `INDEX.md` when status changes.
