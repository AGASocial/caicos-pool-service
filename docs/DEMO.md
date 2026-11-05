# Demo company seed

`scripts/demo-seed.ts` creates a fully **fictional** demo tenant for sales demos:

| | |
|---|---|
| Company | `Demo Caicos (demo)` |
| Company id | `de300000-ca1c-4c05-8000-0000000000d0` (hardcoded `DEMO_COMPANY_ID`) |
| Admin login | `demo-admin@cadenzaops.com` |
| Technicians | `demo-tech-NN@example.com` (generated) or `demo-tech-<name-slug>@example.com` (CSV) |
| Plan | company `subscription_tier = 'pro'` + active `plan_pro_month` subscription (provider `test`) for the demo admin |

Default data (no CSV): 30 technicians, 900 pools in Davie, Cooper City, Weston, Plantation,
Southwest Ranches and Fort Lauderdale, one route per technician per weekday (Mon–Fri) with
stops and weekly schedules, and the past 4 weeks of visits: completed jobs with reports and
photos, ~4% skipped with a can't-service reason, ~6% with an open (or resolved) follow-up.
Customer emails use `@example.com`; phones use the fictional `(954) 555-01xx` range.

## Safety

* Every read/write is scoped to `DEMO_COMPANY_ID`; the QA company id is refused. A user is
  only touched if it has no profile yet or its profile already belongs to the demo company.
* Idempotent: re-running reuses existing rows (properties by address+city, routes by
  tech+day+name, stops by route+property, jobs by property+date+route, one report per job).
  Soft-delete tables are never hard-deleted.
* Refuses to run when `CI` is set. **Never add it to CI.**
* No schema changes / migrations.
* Generated passwords are written **only** to the accounts file (default
  `/workspace/secrets/demo_accounts.json`, chmod 600) and never printed. Existing demo users
  whose password is not in that file get a new random one.
* QA cleanups never touch the demo tenant: `scripts/qa-seed-cleanup.ts` is hardcoded to the
  QA company and skips users outside it; `e2e/helpers/billing-qa-cleanup.ts` has
  `PROTECTED_COMPANY_IDS`.
* The Supabase project is shared by develop/preview **and prod**. Before a real run, back up
  company/profile counts and verify afterwards that no other company changed.

## Usage

```bash
npm install            # repo root (supabase-js + tsx)

# Plan only — prints counts, needs no credentials, touches nothing
npx tsx scripts/demo-seed.ts --dry-run --photos-dir ~/demo-photos

# Real run
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service role key> \
npx tsx scripts/demo-seed.ts --photos-dir ~/demo-photos --accounts-out ~/secrets/demo_accounts.json
```

| Option | Default | |
|---|---|---|
| `--dry-run` | off | Print counts only |
| `--from-csv <file>` | — | Customers/routes from CSV (below) instead of generated data |
| `--techs <n>` | 30 | Generated technicians |
| `--pools <n>` | 900 | Generated pools |
| `--weeks <n>` | 4 | Past weeks of visits (1–8) |
| `--photos-dir <dir>` | — (required unless `--no-photos`) | Folder of `.jpg` photos |
| `--no-photos` | off | Skip photos |
| `--accounts-out <file>` | `/workspace/secrets/demo_accounts.json` | Logins file (chmod 600) |
| `--seed <n>` | 20261102 | RNG seed (same seed ⇒ same data) |

### Photos

Photos are **not** committed. Pass a folder of EXIF-stripped JPEGs showing only pools or
equipment (no people, faces, house numbers, addresses, names, phone numbers or plates). They
are uploaded once to `report-photos/<DEMO_COMPANY_ID>/demo-library/` and reused across visits.

## CSV format (`--from-csv`)

UTF-8 (BOM ok), header row required, quoted fields allowed.

| Column | Required | Notes |
|---|---|---|
| `customer_name` | yes | e.g. `"Martinez, Ana"` |
| `address` | yes | street address; address+city must be unique |
| `city` | yes | |
| `zip` | yes | |
| `gate_code` | no | |
| `pool_type` | no | `residential` (default), `commercial`, `spa`, `other` |
| `tech_name` | yes | one technician account is created per distinct name |
| `route_name` | no | default `<tech> – <Day>`; with several days the day is appended |
| `visit_day` | yes | `Mon`..`Sat`; several separated by `\|`, e.g. `Mon\|Thu` |
| `notes` | no | |

Optional extra columns (same as the property import sample): `customer_email`,
`customer_phone`, `state` (default `FL`), `pool_surface`
(`plaster/pebble/tile/vinyl/fiberglass/other`), `equipment_notes`, `is_active`.

Example: [`docs/demo-sample.csv`](demo-sample.csv)

```csv
customer_name,address,city,zip,gate_code,pool_type,tech_name,route_name,visit_day,notes
"Martinez, Ana",3208 S University Dr,Davie,33328,4521,residential,Carlos Rivera,Davie North,Mon|Thu,Dog in yard
```

## Daily live board (`--today`) and Spanish texts (`--refresh-texts`)

```bash
# once, after upgrading the seed: translate existing demo notes/follow-ups/reasons and route day names
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run demo:seed -- --refresh-texts
# every demo day (incl. Saturday) — morning of, and again just before presenting
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run demo:seed -- --today
```

`--today` only touches the demo company: it creates/reuses today's jobs (America/New_York) from the
weekday's routes (Sat → Friday's routes, Sun → Monday's), moves them forward to a deterministic mix of
completed / in_progress / en_route / pending (never backwards), adds reports + reused photos for
completed stops, and closes earlier days' leftover en_route/in_progress jobs. Safe to re-run.
The nightly cron (`/api/cron/generate-route-jobs`) only creates `pending` jobs Mon–Fri for the demo
routes and never sets live statuses, so it can't replace this.

## Technician map (`--geocode`, `--simulate-gps`)

The live dashboard shows a **Technician map** above the live status board (admins/operations only):
one dot per technician (hover for the name; color = their current status: blue en route, amber on site,
green finished, gray pending) and a pin for each of today's stops. It updates over Supabase Realtime
(`cadenza_technician_locations` + `cadenza_service_jobs`, filtered by `company_id`, plus RLS).

Tiles: **MapLibre + OpenFreeMap** by default (free, no key). If `NEXT_PUBLIC_MAPBOX_TOKEN` (a public
`pk.` token, URL-restricted to the portal domains) is set, it switches to Mapbox GL / Streets.

```bash
# once: give the 900 demo properties deterministic Davie-area coordinates (idempotent)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run demo:seed -- --geocode
# demo day: refresh today's jobs, then keep the simulator running during the presentation
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run demo:seed -- --today
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run demo:seed -- --simulate-gps --interval 3
# Ctrl-C stops it and deletes the simulated location rows
```

`--simulate-gps` drives each technician from their previous stop to the next unfinished one in
`route_order` (grid-style L-shaped legs, `--speed` m/s, default 60 ≈ 4× real time), then:
arrive → job `in_progress` + report with `arrival_time`; after `--dwell` ticks (default 6) →
report gets `departure_time` + chemistry, job `completed`, next job `en_route`. Locations are upserted
with `is_simulated = true` every `--interval` seconds (default 3).

Safety: demo company only (`--company` with any other id aborts; the QA company is always refused),
refuses `CI`, verifies every technician is a demo-company profile, never touches other companies'
rows, and on Ctrl-C/SIGTERM deletes only `company_id = demo AND is_simulated = true` locations.
Job progress made during the simulation is kept (re-run `--today` to reset the mix for a new day).
`--dry-run` prints the plan without credentials.
