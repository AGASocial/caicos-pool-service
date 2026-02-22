# Caicos - Pool Service Platform
## Comprehensive Solution Design

**Status:** MVP Phase
**Last Updated:** February 2026
**Client:** Caicos (Pool Service Company, Florida)

---

## 1. Executive Summary

Caicos is a **multi-tenant SaaS platform** designed to streamline pool service operations across technicians and management. The MVP focuses on the **technician-facing mobile app** and **admin management portal** to handle job scheduling, service reporting, and team coordination.

### MVP Scope
- ✅ Admin web portal (NextJS + Supabase)
- ✅ Technician mobile app (React Native + Expo)
- ✅ Multi-tenant architecture with Row Level Security
- ✅ Service job management & reporting
- ✅ Chemical readings & equipment checks
- ✅ Photo documentation
- ❌ Customer portal (Phase 2)
- ❌ Route optimization (Phase 2)
- ❌ Advanced analytics (Phase 2)

---

## 2. Architecture Overview

### 2.1 Technology Stack

```
Frontend (Technician):
├── React Native + Expo SDK 52
├── Expo Router (file-based routing)
├── TypeScript
├── Zustand (state management)
├── Tamagui (optional: unified UI across platforms)
└── Supabase Client SDK

Frontend (Admin): Use /docs/example-app as a reference
├── Next.js 14+ (App Router)
├── TypeScript
├── Tailwind CSS
├── Supabase Client
├── TanStack Query (data fetching)
└── Shadcn/ui (component library)

Backend:
├── Supabase (PostgreSQL, Auth, Storage)
├── Row Level Security (RLS)
├── Database Triggers & Functions
└── Realtime subscriptions

Infrastructure:
├── Supabase Hosting (managed)
├── Expo EAS (mobile CI/CD)
├── Vercel (web app hosting)
└── Cloud Storage (Supabase Storage for photos)
```

### 2.2 System Architecture

```
┌─────────────────────┐
│  Technician App     │
│  (React Native)     │
│  - Expo Go / Build  │
└──────────┬──────────┘
           │
           │ HTTP/WebSocket
           │
      ┌────▼─────────────┐
      │   Supabase       │
      │  (Backend + DB)  │
      └────┬─────────────┘
           │
      ┌────▼──────────────┐
      │  Admin Portal     │
      │  (NextJS)         │
      └───────────────────┘
```

### 2.3 Data Flow

**Technician Workflow:**
```
1. Technician logs in (Multi-tenant auth)
   ↓
2. Dashboard shows assigned jobs for today
   ↓
3. Opens job → sees customer details, property info, gate codes
   ↓
4. Starts job (status: pending → in_progress)
   ↓
5. Fills service form:
   - Chemical readings
   - Equipment checks
   - Tasks completed
   - Photos (before/after/issues)
   - Notes
   ↓
6. Marks complete (status → completed)
   ↓
7. Syncs to Supabase (with photos)
```

**Admin Workflow:**
```
1. Admin logs in (Web portal)
   ↓
2. Dashboard: See team, jobs, properties
   ↓
3. Can create/edit:
   - Customer properties
   - Service jobs
   - Technician assignments
   ↓
4. View reports & trends
   ↓
5. Manage company settings
```

---

## 3. Feature Breakdown (MVP)

### 3.1 Core Features by Component

#### **Technician Mobile App**
- **Authentication**
  - Company signup (owner creates account)
  - Technician invitations (admin invites team)
  - Multi-tenant isolation via RLS

- **Daily Dashboard**
  - Jobs for today (with route order)
  - Job progress tracker (X of Y completed)
  - Pull-to-refresh

- **Job Detail & Service Form**
  - Customer property info
  - Gate codes & access notes
  - Chemical readings input (pH, chlorine, alkalinity, etc.)
  - Equipment status checks (pump, filter, heater, cleaner)
  - Task checkboxes (skim, vacuum, brush, backwash, etc.)
  - Chemical tracking (amounts added)
  - Photo capture (camera + gallery)
  - General notes & follow-up flagging
  - Drag & drop photo removal

- **Properties View** (read-only in MVP)
  - Browse customer pools
  - Filter by active/inactive

- **Settings/Profile**
  - View profile
  - Edit name/avatar
  - Logout

#### **Admin Web Portal**
- **Authentication**
  - Company owner registration
  - Admin role management
  - Invite links for team members

- **Dashboard**
  - Overview: Team activity, jobs completed, pending jobs
  - Quick stats (% completion, active technicians)

- **Technicians Management**
  - List all team members
  - Create/invite technicians
  - Assign roles (owner, admin, technician)
  - View technician profiles
  - Deactivate team members

- **Properties Management**
  - CRUD customer pools
  - Bulk import (CSV)
  - Map view (lat/lng)
  - Filter by pool type, surface, status

- **Service Jobs**
  - Create jobs (assign to technician + date)
  - Set route order
  - Bulk schedule (recurring jobs)
  - View all completed reports
  - Export job history (CSV/PDF)

- **Reports Viewer**
  - List all service reports
  - Filter by technician, property, date range
  - View chemical readings in table format
  - Download photos
  - Export reports

- **Company Settings**
  - Company info (name, phone, email, logo)
  - Subscription tier
  - Billing info

---

## 4. Database Schema (Simplified)

