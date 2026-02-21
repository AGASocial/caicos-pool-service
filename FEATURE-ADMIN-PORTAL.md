# Feature Spec: Admin Web Portal

## Overview
NextJS web application for company owners and admins to manage technicians, properties, service jobs, and view reports.

---

## User Types & Permissions

| Role | Signup | Invite | View Reports | Edit Jobs | Manage Team | Settings |
|------|--------|--------|--------------|-----------|-------------|----------|
| Owner | Self | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | Invite only | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Technician | Invite only | ❌ | ❌ | ⚠️ | ❌ | ⚠️ |

**RLS Policies:**
- Owner/Admin: Can create jobs, invite users, view all reports
- Technician: Can only update their own jobs, create their own reports, view own profile
- All: Can only see company_id data

---

## User Journeys

### Journey 1: Owner Initial Setup
```
1. Click signup link → Register page
2. Enter: Name, Email, Password, Company Name
3. System creates:
   - User account
   - Company record
   - Owner profile
4. Redirected to dashboard
5. See empty state: "Create your team!"
6. Can immediately:
   - Add technicians (invite links)
   - Create first property
   - Schedule jobs
```

### Journey 2: Admin Manage Daily Operations
```
1. Login → Dashboard
2. See overview:
   - 5 jobs scheduled today
   - 2 completed, 3 pending
   - 3 active technicians
3. Tap "Jobs" → See all jobs for today
4. Can:
   - Create new job (pick tech + property + date)
   - Edit pending job (reassign, reschedule)
   - View completed reports with photos
5. Tap "Team" → See technicians
6. Can invite new tech or deactivate inactive ones
7. Tap "Properties" → Manage customer pools
8. Can add new property, edit existing info
```

### Journey 3: View Service Report
```
1. Navigate to Reports
2. Filter: Date range, technician, property
3. See report list with:
   - Property name
   - Technician name
   - Date completed
   - Status badges
4. Tap report → See details:
   - All chemical readings (table)
   - Equipment checks
   - Tasks completed
   - Photos gallery
   - Notes
   - Follow-up flag
5. Can export report (PDF) or download photos
```

---

## Pages / Routes

### Authentication

#### `/auth/login`
```
┌────────────────────────────┐
│   CAICOS Admin Portal       │
│                            │
│   [Company Logo]           │
│                            │
│   Email:                   │
│   [____________________]   │
│                            │
│   Password:                │
│   [____________________]   │
│                            │
│   [ ] Remember me          │
│                            │
│   [SIGN IN →]              │
│                            │
│   First time?              │
│   [Create Company]         │
│                            │
│   Forgot password?         │
│   [Reset →]                │
└────────────────────────────┘
```

#### `/auth/register`
```
┌────────────────────────────┐
│   Create Account            │
│                            │
│   Full Name:               │
│   [____________________]   │
│                            │
│   Email:                   │
│   [____________________]   │
│                            │
│   Company Name:            │
│   [____________________]   │
│                            │
│   Password:                │
│   [____________________]   │
│                            │
│   Confirm Password:        │
│   [____________________]   │
│                            │
│   [ ] I agree to terms     │
│                            │
│   [CREATE ACCOUNT]         │
│                            │
│   Already have account?    │
│   [Sign In]                │
└────────────────────────────┘
```

---

### Main Dashboard

#### `/dashboard`
```
┌──────────────────────────────────────┐
│ ☰  CAICOS     Thu, Feb 21      👤    │
├──────────────────────────────────────┤
│                                      │
│  Dashboard                           │
│  ==================                  │
│                                      │
│  Today's Summary                     │
│  ┌────────────┐ ┌────────────┐      │
│  │ 5 Jobs     │ │ 2 Complete │      │
│  │ Today      │ │ (40%)      │      │
│  └────────────┘ └────────────┘      │
│                                      │
│  ┌────────────┐ ┌────────────┐      │
│  │ 3 Pending  │ │ 3 Active   │      │
│  │ (60%)      │ │ Technicians│      │
│  └────────────┘ └────────────┘      │
│                                      │
│  Recent Jobs                         │
│  ────────────────────────────────    │
│  Residencia Smith      8:30 AM       │
│  Status: ✅ Completed                │
│  John Technician                     │
│                                      │
│  Henderson Pool        10:00 AM      │
│  Status: ⏳ In Progress               │
│  Maria Technician                    │
│                                      │
│  [View All Jobs →]                   │
│                                      │
│  Quick Actions                       │
│  ┌──────────────────────────────┐    │
│  │ [+ CREATE JOB]  [+ PROPERTY] │    │
│  │ [+ INVITE TECH]              │    │
│  └──────────────────────────────┘    │
│                                      │
├──────────────────────────────────────┤
│ Home  Jobs  Properties  Team  Reports│
│ Settings  ...                        │
└──────────────────────────────────────┘
```

