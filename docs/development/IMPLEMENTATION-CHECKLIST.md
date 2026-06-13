# Implementation Checklist - Aligning Code with Updated Specs

## Admin Portal (Next.js Web App)

### Priority 1: Routes Management (NEW Feature)
```
✅ Feature Spec: FEATURE-ADMIN-PORTAL.md (Section: Routes Management)
```

**Files to Create:**
- [ ] `src/app/[locale]/(dashboard)/routes/page.tsx` — Routes list view
  - Display routes with pool counts
  - [+ New Route] button
  - Route cards showing: name, pool count, assigned technician, status

- [ ] `src/app/[locale]/(dashboard)/routes/new/page.tsx` — Create new route form
  - Input: Route name, Description
  - Multi-select checkboxes: Available pools/houses
  - Dropdown: Assign technician
  - [Create Route] button

- [ ] `src/app/[locale]/(dashboard)/routes/[id]/page.tsx` — Edit route
  - Show route details
  - Update assigned pools (multi-select)
  - Change assigned technician
  - Delete route option
  - View recent activity log

**Files to Update:**
- [ ] `src/lib/` — Add route API functions
  - `getRoutes()` — Fetch all routes
  - `createRoute(name, poolIds, technicianId)` — Create route
  - `updateRoute(id, data)` — Update route
  - `deleteRoute(id)` — Delete route
  - `getRouteDetails(id)` — Get full route with pools

**Database Considerations:**
- [ ] Create `routes` table (if not exists)
  - id, name, description, created_at, updated_at, business_id
- [ ] Create `route_pools` junction table
  - route_id, pool_id, order_index
- [ ] Add `route_id` to `pools`/`houses` table (foreign key)
- [ ] Add `route_id` to `technicians` assignment table

---

### Priority 2: Weekly Completion Report (NEW Feature)
```
✅ Feature Spec: FEATURE-ADMIN-PORTAL.md (Section: Weekly Completion Report)
```

**Files to Create:**
- [ ] `src/app/[locale]/(dashboard)/reports/page.tsx` — Reports hub
  - Navigation: Weekly Completion, Service History, etc.

- [ ] `src/app/[locale]/(dashboard)/reports/weekly-completion/page.tsx` — Main report view
  - Filters: Select technician (dropdown), Select week (date picker)
  - [Filter] button to apply
  - Report display:
    - Header: "Technician: Luis Mena | Week of Feb 24-Mar 2 | 86 of 102 pools (84.3%)"
    - Pool list with columns: Pool #, Customer, Status (✓ Complete / ⏳ Pending)
    - Issue category shown per pool
    - Progress bar showing completion percentage
  - Filter toggle: Show All / Completed Only / Pending Only
  - [Approve for Payroll] button (if all complete or admin approved)
  - Export option: PDF/CSV

**Files to Update:**
- [ ] `src/lib/` — Add report API functions
  - `getWeeklyCompletion(technicianId, weekStartDate)` — Get week data
  - `getPoolCompletionStatus(poolId, date)` — Get individual pool status
  - `getIssueCategory(serviceId)` — Get reported issue
  - `approveWeekForPayroll(technicianId, weekDate)` — Mark as approved

---

### Priority 3: Update Existing Pages

#### Technicians Page (`src/app/[locale]/(dashboard)/technicians/page.tsx`)
- [ ] Add "Assigned Route" column
  - Show route name linked to route detail page
  - Show number of pools in route
  - Show current week completion status

#### Pools/Houses Directory (`src/app/[locale]/(dashboard)/beneficiaries/page.tsx` or similar)
- [ ] Add "Assigned to Route" column
  - Show route name
  - Link to route detail
- [ ] Add bulk import feature for pools
  - CSV upload with: pool number, customer name, address
  - Auto-assign to routes in bulk

---

## Technician App (Expo/React Native Mobile App)

### Priority 1: Dashboard Update (MAJOR)
```
✅ Feature Spec: FEATURE-TECHNICIAN-APP.md (Screen 3: Dashboard: Daily Route)
```

**File to Update:**
- [ ] `app/(app)/(tabs)/index.tsx` — Home/Dashboard screen