### Core Tables:
```sql
companies          # Tenants
├── id, name, logo_url, subscription_tier

profiles           # Users (extends auth.users)
├── id, company_id, role, full_name, avatar_url

properties         # Customer pools
├── id, company_id, customer_name, address, pool_type

service_jobs       # Scheduled visits
├── id, company_id, property_id, technician_id, scheduled_date, status

service_reports    # Completed work
├── id, job_id, company_id, technician_id
├── [chemical readings: ph_level, chlorine_level, ...]
├── [equipment: pump_ok, filter_ok, ...]
├── [tasks: skimmed, vacuumed, brushed, ...]
├── notes, follow_up_needed

report_photos      # Attachments
├── id, report_id, company_id, storage_path, photo_type
```

### Security:
- Row Level Security (RLS) enabled on all tables
- Policies: Users see only their company data
- Multi-tenant isolation at database level
- Admin-only operations restricted via role checks

---

## 5. Project File Structure

### Technician App (React Native)
```
technician-app/
├── app/
│   ├── (auth)/                 # Login, Register
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (app)/
│   │   ├── (tabs)/
│   │   │   ├── jobs.tsx        # Daily job list
│   │   │   ├── properties.tsx   # Property directory
│   │   │   └── settings.tsx     # Profile & logout
│   │   ├── job/[id].tsx         # Service form
│   │   └── property/[id].tsx    # Property detail
│   └── _layout.tsx             # Root layout
├── src/
│   ├── lib/
│   │   ├── supabase.ts         # Client config
│   │   └── constants.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useJobs.ts
│   │   └── useProperties.ts
│   ├── types/
│   │   └── database.ts         # TypeScript types
│   └── constants/
│       └── readings.ts         # Chemical ranges, tasks
├── supabase/
│   └── schema.sql
├── .env.example
├── app.json                    # Expo config
└── package.json
```

### Routes (recurring schedule)

- **Route** = one technician + a fixed ordered list of houses (properties). Same route week after week; houses can be added or removed from the route over time.
- **Route stops** = which properties are on the route and in what order (CRUD: add/remove houses, reorder).
- **Jobs** are created from routes (e.g. "Generate jobs for Route 5 for week of Feb 22" → one job per house on that route for that date, same technician, `route_order` from stop order). Optional `route_id` on job links it back to the route.
- **Skip a visit:** When a house doesn’t need service that week, create the job as usual and set **status = cancelled** (or don’t create that job for that date). No separate "skip" table; cancellation is per job.

### Admin Portal (NextJS)
```
admin-portal/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── dashboard/page.tsx
│   ├── technicians/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── properties/
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx
│   │   └── new/page.tsx
│   ├── jobs/
│   │   ├── page.tsx
│   │   └── new/page.tsx
│   ├── reports/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── settings/page.tsx
│   └── layout.tsx
├── components/
│   ├── nav/
│   ├── tables/
│   ├── forms/
│   └── charts/
├── lib/
│   ├── supabase.ts
│   └── utils.ts
├── public/
└── package.json
```

---

## 6. MVP Features Checklist

### Phase 1: Core Technician Workflow
- [ ] Auth: Company signup + technician invites
- [ ] Daily job list with status tracker
- [ ] Job detail page with full service form
- [ ] Chemical readings input (9 metrics)
- [ ] Equipment checks (4 items)
- [ ] Service tasks (6 checkboxes)
- [ ] Photo capture & gallery upload
- [ ] Notes & follow-up flagging
- [ ] Sync to Supabase
- [ ] Settings/profile screen
- [ ] Offline support (basic caching)

### Phase 1: Admin Portal Basics
- [ ] Owner registration & company setup
- [ ] Technician CRUD + invites
- [ ] Property CRUD
- [ ] Job creation & assignment
- [ ] View service reports
- [ ] Basic dashboard stats
- [ ] Company settings

### Phase 1: Infrastructure
- [ ] Supabase project setup
- [ ] Database schema & RLS
- [ ] Auth triggers (auto-create company/profile)
- [ ] Storage bucket for photos
- [ ] Vercel deployment (admin)
- [ ] EAS build (mobile)

---

## 7. Success Metrics (MVP)

- **Technician app:** < 5 min to complete full service report
- **Data integrity:** 100% RLS enforcement (no cross-tenant data leaks)
- **Uptime:** 99.5% SLA
- **Offline resilience:** Sync pending jobs when reconnected
- **Adoption:** Team completes 90%+ of jobs via app

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Photo upload failures | Service report incomplete | Implement retry logic + offline queue |
| RLS misconfiguration | Data breach | Thorough testing of policies + audit logs |
| Schema scaling | Performance degradation | Index on company_id, scheduled_date |
| Offline data conflict | Data consistency | Last-write-wins + server validation |
| Technician adoption | Low usage | Simple UX, training, in-app guidance |

---

## 9. Next Steps

1. **Clarify requirements:**
   - Specific chemical readings for Caicos pools?
   - Any integrations (QuickBooks, Stripe)?
   - Branding requirements?

2. **Detailed feature specs:**
   - Create separate docs for each major feature
   - Wireframes for key screens
   - API endpoint specifications

3. **Development kickoff:**
   - Set up Supabase project
   - Initialize git repos
   - Configure CI/CD pipelines

4. **Timeline estimation:**
   - Technician app core: 4-6 weeks
   - Admin portal core: 3-4 weeks
   - Testing & polish: 2-3 weeks

---

## 10. References

- **Reference Platform:** Pool Service Pro / PoolControl (Spanish market)
  - Checklist-based task workflow ✓
  - Photo documentation ✓
  - Route ordering ✓
  - Multi-role system ✓

- **Inspiration:** Service apps with offline support
  - Uber Eats (offline cart)
  - Salesforce (sync queues)
  - Google Tasks (pending state)

---

**Document Status:** Draft - Ready for feedback & iteration

*Created for AGA Social by Claude*
