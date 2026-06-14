# Production observability runbook (US-B-015)

## Request duration logging

API routes wrapped with `withApiTiming()` emit structured JSON logs:

```json
{ "type": "api_timing", "route": "GET /api/dashboard", "duration_ms": 142, "status": 200 }
```

Filter in Vercel Logs: `type:api_timing`.

## Alert thresholds (recommended)

| Route class | p95 target | Alert if p95 > |
|-------------|------------|----------------|
| Dashboard / list reads | 800ms | 1500ms |
| Reports aggregation | 1200ms | 2500ms |
| Write endpoints | 1000ms | 2000ms |
| Cron / bulk generation | 30s | 55s (Vercel limit) |

## Slow query hook

Supabase errors with `code` 57014 (statement timeout) should be logged at error level in route handlers. Increase indexes before raising timeout.

## Load testing

See `plan/load-tests/dashboard.js`. Record baseline p50/p95/p99 after each performance phase.