**Changes Needed:**
```typescript
// OLD (current)
<Text>3 jobs scheduled</Text>
<JobCardList jobs={todayJobs} />

// NEW (required)
<Text>Ruta 1</Text>        // Route name prominently
<Text>(Same route daily)</Text>  // Subtitle
<Text>0 of 22 completed</Text>   // Progress indicator
<PoolCardList pools={routePools} />  // House list instead of time-based jobs
```

**New component needs:**
- Route name display at top
- "(Same route daily)" badge
- Progress counter "X of Y completed"
- House/pool cards showing:
  - Pool/House number
  - Customer name
  - Address
  - Status indicator (pending/complete)
  - [Start Service] button per card

---

### Priority 2: Service Form Update (MAJOR)
```
✅ Feature Spec: FEATURE-TECHNICIAN-APP.md (Screen 4: Service Form)
```

**File to Update:**
- [ ] `app/(app)/job/[id].tsx` — Job/Service detail screen

**Changes Needed:**

**Photos Section:**
- [ ] Add explicit GPS + timestamp auto-capture
  - Display when camera is opened: "📍 GPS: Enabled"
  - Show in form: "📍 GPS captured" + "🕐 Timestamp: 14:32:05"
  - Validation: Reject submission if no GPS
  - Store in image EXIF metadata

**NEW: Issue Category Buttons** (Required field)
```typescript
// Create new component: <IssueCategories />
// 7 mutually exclusive buttons:
- ✓ No Issues       (default, green)
- ⚠️ Motor          (orange)
- ⚠️ Filter         (orange)
- ⚠️ Circulation    (orange)
- ⚠️ Timer          (orange)
- ⚠️ Chemistry      (orange)
- 📝 Other          (with free-text input, orange)

// Validation: One must be selected before form submit
```

**Form Fields:**
```
[Photo capture with GPS validation]
[Issue Category buttons - NEW & REQUIRED]
[Comments text input - OPTIONAL]
[Follow-up Notes text input - OPTIONAL]
[MARK COMPLETE] button
```

**Removed Fields:**
- Chemical readings (specific values)
- Equipment checklist details
- Time fields

---

### Priority 3: Route Display System (NEW)
```
✅ Feature Spec: FEATURE-TECHNICIAN-APP.md (Section: Data Models & State)
```

**Files to Create:**
- [ ] `lib/hooks/useRoute.ts` — New hook to fetch daily route
  ```typescript
  // Returns: { route, pools, loading, error }
  // Replaces old useJobs hook
  ```

**Replace/Update:**
- [ ] Remove or deprecate: `lib/hooks/useJobs.ts`
- [ ] Create new context: `context/RouteContext.tsx`
  - Provide current route, assigned pools
  - Handle pool status updates

---

### Priority 4: Offline Support (NEW Feature)
```
✅ Feature Spec: FEATURE-TECHNICIAN-APP.md (Section: Start/Complete Flow)
```

**Files to Create:**
- [ ] `lib/offline/queueManager.ts` — Queue management
  - `queueServiceReport(poolId, photo, issue, comments)`
  - `getSyncQueue()` — Get pending uploads
  - `clearQueue()` — Clear after sync

- [ ] `lib/sync/syncManager.ts` — Background sync
  - `syncReports()` — Upload queued reports
  - `onConnectionRestored()` — Trigger when online

**Files to Update:**
- [ ] `lib/database.ts` (or storage)
  - Add local storage for pending reports
  - Auto-sync when connection restored
  - Show sync status indicator

**UI Indicator to Add:**
- [ ] Sync status badge in app header
  - Shows: "⏳ Syncing..." or "📶 Synced" or "⚠️ Offline"

---

## Shared Data Models

### Database Schema Updates Needed

