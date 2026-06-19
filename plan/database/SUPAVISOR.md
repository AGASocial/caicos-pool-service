# Supavisor connection pool configuration (US-D-004)

## Production setup

1. Enable **Supavisor transaction mode** in Supabase Dashboard → Project Settings → Database → Connection Pooling.
2. Use the **pooler connection string** (port 6543) for Vercel serverless functions.
3. Keep the direct connection string (port 5432) for migrations and one-off admin tasks only.

## Environment variables

| Variable | Use |
|----------|-----|
| `DATABASE_URL` | Direct Postgres (migrations, local) |
| `DATABASE_POOLER_URL` | Supavisor transaction pooler for API routes |

For Supabase JS client, continue using `NEXT_PUBLIC_SUPABASE_URL` + anon/service keys — pooling is handled at the Postgres connection layer when using `@supabase/supabase-js` with pooler-backed PostgREST.

## Monitoring

- Watch **active connections** in Supabase Database → Reports.
- Alert when connections exceed 80% of plan limit during peak.
- Document pool size in runbook: default Supavisor pool ~15–20 per project tier; scale plan before raising app concurrency.

## RLS note

Transaction mode requires queries to avoid prepared statements that hold connections across requests. Supabase client defaults are compatible.
