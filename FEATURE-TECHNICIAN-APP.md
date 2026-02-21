# Feature Spec: Technician Mobile App

## Overview
React Native (Expo) mobile application for field technicians to manage daily pool service jobs, capture service data, and upload reports.

---

## User Journeys

### Journey 1: New Technician Onboarding
```
1. Technician receives invite email/SMS with link
2. Taps link → Opens app (deep link)
3. Registers: Email + Password + Full Name
4. App creates auth.user + profile (role: technician)
5. Profile auto-assigned to company via invite token
6. Sees job list → Ready to work
```

### Journey 2: Daily Work (Typical Day)
```
1. Open app → Auto-login (cached session)
2. Dashboard: "Tue, Feb 21 • 3 jobs scheduled"
3. See job cards:
   - [1] Residencia Miller - 8:30 AM - 30 min
   - [2] Henderson Pool - 10:00 AM - 45 min
   - [3] Riverside Condos - 1:00 PM - 30 min
4. Tap [1] → Open job detail
5. "Tap START to begin service"
6. Tap START → Status: pending → in_progress
7. Form appears:
   - Property header (customer, address, gate code)
   - Chemical readings section
   - Equipment checks
   - Tasks completed
   - Photos section
   - Notes
8. Fill out service data
9. Take 2-3 photos (before, after, issue)
10. Tap "COMPLETE & SAVE REPORT"
11. Photos + report synced to Supabase
12. Job status: in_progress → completed
13. Return to dashboard
14. Repeat for jobs [2] and [3]
15. End of day: 3 of 3 completed ✓
```

### Journey 3: Offline Service (No WiFi)
```
1. Start job while on-site (offline)
2. Fill form, take photos (stored locally)
3. Tap "COMPLETE & SAVE"
4. App: "Pending sync... will upload when connected"
5. Status: completed (locally)
6. Later: Connection restored
7. App automatically syncs photos + report
```

---

## Screens

### 1. Auth: Login
**Route:** `/(auth)/login`

```
┌─────────────────────┐
│                     │
│   [CAICOS LOGO]     │
│                     │
│  Email:             │
│  [_____________]    │
│                     │
│  Password:          │
│  [_____________]    │
│                     │
│  ☐ Remember me      │
│                     │
│  [SIGN IN →]        │
│                     │
│  Don't have account?│
│  [Create one]       │
└─────────────────────┘
```

**Behavior:**
- Email + password input
- "Remember me" checkbox → saves email locally
- Error states: invalid credentials, account inactive
- Loading state while authenticating
- Deep link support from invite email

---

### 2. Auth: Register
**Route:** `/(auth)/register`

```
┌─────────────────────┐
│  < Back             │
│  Create Account     │
│                     │
│  Full Name:         │
│  [_____________]    │
│                     │
│  Email:             │
│  [_____________]    │
│                     │
│  Company Invite:    │
│  [_____________]    │
│  (optional - code)  │
│                     │
│  Password:          │
│  [_____________]    │
│                     │
│  Confirm:           │
│  [_____________]    │
│                     │
│  [REGISTER →]       │
│                     │
│  Already have acc?  │
│  [Sign In]          │
└─────────────────────┘
```

**Behavior:**
- Validation: email format, password strength, match
- Company invite code: Optional (for techs joining existing company)
- If owner signup: Creates company automatically
- If invite code: Joins existing company as technician
- Password reset link option
- Terms of service checkbox

---

### 3. Dashboard: Daily Jobs
**Route:** `/(app)/(tabs)/jobs`

```
┌──────────────────────┐
│ ⬅ CAICOS     📋 ⚙️   │
│                      │
│ Tuesday, Feb 21      │
│ 3 jobs assigned      │
│                      │
│ PROGRESS: 0 of 3     │
│ [████░░░░░░░░░░░░]   │
│                      │
│ ┌──────────────────┐ │
│ │ 1  Residencia    │ │
│ │ ── Miller        │ │
│ │ 📍1244 Blue      │ │
│ │ ⏰ 8:30 AM       │ │
│ │ ⌚ 30 min        │ │
│ │ 💧 residential   │ │
│ │ Status: Pending  │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ 2  Henderson     │ │
│ │ ── Pool          │ │
│ │ 📍892 Blue Way   │ │
│ │ ⏰ 10:00 AM      │ │
│ │ ⌚ 45 min        │ │
│ │ 💧 commercial    │ │
│ │ Status: Pending  │ │
│ └──────────────────┘ │
│                      │
│ [scroll...]          │
│                      │
│ Tabs:                │
│ [Jobs]  [Props] [Me] │
└──────────────────────┘
```