**Components:**
- **Summary cards:** 4 KPIs (jobs today, completed, pending, active team)
- **Recent jobs list:** Latest 5 jobs with status + tech name
- **Quick action buttons:** Create job, property, invite tech
- **Navigation sidebar:** Main sections

---

### Jobs Management

#### `/jobs`
```
┌──────────────────────────────────────┐
│ ☰  CAICOS     Thu, Feb 21      👤    │
├──────────────────────────────────────┤
│                                      │
│  Jobs                                │
│                                      │
│  Filters:                            │
│  [Date Range ▼] [Technician ▼] [All]│
│  Showing Feb 21, 2026                │
│                                      │
│  [+ CREATE JOB]                      │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Residencia Smith             │    │
│  │ John Technician  8:30 AM     │    │
│  │ Status: ✅ COMPLETED         │    │
│  │ [View Report] [Edit] [Delete]│    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Henderson Pool               │    │
│  │ Maria Technician  10:00 AM   │    │
│  │ Status: ⏳ IN PROGRESS       │    │
│  │ [View Report] [Edit] [Delete]│    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Riverside Condos             │    │
│  │ Unassigned  1:00 PM          │    │
│  │ Status: ⏹️ PENDING           │    │
│  │ [View Report] [Edit] [Delete]│    │
│  └──────────────────────────────┘    │
│                                      │
│ < 1 of 3 >                           │
├──────────────────────────────────────┤
│ Home  Jobs  Properties  Team  Reports│
└──────────────────────────────────────┘
```

**Features:**
- Filter by date range, technician, status
- Table/card view toggle
- Columns: Property, Technician, Scheduled time, Status
- Bulk actions: Delete, reassign
- [Create Job] button → form modal

#### `/jobs/new` (Modal/Page)
```
Create Job
────────────────────────────

Property: [Residencia Smith ▼]
Technician: [John Technician ▼]
Date: [Feb 21, 2026]
Time: [08:30 AM]
Duration: [30] minutes
Route Order: [1]
Notes: [Optional notes...]

[SAVE JOB]  [CANCEL]
```

**Data:**
- Property: Dropdown (searchable)
- Technician: Dropdown (active team members)
- Scheduled date: Date picker
- Scheduled time: Time picker
- Estimated duration: Number input (default 30 min)
- Route order: Number (for sequencing daily jobs)
- Notes: Optional text

#### `/jobs/[id]`
```
Job Detail
────────────────────────────

Job #UL42K

📍 Residencia Smith
1244 Blue Water Dr, Orlando FL
🔑 Gate code: 1234

Technician: John Technician
Status: ✅ COMPLETED
Date: Feb 21, 2026 @ 8:30 AM
Duration: 28 minutes
Route: #1

[EDIT]  [PRINT]  [DELETE]

────────────────────────────

Service Report

Arrival: 8:32 AM
Departure: 9:00 AM

💧 Chemical Readings
pH: 7.4
Chlorine: 2.1 ppm
Alkalinity: 95 ppm
... (all 7 readings)

🔧 Equipment Status
Pump: ✅ OK
Filter: ✅ OK
Heater: ⚠️ ISSUE
Cleaner: ✅ OK

✅ Tasks Completed
☑ Skimmed surface
☑ Vacuumed floor
☑ Brushed walls
☑ Emptied baskets
☑ Backwashed filter
☐ Cleaned filter

🧪 Chemicals Added
Chlorine: 2 tabs
Acid: 6 oz muriatic

📷 Photos (3)
[Gallery view - 3 thumbnails]

📝 Notes
"Pool looks good. Minor issue with heater -
customer aware."

⚠️ Follow-up
☑ Needed
"Check heater tomorrow - parts on order"

[EXPORT PDF]
```

---

### Properties Management

#### `/properties`
```
┌──────────────────────────────────────┐
│ ☰  CAICOS     Thu, Feb 21      👤    │
├──────────────────────────────────────┤
│                                      │
│  Properties (15 total)               │
│                                      │
│  [Search...]  [Status ▼] [Type ▼]    │
│  [+ CREATE PROPERTY]                 │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Residencia Smith             │    │
│  │ 1244 Blue Water Dr, Orlando  │    │
│  │ 💧 Residential / Plaster     │    │
│  │ 📞 (555) 123-4567           │    │
│  │ 🟢 Active                    │    │
│  │ [Edit]  [View Jobs]  [Delete]│    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Henderson Pool               │    │
│  │ 892 Blue Sky Way, Austin     │    │
│  │ 💧 Commercial / Concrete     │    │
│  │ 📞 (512) 456-7890           │    │
│  │ 🟢 Active                    │    │
│  │ [Edit]  [View Jobs]  [Delete]│    │
│  └──────────────────────────────┘    │
│                                      │
│ [scroll...]                          │
│                                      │
├──────────────────────────────────────┤
│ Home  Jobs  Properties  Team  Reports│
└──────────────────────────────────────┘
```

