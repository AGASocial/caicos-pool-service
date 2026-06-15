---
name: supabase-server-client
description: >-
  Single Supabase server client pattern for admin-portal API routes and RSC.
  Use when adding or changing admin-portal API routes, server data loaders,
  Storage signed URLs, or any Supabase access in Next.js App Router.
---

# Supabase Server Client (admin-portal)

Use **one** Supabase client per request. Do not create multiple clients, duplicate cookie handlers, or mix service-role keys into route handlers unless explicitly required (webhooks/cron only).

## Source of truth

`admin-portal/src/lib/supabase-server.ts`

| Helper | When to use |
|--------|-------------|
| `createAuthenticatedRouteClient()` | **Default for API routes** — returns `{ supabase, user }`; check `user` and return 401 if null |
| `createRouteClient()` | RSC loaders (`server-data.ts`) or routes where auth is optional / handled differently |

Both use `@supabase/ssr` + cookies, RLS via the user's JWT, and a 10s fetch timeout.

## API route pattern (required)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';

export async function GET(_request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;

  // DB queries → client.from(...)
  const { data, error } = await client.from('cadenza_service_jobs').select('id').limit(1);

  // Storage → same supabase instance (no second client)
  const { data: signed } = await supabase.storage
    .from('report-photos')
    .createSignedUrls(['path/to/object.jpg'], 3600);

  return NextResponse.json({ data, signed });
}
```

## Rules

1. **One client, one cast** — `const client = supabase as unknown as CadenzaSupabaseClient` for Cadenza tables; use `supabase` directly for `.storage` and `.auth`.
2. **Never pass the same client twice** with different types — avoid helpers that take both `supabase` and `client` for the same object.
3. **Prefer embedded selects** — fetch parent + child rows in one PostgREST query when related by FK (e.g. report + `cadenza_report_photos`).
4. **Batch signed URLs** — `createSignedUrls(paths, ttl)` for private buckets; sign on the server only.
5. **No service role in user routes** — use `supabase-admin.ts` only for webhooks, cron, or ops that must bypass RLS.
6. **Add missing tables** to `CadenzaSupabaseClient` in `lib/supabase-cadenza.ts` when querying new Cadenza tables.

## Domain helpers

Put mapping and storage helpers in `lib/`, not in route files:

- `lib/service-report.ts` — `mapReportRow`, `attachSignedPhotoUrls`, `REPORT_WITH_PHOTOS_SELECT`
- Reference route: `src/app/api/jobs/[id]/route.ts`
- Reference storage route: `src/app/api/storage/presign/route.ts`

## Anti-patterns

```typescript
// ❌ Multiple clients in one handler
const supabase1 = await createRouteClient();
const supabase2 = await createRouteClient();

// ❌ Service role in a user-facing API route
import { createAdminClient } from '@/lib/supabase-admin';

// ❌ Verbose inferred types instead of SupabaseClient
supabase: Awaited<ReturnType<typeof createAuthenticatedRouteClient>>['supabase']

// ❌ Inline photo signing logic duplicated across routes
// → use attachSignedPhotoUrls from lib/service-report.ts
```

## When loading this skill

NextJS Developer agent should load this skill alongside `nextjs-performance` for any admin-portal API or server-side Supabase work.