**Components:**
- **Header:** Company logo, date, total jobs
- **Progress bar:** X of Y completed
- **Job cards** (tappable):
  - Route order number (left badge)
  - Customer name + property address
  - Scheduled time + estimated duration
  - Pool type icon
  - Status badge (pending/in_progress/completed)
- **Pull-to-refresh:** Syncs latest jobs
- **Empty state:** "No jobs today - Enjoy your day off! 📋"

**Data Source:**
```typescript
// useJobs hook - realtime subscription
const { jobs, isLoading, refresh } = useJobs();
// Returns: ServiceJobWithProperty[]
// Filters: scheduled_date = today, company_id = user.company_id
```

---

### 4. Job Detail: Service Form
**Route:** `/(app)/job/[id]`

```
┌─────────────────────┐
│ < Job #1            │
│                     │
│ ┌─────────────────┐ │
│ │ 🏊 Residencia   │ │
│ │    Miller       │ │
│ │ 1244 Blue Water │ │
│ │ 🔑 Gate: 1234   │ │
│ │ Status: Pending │ │
│ └─────────────────┘ │
│                     │
│ [GREEN START BUTTON]│
│                     │
│ (After START...)    │
│                     │
│ 💧 CHEMICAL READINGS│
│ ─────────────────   │
│ pH: [_____]         │
│ Ideal: 7.2-7.6 pH  │
│                     │
│ Chlorine: [_____]   │
│ Ideal: 1-3 ppm     │
│                     │
│ Alkalinity: [___]   │
│ Ideal: 80-120 ppm  │
│                     │
│ [more fields...]    │
│                     │
│ ✅ TASKS            │
│ ─────────────────   │
│ ☐ Skimmed surface   │
│ ☑ Vacuumed floor    │
│ ☐ Brushed walls     │
│ ☑ Emptied baskets   │
│ ☐ Backwashed filter │
│ ☐ Cleaned filter    │
│                     │
│ 🔧 EQUIPMENT        │
│ ─────────────────   │
│ Pump:               │
│ [OK]  [ISSUE]       │
│ Filter:             │
│ [OK]  [ISSUE]       │
│ [scroll...]         │
│                     │
│ 🧪 CHEMICALS ADDED  │
│ ─────────────────   │
│ Chlorine:           │
│ [_____ (e.g. 2 tabs)│
│ [scroll...]         │
│                     │
│ 📷 PHOTOS           │
│ ─────────────────   │
│ [Camera] [Gallery]  │
│ ┌───┐ ┌───┐         │
│ │   │ │   │ (thumbs)│
│ └───┘ └───┘         │
│                     │
│ 📝 NOTES            │
│ ─────────────────   │
│ [_________________] │
│ [_________________] │
│                     │
│ ⚠️ FOLLOW-UP        │
│ ─────────────────   │
│ ☐ Needed?           │
│                     │
│ [COMPLETE & SAVE]   │
└─────────────────────┘
```

**Sections:**

#### Property Header (Non-editable)
- Customer name + property address
- Gate code (if available)
- Pool type + surface info
- Job status badge

#### Chemical Readings
```typescript
CHEMICAL_READINGS = [
  { key: 'ph_level', label: 'pH', unit: 'pH', idealMin: 7.2, idealMax: 7.6 },
  { key: 'chlorine_level', label: 'Free Chlorine', unit: 'ppm', idealMin: 1, idealMax: 3 },
  { key: 'alkalinity', label: 'Total Alkalinity', unit: 'ppm', idealMin: 80, idealMax: 120 },
  { key: 'calcium_hardness', label: 'Calcium Hardness', unit: 'ppm', idealMin: 200, idealMax: 400 },
  { key: 'cyanuric_acid', label: 'Cyanuric Acid (CYA)', unit: 'ppm', idealMin: 30, idealMax: 100 },
  { key: 'salt_level', label: 'Salt (if saltwater)', unit: 'ppm', idealMin: 2700, idealMax: 3400 },
  { key: 'water_temp_f', label: 'Water Temperature', unit: '°F', idealMin: 78, idealMax: 86 },
];
```