```sql
-- Routes table
CREATE TABLE routes (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  name VARCHAR(100),           -- e.g., "Ruta 1"
  description TEXT,
  technician_id UUID REFERENCES technicians(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Route to Pools/Houses mapping
CREATE TABLE route_pools (
  id UUID PRIMARY KEY,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  order_index INT,             -- For ordering houses in route
  created_at TIMESTAMP
);

-- Service reports (new data model)
CREATE TABLE service_reports (
  id UUID PRIMARY KEY,
  pool_id UUID REFERENCES pools(id),
  technician_id UUID REFERENCES technicians(id),
  route_id UUID REFERENCES routes(id),
  photo_url TEXT,
  photo_gps_lat DECIMAL(10, 8),
  photo_gps_lng DECIMAL(11, 8),
  photo_timestamp TIMESTAMP,
  issue_category VARCHAR(50),  -- no_issues, motor, filter, circulation, timer, chemistry, other
  comments TEXT,
  follow_up_notes TEXT,
  status VARCHAR(20),          -- pending, completed
  completed_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Weekly approval tracking
CREATE TABLE weekly_approvals (
  id UUID PRIMARY KEY,
  technician_id UUID REFERENCES technicians(id),
  week_start_date DATE,
  week_end_date DATE,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  total_pools INT,
  completed_pools INT,
  created_at TIMESTAMP
);
```

---

## Feature Completion Matrix

| Feature | Admin Portal | Technician App | Status |
|---------|--------------|----------------|--------|
| Routes Management | NEEDED | ✓ (Display) | 🔴 Not started |
| Weekly Reports | NEEDED | N/A | 🔴 Not started |
| Dashboard - Route Display | N/A | NEEDED | 🔴 Not started |
| Issue Categories | NEEDED | NEEDED | 🔴 Not started |
| GPS + Timestamp Capture | N/A | NEEDED | 🔴 Not started |
| Service Form Simplification | N/A | NEEDED | 🔴 Not started |
| Offline Sync | N/A | NEEDED | 🔴 Not started |
| Technician Assignment to Routes | NEEDED | N/A | 🔴 Not started |
| Pool Assignment to Routes | NEEDED | NEEDED | 🔴 Not started |

---

## File Navigation Quick Links

### Admin Portal Key Paths
```
admin-portal/src/
├── app/[locale]/(dashboard)/
│   ├── routes/              ← CREATE
│   ├── reports/             ← CREATE
│   ├── technicians/         ← UPDATE
│   ├── beneficiaries/       ← UPDATE
│   └── dashboard/
├── lib/
│   └── api.ts               ← ADD route/report functions
├── components/
│   ├── RouteForm.tsx        ← CREATE
│   ├── PoolSelector.tsx     ← CREATE
│   ├── WeeklyReport.tsx     ← CREATE
│   └── TechnicianCard.tsx   ← UPDATE
└── models/
    ├── Route.ts             ← CREATE
    ├── ServiceReport.ts     ← CREATE
    └── WeeklyApproval.ts    ← CREATE
```

### Technician App Key Paths
```
technician-app/
├── app/(app)/
│   ├── (tabs)/
│   │   └── index.tsx        ← UPDATE (Dashboard)
│   └── job/
│       └── [id].tsx         ← UPDATE (Service Form)
├── components/
│   ├── IssueCategories.tsx  ← CREATE (NEW)
│   ├── GPSIndicator.tsx     ← CREATE (NEW)
│   ├── SyncStatus.tsx       ← CREATE (NEW)
│   └── RouteProgress.tsx    ← CREATE (NEW)
├── lib/
│   ├── hooks/
│   │   ├── useRoute.ts      ← CREATE (NEW)
│   │   └── useJobs.ts       ← DEPRECATE
│   ├── offline/
│   │   └── queueManager.ts  ← CREATE (NEW)
│   ├── sync/
│   │   └── syncManager.ts   ← CREATE (NEW)
│   └── database.types.ts    ← UPDATE (schema)
└── context/
    └── RouteContext.tsx     ← CREATE (NEW)
```

---

## Recommended Implementation Order

1. **Backend First** (Supabase)
   - Create database schema for routes, service_reports, weekly_approvals
   - Create API functions for routes CRUD

2. **Admin Portal Screens**
   - Routes management (list, create, edit, delete)
   - Weekly completion report
   - Update technicians and pools pages

3. **Technician App Screens**
   - Update dashboard with route display
   - Update service form with issue categories
   - Add GPS capture validation

4. **Integration**
   - Connect both apps to backend
   - Test data flow end-to-end

5. **Advanced Features**
   - Offline sync queue
   - Weekly approval workflow
   - Report export (PDF/CSV)