**Features:**
- List all properties with key info
- Search by customer name or address
- Filter by status (active/inactive), pool type, surface
- Bulk import from CSV
- [+ Create] button

#### `/properties/[id]`
```
Residencia Smith
────────────────────────────────

Customer Info:
Name: John Smith
Email: john@example.com
Phone: (555) 123-4567

Address:
1244 Blue Water Dr
Orlando, FL 32801

Pool Details:
Type: Residential
Surface: Plaster
Equipment Notes:
Salt water system, heater replaced 2024

Gate Code: 1234
Notes: Friendly customers, call ahead weekends

Status: 🟢 Active

[EDIT]  [DELETE]

────────────────────────────────

Service History
Next scheduled: Feb 22 @ 10:00 AM
Last service: Feb 21 @ 8:30 AM (John T)
Service frequency: 1x per week
Total services: 47

[VIEW ALL JOBS]
```

#### `/properties/new` (or modal)
```
Create Property
────────────────────────────

Customer Name: [_____________]
Email: [_____________]
Phone: [_____________]

Address: [_____________]
City: [_____________]
State: [FL ▼]
ZIP: [_____________]

Pool Type: [Residential ▼]
Surface: [Plaster ▼]
Equipment Notes: [_____________]
Gate Code: [_____________]
Other Notes: [_____________]

[CREATE]  [CANCEL]
```

---

### Team Management

#### `/team`
```
┌──────────────────────────────────────┐
│ ☰  CAICOS     Thu, Feb 21      👤    │
├──────────────────────────────────────┤
│                                      │
│  Team Members (5 total)              │
│                                      │
│  [+ INVITE TECHNICIAN]               │
│                                      │
│  OWNER                               │
│  ┌──────────────────────────────┐    │
│  │ Sarah Johnson                │    │
│  │ sarah@caicos.com             │    │
│  │ 👑 OWNER                     │    │
│  │ Status: 🟢 Active            │    │
│  │ Joined: Jan 2024             │    │
│  │ [Edit] [View Profile]        │    │
│  └──────────────────────────────┘    │
│                                      │
│  ADMINS                              │
│  ┌──────────────────────────────┐    │
│  │ Mike Wilson                  │    │
│  │ mike@caicos.com              │    │
│  │ 👮 ADMIN                     │    │
│  │ Status: 🟢 Active            │    │
│  │ Joined: Mar 2024             │    │
│  │ [Edit] [View Profile]        │    │
│  └──────────────────────────────┘    │
│                                      │
│  TECHNICIANS                         │
│  ┌──────────────────────────────┐    │
│  │ John Technician              │    │
│  │ john@caicos.com              │    │
│  │ 🔧 TECHNICIAN               │    │
│  │ Status: 🟢 Active            │    │
│  │ Jobs completed: 42           │    │
│  │ [Edit] [View Profile]        │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Maria Garcia                 │    │
│  │ maria@caicos.com             │    │
│  │ 🔧 TECHNICIAN               │    │
│  │ Status: 🟡 Inactive          │    │
│  │ Jobs completed: 156          │    │
│  │ [Edit] [View Profile]        │    │
│  └──────────────────────────────┘    │
│                                      │
├──────────────────────────────────────┤
│ Home  Jobs  Properties  Team  Reports│
└──────────────────────────────────────┘
```

**Features:**
- List all team members by role
- Show active status, join date, job stats
- [+ Invite] button → generates invite link

#### `/team/new` (Invite Modal)
```
Invite Technician
────────────────────────────

Email: [_____________]
Full Name: [_____________]
Role: [Technician ▼]

Invite Link:
https://app.caicos.com/join?code=ABC123XYZ
(Auto-generated)

[ Copy Link ]

Instructions:
Send the invite link above to the technician.
They can sign up and join immediately.

[SEND INVITE]  [CLOSE]
```

**Backend:**
- Generate unique invite code (short UUID)
- Email invite link to technician
- Code expires in 7 days
- Code ties to company_id + role