- Numeric text inputs (auto-parse as float)
- Each field shows ideal range below label
- Input with warning color if outside range (🟨 yellow border/bg)
- Placeholder: e.g., "7.5"

#### Service Tasks (Toggles)
```typescript
SERVICE_TASKS = [
  { key: 'skimmed', label: 'Skimmed surface' },
  { key: 'vacuumed', label: 'Vacuumed floor' },
  { key: 'brushed', label: 'Brushed walls & steps' },
  { key: 'emptied_baskets', label: 'Emptied skimmer baskets' },
  { key: 'backwashed', label: 'Backwashed filter' },
  { key: 'cleaned_filter', label: 'Cleaned filter cartridge' },
];
```

- React Native Switch component
- Default: false (unchecked)
- Toggleable by technician

#### Equipment Status
```typescript
EQUIPMENT_CHECKS = [
  { key: 'pump_ok', label: 'Pump' },
  { key: 'filter_ok', label: 'Filter' },
  { key: 'heater_ok', label: 'Heater/Heat Pump' },
  { key: 'cleaner_ok', label: 'Automatic Cleaner' },
];
```

- Two buttons per item: [OK] [ISSUE]
- Default: OK (true)
- Selected state: colored button (green for OK, red for ISSUE)

#### Chemicals Added (Text)
- Chlorine added: e.g., "2 tabs, 1 lb shock"
- Acid added: e.g., "8 oz muriatic"
- Other chemicals: Free text

#### Photos
- **Take Photo:** Launch camera → capture → add to list
- **From Gallery:** Pick up to 5 photos at once
- **Photo thumbnails:** 90x90px, horizontal scroll
- **Remove:** Tap X icon on thumbnail
- **Types:** before | after | issue | equipment | general (dropdown later)

#### Notes (Text Area)
- Free-form text input
- Min height: 80px
- Placeholder: "Service notes, observations, issues..."

#### Follow-up Flag
- Toggle: "Follow-up needed?"
- If enabled: Show text area for follow-up notes
- E.g., "Check heater tomorrow - parts on order"

### Start/Save Flow

**START button (when status = pending):**
1. Disabled form content until START is tapped
2. Tap START → POST to service_jobs, set status = in_progress
3. Form becomes editable
4. Buttons appear: [COMPLETE & SAVE]

**COMPLETE & SAVE button:**
1. Validate: At least 1 chemical reading required
2. Collect form data → build payload
3. POST service_reports table
4. Upload photos: FormData → /report-photos bucket
5. PATCH service_jobs: status = completed
6. Alert "Success!" → router.back()
7. Return to dashboard

**Offline Handling:**
- Use Zustand store to queue pending saves
- On connection restored: Sync queue in order
- Show "Syncing..." indicator

---

## 5. Properties Directory Screen
**Route:** `/(app)/(tabs)/properties`

```
┌──────────────────────┐
│ CAICOS      🔍      │
│                      │
│ Properties (12)      │
│ [All ▼]              │
│                      │
│ ┌──────────────────┐ │
│ │ Residencia Smith │ │
│ │ 1244 Blue Water  │ │
│ │ 💧 Residential   │ │
│ │ 📞 (555) 123-4567│ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ Henderson Pool   │ │
│ │ 892 Blue Sky Way │ │
│ │ 💧 Commercial    │ │
│ │ [View Details →] │ │
│ └──────────────────┘ │
│                      │
│ [scroll...]          │
│                      │
│ Tabs:                │
│ [Jobs] [Props] [Me]  │
└──────────────────────┘
```

**MVP:** Read-only list (no create/edit for technicians)
- Shows all active properties for company
- Tap to view detail page with:
  - Customer info
  - Pool type, surface, equipment notes
  - Address + GPS coordinates
  - Gate code (masked by default, tap to reveal)
- Search by customer name or address

---

## 6. Settings/Profile Screen
**Route:** `/(app)/(tabs)/settings`

```
┌──────────────────────┐
│ CAICOS      ⚙️      │
│                      │
│ Profile              │
│ ┌──────────────────┐ │
│ │  👤 Avatar       │ │
│ │  John Technician │ │
│ │  john@caicos.com │ │
│ │  Role: Technician│ │
│ │  Company: Caicos │ │
│ └──────────────────┘ │
│                      │
│ Full Name:           │
│ [John Technician]    │
│                      │
│ Email:               │
│ [john@caicos.com]    │ (read-only)
│                      │
│ Phone:               │
│ [_______________]    │
│                      │
│ [SAVE CHANGES]       │
│                      │
│ ─────────────────    │
│                      │
│ App Info             │
│ Version: 1.0.0       │
│ Build: 42            │
│                      │
│ [LOGOUT]             │
│ [DELETE ACCOUNT]     │
└──────────────────────┘
```

