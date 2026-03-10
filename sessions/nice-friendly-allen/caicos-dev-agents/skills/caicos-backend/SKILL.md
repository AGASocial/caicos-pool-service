---
name: Caicos Next.js Backend API
trigger: "backend api", "api route", "database query", "supabase function", "caicos backend", "rls policy"
description: "Expert guidance for building Caicos backend API routes with Next.js 14, TypeScript, Supabase integration, Row Level Security policies, database functions, and multi-tenant architecture. Handles authentication, authorization, data operations, photo storage, and real-time subscriptions."
---

# Caicos Next.js Backend API Development

You are a backend specialist building the Caicos API layer. Use this knowledge to generate production-ready API routes and database logic.

## Technology Stack
- **Framework**: Next.js 14 (App Router - api routes)
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Security**: Row Level Security (RLS) + PostgREST
- **Storage**: Supabase Storage (photos)
- **Real-time**: Supabase Realtime (PostgreSQL triggers)

## Caicos Backend Architecture

### API Routes Structure
```
app/api/
├── auth/
│   ├── login/route.ts
│   ├── register/route.ts
│   ├── logout/route.ts
│   └── refresh/route.ts
├── jobs/
│   ├── route.ts           (GET, POST)
│   └── [id]/
│       ├── route.ts       (GET, PUT, DELETE)
│       └── service-report/
│           └── route.ts   (POST - submit service data)
├── properties/
│   ├── route.ts
│   └── [id]/route.ts
├── team/
│   ├── route.ts
│   ├── [id]/route.ts
│   └── invite/route.ts
├── photos/
│   ├── upload/route.ts    (multipart form)
│   ├── [id]/route.ts
│   └── delete/route.ts
├── reports/
│   ├── route.ts           (GET with filters)
│   └── export/route.ts    (POST - CSV export)
└── health/route.ts        (health check)
```

### Multi-Tenant Architecture
```
All data partitioned by:
- company_id: The organization (pool service company)
- user_id: Individual user within organization
- role: owner | admin | technician

Example query:
WHERE company_id = user.company_id
AND (user_id = current_user_id OR user.role = 'admin')
```

## Supabase Database Schema

### Tables Overview
```sql
-- Companies (tenants)
companies (id, name, email, plan, created_at)

-- Users
users (id, email, company_id, role, metadata, created_at)

-- Jobs
jobs (id, company_id, property_id, technician_id, scheduled_date,
      status, notes, created_at, updated_at)

-- Properties
properties (id, company_id, name, address, city, state, zip,
            gate_code, notes, created_at)

-- Service Reports
service_reports (id, job_id, ph, chlorine, alkalinity, hardness,
                 salt, temperature, tasks_completed, notes, created_at)

-- Photos
photos (id, job_id, storage_path, photo_type, created_at)

-- Team Members
team_members (id, company_id, user_id, email, role, invited_at,
              accepted_at)
```

## Row Level Security (RLS) Policies

### Example RLS Policy
```sql
-- Policy: Users see only their company's jobs
CREATE POLICY jobs_company_isolation ON jobs
  FOR SELECT USING (company_id = auth.uid()::company_id);

-- Policy: Technicians see only assigned jobs
CREATE POLICY jobs_technician_view ON jobs
  FOR SELECT USING (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Policy: Jobs can only be updated by assigned technician or admin
CREATE POLICY jobs_update_policy ON jobs
  FOR UPDATE USING (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()
      AND company_id = jobs.company_id
      AND role IN ('owner', 'admin')
    )
  );
```

## API Route Patterns

### GET (Fetch Data)
```typescript
// app/api/jobs/route.ts
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { /* ... */ } }
  );

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Query with RLS enforced
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('technician_id', user.id)
    .order('scheduled_date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
```

### POST (Create Data)
```typescript
// app/api/jobs/route.ts
export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { /* ... */ } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Validate request
  if (!body.property_id || !body.technician_id) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // Insert with company_id from user context
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      company_id: user.user_metadata?.company_id,
      property_id: body.property_id,
      technician_id: body.technician_id,
      scheduled_date: body.scheduled_date,
      status: 'pending',
    })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data[0], { status: 201 });
}
```

### PUT (Update Data)
```typescript
// app/api/jobs/[id]/route.ts
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { /* ... */ } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from('jobs')
    .update(body)
    .eq('id', params.id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data[0]);
}
```

### File Upload (Photos)
```typescript
// app/api/photos/upload/route.ts
export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { /* ... */ } }
  );

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const jobId = formData.get('jobId') as string;

  if (!file || !jobId) {
    return NextResponse.json(
      { error: 'Missing file or jobId' },
      { status: 400 }
    );
  }

  const filename = `${jobId}/${Date.now()}-${file.name}`;

  const { data, error } = await supabase.storage
    .from('job-photos')
    .upload(filename, file);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Record in database
  const { error: dbError } = await supabase
    .from('photos')
    .insert({ job_id: jobId, storage_path: filename });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 400 });
  }

  return NextResponse.json({ path: data.path });
}
```

## Error Handling

### Standard Error Response
```typescript
const handleDatabaseError = (error: any) => {
  if (error.code === '23503') {
    return { message: 'Referenced record not found', status: 404 };
  }
  if (error.code === '23505') {
    return { message: 'Record already exists', status: 409 };
  }
  return { message: 'Database error', status: 500 };
};
```

### Validation Pattern
```typescript
const validateServiceReport = (data: any) => {
  const errors: Record<string, string> = {};

  if (!data.job_id) errors.job_id = 'Job ID required';
  if (typeof data.ph !== 'number' || data.ph < 6 || data.ph > 8.5) {
    errors.ph = 'pH must be between 6 and 8.5';
  }
  if (typeof data.chlorine !== 'number' || data.chlorine < 1 || data.chlorine > 5) {
    errors.chlorine = 'Chlorine must be between 1 and 5';
  }

  return Object.keys(errors).length > 0 ? errors : null;
};
```

## Real-time Subscriptions

### Setting Up Realtime
```typescript
// lib/supabase-client.ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Listen for job updates
supabase
  .channel('jobs')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'jobs' },
    (payload) => {
      console.log('Job update:', payload);
      // Update UI
    }
  )
  .subscribe();
```

## Testing Strategy
- Integration tests for API routes with Supabase
- Test RLS policies with different user roles
- Mock authentication for testing
- Database transaction rollback for cleanup
- Minimum 80% code coverage

---

See `references/` for database schema SQL, RLS policy examples, and complete API documentation.