#### `/team/[id]`
```
John Technician
────────────────────────────

Status: 🟢 Active
Email: john@caicos.com
Phone: (555) 987-6543
Role: Technician
Joined: Mar 15, 2024

Statistics:
Jobs completed: 42
Avg rating: 4.8/5 (5 reviews)
Last job: Feb 21 @ 9:00 AM

Actions:
[ ] Inactive (toggle to deactivate)
[ Edit ] [ Remove from Team ]

Change Role:
[Technician ▼] [Update Role]
```

---

### Reports

#### `/reports`
```
┌──────────────────────────────────────┐
│ ☰  CAICOS     Thu, Feb 21      👤    │
├──────────────────────────────────────┤
│                                      │
│  Service Reports                     │
│                                      │
│  Filters:                            │
│  [Date Range ▼]  [Technician ▼]     │
│  [Property ▼]    [Export ▼]          │
│                                      │
│  Found: 427 reports                  │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Feb 21, 8:30 AM              │    │
│  │ Residencia Smith             │    │
│  │ John Technician              │    │
│  │ Status: ✅ Completed         │    │
│  │ [View] [Download PDF]        │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Feb 20, 10:15 AM             │    │
│  │ Henderson Pool               │    │
│  │ Maria Technician             │    │
│  │ Status: ✅ Completed         │    │
│  │ [View] [Download PDF]        │    │
│  └──────────────────────────────┘    │
│                                      │
│ [scroll...]                          │
│                                      │
├──────────────────────────────────────┤
│ Home  Jobs  Properties  Team  Reports│
└──────────────────────────────────────┘
```

**Features:**
- Filter by date range, technician, property
- Search by customer name
- Pagination (100 per page)
- Export selected reports (PDF, CSV)

#### `/reports/[id]` (Detail View)
[Already shown in Jobs section above]

---

### Settings

#### `/settings`
```
┌──────────────────────────────────────┐
│ ☰  CAICOS     Thu, Feb 21      👤    │
├──────────────────────────────────────┤
│                                      │
│  Company Settings                    │
│                                      │
│  Company Logo:                       │
│  [Upload Logo]                       │
│                                      │
│  Company Name:                       │
│  [Caicos Pool Service]               │
│                                      │
│  Email:                              │
│  [admin@caicos.com]                  │
│                                      │
│  Phone:                              │
│  [(305) 555-1234]                    │
│                                      │
│  Address:                            │
│  [123 Main St, Miami, FL 33101]      │
│                                      │
│  [SAVE CHANGES]                      │
│                                      │
│  ────────────────────────────        │
│                                      │
│  Subscription                        │
│  Current Plan: Pro (Monthly)         │
│  Monthly Cost: $99/month             │
│  Billing Date: Mar 21, 2026          │
│  [Manage Billing →]                  │
│                                      │
│  ────────────────────────────        │
│                                      │
│  Account                             │
│  Email: admin@caicos.com             │
│  Password: ••••••••                  │
│  [Change Password]                   │
│  [Two-Factor Auth] Off               │
│                                      │
│  ────────────────────────────        │
│                                      │
│  Danger Zone                         │
│  [Delete Company & Data]             │
│                                      │
├──────────────────────────────────────┤
│ Home  Jobs  Properties  Team  Reports│
└──────────────────────────────────────┘
```

**Features:**
- Edit company info
- Upload/change logo
- View subscription details
- Change password, enable 2FA
- Delete company (owner only)

---

## Technical Implementation

### Tech Stack Details
```
Frontend:
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Shadcn/ui components
- React Query/TanStack Query (data fetching)
- Zustand (global state)
- React Hook Form (form handling)
- Recharts (charts/graphs)

Backend:
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime
```

### Key Hooks
```typescript
// useAuth - Authentication
// useCompany - Company data
// useJobs - Jobs CRUD
// useProperties - Properties CRUD
// useTeam - Team member management
// useReports - Service reports
```

### API Routes / Server Actions
```
/api/auth/*
/api/jobs/*
/api/properties/*
/api/team/*
/api/reports/*
/api/companies/*
```

---

## MVP Features Checklist

- [ ] Owner registration & company creation
- [ ] Technician invite system
- [ ] Dashboard with daily overview
- [ ] Jobs CRUD (create, edit, delete, view)
- [ ] Properties CRUD
- [ ] Team member management
- [ ] Service report viewer
- [ ] Photo gallery in reports
- [ ] Export reports (PDF/CSV)
- [ ] Company settings
- [ ] User role-based access control
- [ ] Responsive design (mobile-friendly)

---

## Performance Considerations

- **Pagination:** Load 100 records per page (jobs/properties/reports)
- **Caching:** TanStack Query with 5-min stale time
- **Images:** Compress photos on upload, lazy-load thumbnails
- **Search:** Server-side filtering on main table columns

---

**Status:** Detailed spec ready for development

*Feature owner: Admin portal team*
