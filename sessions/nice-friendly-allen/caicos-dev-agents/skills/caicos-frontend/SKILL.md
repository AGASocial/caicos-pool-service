---
name: Caicos Next.js Frontend
trigger: "building admin portal", "frontend component", "nextjs page", "tailwind styling", "shadcn/ui", "caicos web"
description: "Expert guidance for building Caicos admin portal with Next.js 14, TypeScript, Tailwind CSS, Shadcn/ui components, TanStack Query, and Supabase integration. Handles authentication flows, dashboard creation, CRUD operations, role-based access control, and multi-tenant data isolation."
---

# Caicos Next.js Frontend Development

You are a Next.js 14 specialist building the Caicos admin portal. Use this knowledge to generate production-ready code for the admin dashboard.

## Technology Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **Data Fetching**: TanStack Query (React Query)
- **State**: Client components with hooks + TanStack Query
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Deployment**: Vercel

## Caicos Admin Portal Architecture

### Pages Structure
```
app/
├── (auth)/
│   ├── login/
│   ├── register/
│   └── forgot-password/
├── (dashboard)/
│   ├── page.tsx           (dashboard/KPIs)
│   ├── jobs/
│   │   ├── page.tsx       (jobs list)
│   │   ├── [id]/
│   │   │   └── page.tsx   (job detail)
│   │   └── create/
│   │       └── page.tsx   (job creation)
│   ├── properties/
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx
│   │   └── create/page.tsx
│   ├── team/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── reports/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
└── layout.tsx
```

### Key Features
1. **Multi-tenant Authentication** - Supabase Auth with organization isolation
2. **Role-Based Access Control** - Owner/Admin/Technician permissions
3. **Dashboard KPIs** - Real-time service job metrics
4. **CRUD Operations** - Jobs, Properties, Team members
5. **Service Reports** - Photo gallery + chemical reading display
6. **Data Export** - CSV export for reports
7. **Real-time Updates** - Supabase subscriptions for live data

## Coding Standards

### TypeScript Patterns
```typescript
// Types file (lib/types/index.ts)
export type Job = {
  id: string;
  company_id: string;
  property_id: string;
  technician_id: string;
  scheduled_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
};

export type Property = {
  id: string;
  company_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  gate_code: string | null;
  created_at: string;
};
```

### Component Patterns
- **Server Components** for data fetching, layouts
- **Client Components** for interactive UI (`'use client'`)
- **useQuery** from TanStack Query for data fetching
- **useMutation** for POST/PUT/DELETE operations
- **useTransition** for form submissions

### API Route Pattern
```typescript
// app/api/jobs/route.ts
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('company_id', user.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
```

### Form Handling
- Use `useTransition()` for optimistic updates
- Validate on client + server
- Show toast notifications (use shadcn/ui Toast)
- Handle errors gracefully

### Data Fetching with TanStack Query
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

// Fetching data
const { data: jobs, isLoading } = useQuery({
  queryKey: ['jobs', propertyId],
  queryFn: async () => {
    const res = await fetch(`/api/jobs?property_id=${propertyId}`);
    return res.json();
  },
});

// Mutating data
const { mutate: createJob } = useMutation({
  mutationFn: async (newJob: Job) => {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(newJob),
    });
    return res.json();
  },
});
```

## Authentication & Authorization

### Supabase Auth Setup
- Email/password authentication
- Multi-tenant via company_id in user metadata
- Session management via cookies

### Row-Level Security (RLS)
- Users see only their company's data
- Admins can manage team members
- Technicians see only assigned jobs

### Protected Routes
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { ... } }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

## Common Patterns

### Loading States
- Use `isLoading` from useQuery
- Show skeleton loaders from shadcn/ui
- Disable buttons during mutations

### Error Handling
```typescript
if (error) {
  return (
    <div className="rounded-lg bg-red-50 p-4 text-red-700">
      Failed to load jobs. Please try again.
    </div>
  );
}
```

### Empty States
- Check `data?.length === 0`
- Show helpful empty state UI
- Provide action to create new items

### Pagination
- Use offset/limit query parameters
- Display page info: "Page 1 of 5"
- Disable prev/next buttons at boundaries

## Testing Strategy
- Unit tests for utilities and hooks
- Integration tests for API routes
- E2E tests for critical user flows (login → create job → submit report)
- Minimum 80% code coverage

---

See `references/` for detailed examples, API specifications, and component templates.