**Features:**
- Display user profile (read-only fields)
- Edit: phone, avatar
- Version info
- Logout → clear session, return to login
- Delete account → soft delete profile

---

## 7. Data Models & Hooks

### useAuth Hook
```typescript
export function useAuth() {
  return {
    user: User | null,           // auth.user
    profile: Profile | null,      // profiles table row
    isLoading: boolean,
    isAuthenticated: boolean,
    signUp(email, password, fullName): Promise<void>,
    signIn(email, password): Promise<void>,
    signOut(): Promise<void>,
  };
}
```

### useJobs Hook
```typescript
export function useJobs() {
  return {
    jobs: ServiceJobWithProperty[],
    isLoading: boolean,
    refresh(): Promise<void>,
    subscribe(callback): Unsubscribe,  // Realtime updates
  };
}
```

### useJobDetail Hook
```typescript
export function useJobDetail(jobId: string) {
  return {
    job: ServiceJobWithProperty | null,
    report: ServiceReport | null,        // If already completed
    isLoading: boolean,
  };
}
```

### useProperties Hook
```typescript
export function useProperties(filters?: PropertyFilters) {
  return {
    properties: Property[],
    isLoading: boolean,
    refresh(): Promise<void>,
  };
}
```

---

## 8. State Management (Zustand)

```typescript
// useAppStore.ts
interface AppStore {
  // Auth
  user: User | null;
  profile: Profile | null;
  setUser(user): void;
  setProfile(profile): void;

  // Sync queue (offline)
  pendingSyncs: PendingSync[];
  addPending(report, photos): void;
  removePending(id): void;

  // UI
  isOnline: boolean;
  setIsOnline(bool): void;
}

// Listen to network changes
useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    store.setIsOnline(state.isConnected);
    if (state.isConnected) {
      syncPendingReports();  // Auto-sync when reconnected
    }
  });
}, []);
```

---

## 9. API Endpoints / Supabase Operations

### Authentication
```
POST /auth/signup
POST /auth/signin
POST /auth/signout
POST /auth/refresh
```

### Jobs
```
GET /service_jobs?company_id={id}&scheduled_date={date}
PATCH /service_jobs/{id}  (update status)
```

### Service Reports
```
POST /service_reports  (create report)
PATCH /service_reports/{id}  (update report)
GET /service_reports/{id}
```

### Photos
```
POST /storage/report-photos/{path}  (upload)
GET /storage/report-photos/{path}  (download)
```

---

## 10. Offline Support (MVP)

**Scope:** Basic offline job view + queued reports

```typescript
// When offline:
- ✅ View cached jobs (last synced)
- ✅ View cached properties
- ✅ Fill out service form
- ✅ Take photos (stored locally)
- ✅ Queue report for sync

// When online:
- ✅ Auto-sync queued reports
- ✅ Auto-sync photos
- ✅ Show toast "Synced X reports"
```

**Implementation:**
- Use SQLite (expo-sqlite) for local cache
- AsyncStorage for queue
- Background sync task (expo-task-manager)

---

## 11. Error Handling

| Scenario | Behavior |
|----------|----------|
| Login fails | Show error message, allow retry |
| Network timeout | Queue operation, retry when online |
| Photo upload fails | Show retry button, keep report draft |
| Validation fails | Highlight invalid fields, show error |
| Session expired | Auto-refresh token or redirect to login |
| RLS permission denied | Show generic error (don't expose RLS) |

---

## 12. Testing Strategy

- Unit tests: Hooks, utils, validation
- E2E tests: Full job completion flow
- Manual testing:
  - Offline job completion
  - Photo upload
  - Multi-technician sync
  - Profile editing

---

## 13. Accessibility

- Text contrast: WCAG AA minimum
- Touch targets: 44x44px minimum
- Screen reader support (React Native accessibility)
- Font scaling: Support system text size settings

---

**Status:** Detailed spec ready for development

*Feature owner: Technician mobile app team*
