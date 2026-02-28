# CAICOS Platform - Development Checklist

**Last Updated:** 2026-02-28
**Project:** Admin Portal + Technician Mobile App
**Status:** Development In Progress - MVP Phase

---

## 📊 Progress Summary

### Technician Mobile App
**Completion: ~60-70% of MVP**

✅ **Completed:**
- Authentication flows (login, register with invite code support)
- Daily jobs dashboard with progress tracking
- Service form with chemical readings, tasks, equipment status
- Photo capture & gallery management
- Service report submission to database
- Photo upload to Supabase Storage
- Properties directory (read-only list view)
- User profile settings (full name, email, logout)
- Pull-to-refresh for jobs list
- Deep linking support for invite codes
- Location permission requests & distance checking

⏳ **In Progress / Partial:**
- GPS metadata embedding in photos (permission logic done, EXIF not done)
- Photo validation (structure in place, final checks needed)
- Issue category buttons (UI component pending)
- Chemicals added fields (form structure pending)

❌ **Not Started:**
- Offline support (queue, sync, local caching)
- Real-time updates (Supabase Realtime subscriptions)
- Session persistence / auto-login
- Network status detection
- State management (Zustand store)
- Properties detail view
- Phone number editing

### Admin Portal
**Status:** Not scanned - appears to be at different stage
*Note: This scan focused on technician app. Admin portal needs separate review.*

---

## Core Infrastructure & Setup

### Database & Backend
- [x] Supabase PostgreSQL database setup
- [x] User authentication schema (auth.users)
- [x] User profiles table (caicos_profiles)
- [x] Company/organization management tables (caicos_companies)
- [x] Row-level security (RLS) policies (in place for data isolation)
- [x] Service jobs table with status tracking (caicos_service_jobs)
- [x] Service reports table with photo references (caicos_service_reports)
- [x] Properties/houses inventory table (caicos_properties)
- [x] Routes management table (caicos_routes)
- [x] Team members & roles table (caicos_team_members)
- [x] Invite codes & token management (RPC-based with get_invite_code_payload)
- [ ] Error handling & logging infrastructure

### API Infrastructure
- [x] Supabase client setup (lib/supabase.ts with createBrowserClient)
- [x] Authentication handled via Supabase Auth client
- [ ] Jobs API routes - currently direct Supabase queries
- [ ] Properties API routes - currently direct Supabase queries
- [ ] Team API routes - currently direct Supabase queries
- [ ] Reports API routes - currently direct Supabase queries
- [ ] Companies API routes - currently direct Supabase queries
- [x] Real-time subscription setup (available via Supabase Realtime)
- [x] File upload infrastructure (Supabase Storage - report-photos bucket)

### Storage & Media
- [x] Photo storage bucket configuration (report-photos bucket with path structure)
- [ ] GPS metadata handling (location verified but not embedded in EXIF yet)
- [ ] Photo compression pipeline (expo-image-picker quality: 0.7)
- [ ] Thumbnail generation for galleries
- [ ] Photo deletion & cleanup policies

---

## Admin Portal (NextJS Web App)

### Authentication Pages
- [ ] `/auth/login` - Email/password login
  - [ ] Remember me checkbox
  - [ ] Forgot password link
  - [ ] Error state handling
  - [ ] Loading states

- [ ] `/auth/register` - Company owner signup
  - [ ] Name, email, password fields
  - [ ] Company name input
  - [ ] Password confirmation validation
  - [ ] Terms of service checkbox
  - [ ] Link to login page

### Dashboard & Navigation
- [ ] `/dashboard` - Main overview page
  - [ ] Today's summary KPI cards (jobs, completion %, pending, active techs)
  - [ ] Recent jobs list with status
  - [ ] Quick action buttons (create job, property, invite tech)
  - [ ] Navigation sidebar with all main sections
  - [ ] Header with company name, date, user profile

### Routes Management
- [ ] `/routes` - List all routes
  - [ ] Display route name, pool count, assigned technician
  - [ ] Status indicators (active/inactive)
  - [ ] Create route button
  - [ ] Edit/delete route actions

- [ ] `/routes/new` - Create route modal/page
  - [ ] Route name input
  - [ ] Technician dropdown (single select)
  - [ ] Searchable pool multi-select
  - [ ] Pool count display
  - [ ] Save & cancel buttons

- [ ] `/routes/[id]` - Route detail view
  - [ ] Route details display
  - [ ] Pool list for this route
  - [ ] Edit & delete buttons
  - [ ] Daily activity summary (completion stats)

### Jobs Management
- [ ] `/jobs` - List all jobs
  - [ ] Date range filter
  - [ ] Technician filter
  - [ ] Status filter
  - [ ] Job cards with property, tech, time, status
  - [ ] View report, edit, delete actions
  - [ ] Pagination (100 per page)
  - [ ] Create job button

- [ ] `/jobs/new` - Create job modal/page
  - [ ] Property dropdown (searchable)
  - [ ] Technician dropdown
  - [ ] Date picker
  - [ ] Time picker
  - [ ] Duration input (default 30 min)
  - [ ] Route order input
  - [ ] Optional notes field
  - [ ] Save & cancel buttons

- [ ] `/jobs/[id]` - Job detail with service report
  - [ ] Job header (job number, property, address, gate code)
  - [ ] Technician assignment display
  - [ ] Status badge
  - [ ] Service report section
    - [ ] Chemical readings display (pH, chlorine, alkalinity, etc.)
    - [ ] Equipment status (pump, filter, heater, cleaner)
    - [ ] Tasks completed (checklist display)
    - [ ] Chemicals added
    - [ ] Photo gallery with timestamps
    - [ ] Service notes
    - [ ] Follow-up flag (if marked)
  - [ ] Edit, print, delete buttons
  - [ ] Export to PDF option

### Properties Management
- [ ] `/properties` - List all properties
  - [ ] Search by customer name or address
  - [ ] Status filter (active/inactive)
  - [ ] Pool type filter
  - [ ] Surface type filter
  - [ ] Bulk import from CSV
  - [ ] Create property button
  - [ ] Property cards with key info
  - [ ] Edit, view jobs, delete actions

- [ ] `/properties/[id]` - Property detail
  - [ ] Customer info (name, email, phone)
  - [ ] Address & location
  - [ ] Pool type & surface details
  - [ ] Equipment notes
  - [ ] Gate code (displayed)
  - [ ] Custom notes
  - [ ] Status indicator
  - [ ] Service history section
  - [ ] Next scheduled service
  - [ ] Last service details
  - [ ] View all jobs button
  - [ ] Edit & delete buttons

- [ ] `/properties/new` - Create property modal/page
  - [ ] Customer name input
  - [ ] Email input
  - [ ] Phone input
  - [ ] Address fields (street, city, state, ZIP)
  - [ ] Pool type dropdown
  - [ ] Surface type dropdown
  - [ ] Equipment notes textarea
  - [ ] Gate code input
  - [ ] Other notes textarea
  - [ ] Create & cancel buttons

### Team Management
- [ ] `/team` - List all team members
  - [ ] Grouped by role (Owner, Admins, Technicians)
  - [ ] Member cards with email, role, status, join date, stats
  - [ ] Edit profile & view profile actions
  - [ ] Invite technician button

- [ ] `/team/new` - Invite technician modal
  - [ ] Email input
  - [ ] Full name input
  - [ ] Role selector (default: Technician)
  - [ ] Auto-generated invite link display
  - [ ] Copy link button
  - [ ] Instructions text
  - [ ] Send invite & close buttons
  - [ ] Invite code generation & storage
  - [ ] 7-day expiration logic

- [ ] `/team/[id]` - Team member detail
  - [ ] Profile info (name, email, phone, role, status)
  - [ ] Join date display
  - [ ] Statistics (jobs completed, avg rating)
  - [ ] Last job info
  - [ ] Status toggle (activate/deactivate)
  - [ ] Change role dropdown
  - [ ] Remove from team button
  - [ ] Edit button

### Reports & Analytics
- [ ] `/reports` - Service reports list
  - [ ] Date range filter
  - [ ] Technician filter
  - [ ] Property filter
  - [ ] Search by customer name
  - [ ] Report cards with date, property, tech, status
  - [ ] View detail & download PDF actions
  - [ ] Pagination (100 per page)
  - [ ] Export selected reports option

- [ ] `/reports/[id]` - Service report detail
  - [ ] Full report display (same as job detail)
  - [ ] Photo gallery with GPS & timestamps
  - [ ] Chemical readings
  - [ ] Equipment status
  - [ ] Tasks completed
  - [ ] Chemicals added
  - [ ] Issue category (if any)
  - [ ] Service notes & follow-up notes
  - [ ] Export to PDF button
  - [ ] Download photos option

- [ ] `/reports/weekly-completion` - Weekly payroll report
  - [ ] Technician dropdown filter
  - [ ] Week selector
  - [ ] Route display
  - [ ] Pool assignment count
  - [ ] Completion percentage & progress bar
  - [ ] Completed vs pending count
  - [ ] Pool detail table (pool #, status, issue category)
  - [ ] Filter toggle (All/Completed/Pending)
  - [ ] View photos option per pool
  - [ ] Approve for payroll button
  - [ ] Hold/review button
  - [ ] Export to PDF for payroll processing

### Settings & Administration
- [ ] `/settings` - Company settings
  - [ ] Company logo upload
  - [ ] Company name edit
  - [ ] Email edit
  - [ ] Phone edit
  - [ ] Address edit
  - [ ] Save changes button
  - [ ] Subscription info display (plan, cost, next billing date)
  - [ ] Manage billing link
  - [ ] Account section (email, password change, 2FA toggle)
  - [ ] Danger zone: Delete company & data (owner only)

### Core Components & Utilities
- [ ] Form handling (React Hook Form integration)
- [ ] Data fetching (TanStack Query setup & hooks)
- [ ] Global state management (Zustand store)
- [ ] Authentication context/hooks
- [ ] Role-based access control logic
- [ ] Error boundary component
- [ ] Loading spinner components
- [ ] Toast notification system
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Tailwind CSS setup & theming
- [ ] Shadcn/ui component library integration
- [ ] Chart/graph components (Recharts for analytics)

### Admin Portal Hooks (Custom React Hooks)
- [ ] `useAuth` - Authentication context hook
- [ ] `useCompany` - Company data & operations
- [ ] `useJobs` - Jobs CRUD operations
- [ ] `useProperties` - Properties CRUD operations
- [ ] `useTeam` - Team member management
- [ ] `useReports` - Service reports fetching & filtering
- [ ] `useRoutes` - Routes CRUD operations
- [ ] Real-time subscription hooks (for live updates)

---

## Technician Mobile App (React Native/Expo)

### Authentication Flows
- [x] `/(auth)/login` - Technician login
  - [x] Email input field
  - [x] Password input field
  - [ ] Remember me checkbox
  - [x] Sign in button
  - [x] Create account link
  - [x] Error state handling
  - [x] Loading state during authentication
  - [ ] Deep link support from invite emails

- [x] `/(auth)/register` - Technician registration
  - [x] Full name input
  - [x] Email input
  - [x] Company invite code input (optional)
  - [x] Password input
  - [x] Password confirm input
  - [ ] Terms of service checkbox
  - [x] Register button
  - [x] Sign in link
  - [x] Form validation (email format, password strength, match)
  - [x] Owner auto-company-creation logic (if no invite code)
  - [x] Invite code validation & company assignment (via RPC)
  - [x] Back button

### Daily Route Dashboard
- [x] `/(app)/(tabs)/jobs` - Daily job list
  - [x] Header with date display
  - [ ] Route name display ("Ruta 1")
  - [ ] "(Same route daily)" subtitle
  - [x] Progress display (X of Y completed)
  - [ ] Progress bar visualization
  - [x] House/pool cards with:
    - [ ] House/pool number (prominent)
    - [x] Customer name
    - [x] Address
    - [x] Status badge (pending/in_progress/completed)
    - [x] Start service button (tappable card)
  - [x] Pull-to-refresh functionality
  - [x] Tab navigation (Jobs / Properties / Me)
  - [ ] Realtime updates (via subscription)
  - [x] Empty state message (if no houses assigned)

### Service Form & Job Completion
- [x] `/(app)/job/[id]` - Service form & completion
  - [x] **Property Header Section**
    - [x] Customer/property name display
    - [x] Address display
    - [x] Gate code display
    - [ ] Pool type & surface info
    - [x] Status badge

  - [x] **START Button** (when pending)
    - [x] Triggers form editing mode
    - [x] Marks job as in_progress

  - [x] **Chemical Readings Section**
    - [x] pH level input (7 readings total)
    - [x] Free chlorine input with ideal range
    - [x] Total alkalinity input
    - [x] Calcium hardness input
    - [x] Cyanuric acid (CYA) input
    - [x] Salt level input (if saltwater)
    - [x] Water temperature input
    - [ ] Visual warning for out-of-range values

  - [x] **Service Tasks Section**
    - [x] Skimmed surface toggle
    - [x] Vacuumed floor toggle
    - [x] Brushed walls & steps toggle
    - [x] Emptied skimmer baskets toggle
    - [x] Backwashed filter toggle
    - [x] Cleaned filter cartridge toggle

  - [x] **Equipment Status Section**
    - [x] Pump [OK] [ISSUE] buttons
    - [x] Filter [OK] [ISSUE] buttons
    - [x] Heater/heat pump [OK] [ISSUE] buttons
    - [x] Automatic cleaner [OK] [ISSUE] buttons

  - [x] **Chemicals Added Section**
    - [ ] Chlorine added input (e.g., "2 tabs")
    - [ ] Acid added input (e.g., "8 oz muriatic")
    - [ ] Other chemicals input (free text)

  - [x] **Photos Section**
    - [x] Camera launch button
    - [x] Gallery picker button
    - [x] Photo thumbnails (horizontal display)
    - [ ] GPS + timestamp auto-capture (structured in metadata)
    - [ ] Visual indicator showing GPS & timestamp captured
    - [x] Remove photo (removes from array)
    - [ ] Up to 5 photos max per house (currently unlimited)
    - [ ] Auto-embed GPS in EXIF metadata
    - [ ] Auto-embed timestamp in EXIF metadata

  - [ ] **Issue Category Section**
    - [ ] No Issues button (default)
    - [ ] Motor problem button
    - [ ] Filter needs change button
    - [ ] Circulation issue button
    - [ ] Timer issue button
    - [ ] Chemistry problem button
    - [ ] Other button (shows text input)
    - [ ] Single select behavior (only one active)
    - [ ] Highlighted selected state

  - [x] **Comments Section**
    - [x] Free-form text input (notes field)
    - [x] Optional field

  - [x] **Follow-up Notes Section**
    - [x] Optional text input
    - [x] Conditional display (when follow_up_needed toggled)

  - [x] **MARK COMPLETE Flow**
    - [ ] Validation: At least 1 photo required
    - [ ] Validation: Issue category selected
    - [ ] Validation: GPS + timestamp in photo
    - [x] Collect all form data
    - [x] POST to service_reports table
    - [x] Upload photos to /report-photos bucket
    - [x] PATCH service_jobs status to completed
    - [ ] Success confirmation message
    - [x] Return to jobs list (navigation back)
    - [ ] Progress bar updates

  - [ ] **Offline Support**
    - [ ] Queue reports when offline
    - [ ] Store photos locally
    - [ ] Show "Pending sync" indicator
    - [ ] Auto-sync when connection restored
    - [ ] Show "Syncing... X reports pending"

  - [x] Back button to jobs list

### Properties Directory
- [x] `/(app)/(tabs)/properties` - Read-only property list
  - [ ] Search bar (by customer name or address)
  - [ ] Status filter dropdown (All/Active/Inactive)
  - [x] Properties count display
  - [x] Property cards with:
    - [x] Customer name
    - [x] Address
    - [ ] Pool type icon
    - [ ] Phone number
    - [ ] View details link

- [ ] Property detail view
  - [ ] Customer info (name, phone, email)
  - [ ] Full address with ZIP
  - [ ] Pool type & surface
  - [ ] Equipment notes
  - [ ] Gate code (masked, tap to reveal)
  - [ ] GPS coordinates
  - [ ] Custom notes
  - [ ] Back button

- [x] Tab navigation (Jobs / Properties / Me)

### Profile & Settings
- [x] `/(app)/(tabs)/settings` - User profile & settings
  - [ ] Avatar display
  - [ ] User name display
  - [x] Email display
  - [ ] Role display (Technician)
  - [ ] Company name display

  - [x] Editable Fields
    - [x] Full name input
    - [ ] Phone number input
    - [x] Save changes button

  - [ ] App Info Section
    - [ ] Version display (e.g., 1.0.0)
    - [ ] Build number display

  - [x] Actions
    - [x] Logout button (clears session)
    - [ ] Delete account button (soft delete)

  - [x] Tab navigation (Jobs / Properties / Me)

### Mobile-Specific Features
- [x] Camera integration (photo capture)
  - [x] Launch native camera
  - [ ] Capture with GPS auto-embed (permission logic in place, needs EXIF integration)
  - [ ] Timestamp auto-embed (EXIF)
  - [x] Camera permissions handling
  - [x] Camera error handling

- [x] GPS Integration
  - [x] Location permission request (for distance checking before START)
  - [x] Get current location (latitude, longitude)
  - [ ] Embed in photo EXIF metadata
  - [x] Permission denial handling

- [ ] Network Status
  - [ ] Detect online/offline state
  - [ ] Listen to network changes
  - [ ] Auto-sync on reconnection
  - [ ] Show sync status indicator

- [ ] Deep Linking
  - [x] Handle invite email links (code parameter parsed in register)
  - [x] Route to register with company context
  - [x] Parse invite token from URL

- [ ] Session Persistence
  - [ ] Cache login credentials (securely)
  - [ ] Auto-login on app launch
  - [ ] Maintain session across app restarts

- [x] Pull-to-Refresh
  - [x] Refresh job list (implemented with RefreshControl)
  - [ ] Refresh properties list
  - [ ] Sync latest data from server

### Technician App Hooks & State Management
- [x] Authentication implemented via Supabase directly
  - [x] User object (via supabase.auth.getUser())
  - [x] Sign up function (supabase.auth.signUp with metadata)
  - [x] Sign in function (supabase.auth.signInWithPassword)
  - [x] Sign out function (supabase.auth.signOut)
  - [x] Loading state
  - [x] Error state & error handling

- [x] Jobs management implemented directly in screens
  - [x] Fetch jobs from caicos_service_jobs table
  - [x] Filter by technician_id & scheduled_date
  - [x] Loading state
  - [x] Refresh function (onRefresh in FlatList)
  - [ ] Real-time subscription (Supabase Realtime)

- [x] Job detail implemented in job/[id].tsx
  - [x] Job object loading & display
  - [ ] Service report (if completed)
  - [x] Loading state

- [x] Properties fetching implemented in properties.tsx
  - [x] Properties array
  - [x] Loading state
  - [ ] Filtering support (basic filtering to is_active=true)
  - [ ] Refresh function

- [ ] Zustand Store (`useAppStore`) - Not yet implemented
  - [ ] User state
  - [ ] Profile state
  - [ ] Pending syncs queue (offline)
  - [ ] Online/offline state
  - [ ] Photo cache management

### Offline Support Implementation
- [ ] SQLite local database (expo-sqlite)
  - [ ] Cache today's jobs
  - [ ] Cache properties list
  - [ ] Store photos locally

- [ ] AsyncStorage for queue
  - [ ] Queue pending reports
  - [ ] Queue pending photo uploads
  - [ ] Persist queue on app restart

- [ ] Background sync task (expo-task-manager)
  - [ ] Detect connection restored
  - [ ] Auto-sync queued reports
  - [ ] Auto-upload queued photos
  - [ ] Show sync status indicator
  - [ ] Handle sync errors

- [ ] Offline Validation
  - [ ] Allow form filling when offline
  - [ ] Validate before queueing
  - [ ] Show errors for invalid data

### Technician App Components
- [ ] Navigation setup (Tab & Stack navigation)
- [ ] Loading spinner component
- [ ] Error message component
- [ ] Success confirmation component
- [ ] Camera button component
- [ ] Photo gallery component
- [ ] Issue category button set
- [ ] Chemical reading input with range indicators
- [ ] Task toggle component
- [ ] Equipment status button pair
- [ ] Progress bar component
- [ ] Sync status indicator
- [ ] Empty state screens
- [ ] Error boundary

---

## Cross-Feature Integration

### Real-time Synchronization
- [ ] Admin dashboard updates when technician completes jobs
- [ ] Technician app receives job assignments from admin
- [ ] Service reports appear in admin portal immediately
- [ ] Photo galleries load in real-time

### Authentication & Authorization
- [ ] Owner can create company during signup
- [ ] Owner can invite technicians via email
- [ ] Technician can accept invite & join company
- [ ] RLS policies enforce company_id isolation
- [ ] Role-based access control (Owner/Admin/Technician)
- [ ] Technician cannot access other companies' data
- [ ] Admin cannot see owner-only features

### Photo & Report Flow
- [ ] Technician captures photos with GPS + timestamp
- [ ] Photos upload to Supabase Storage
- [ ] Admin views photos in reports
- [ ] Export reports include all photos
- [ ] Photo galleries paginate efficiently
- [ ] GPS data displays in maps (if applicable)

### Offline-to-Online Sync
- [ ] Technician queues reports while offline
- [ ] App auto-syncs when connection restored
- [ ] Admin sees reports after sync completes
- [ ] Photos sync with correct metadata
- [ ] Queue persists across app restarts
- [ ] Sync status visible to technician

### Job Flow
- [ ] Admin creates jobs (manually or via routes)
- [ ] Technician app displays assigned jobs
- [ ] Technician marks job complete with service report
- [ ] Admin sees completion & can view service report
- [ ] Admin can approve for payroll

---

## Testing & Quality Assurance

### Unit Tests
- [ ] Authentication logic (sign up, sign in, sign out)
- [ ] Form validation (all forms)
- [ ] Data transformation & parsing
- [ ] Permission checks (RLS simulation)
- [ ] Utility functions
- [ ] Hook logic (custom React/React Native hooks)
- [ ] Zustand store mutations
- [ ] Offline sync queue logic

### Integration Tests
- [ ] Full authentication flow (register → login → auth)
- [ ] Complete job creation flow (admin → technician → completion)
- [ ] Photo upload & retrieval
- [ ] Real-time updates (Supabase subscriptions)
- [ ] Offline queue & auto-sync
- [ ] Role-based access (different user types)

### End-to-End Tests
- [ ] Owner signup & company creation
- [ ] Technician invite & registration
- [ ] Route creation & job generation
- [ ] Full service job completion (start → form → photos → complete)
- [ ] Service report approval & payroll generation
- [ ] Offline job completion & sync

### Manual Testing Scenarios
- [ ] Owner initial setup journey
- [ ] Admin daily monitoring workflow
- [ ] Technician completes service (online)
- [ ] Technician completes service (offline, then sync)
- [ ] Multi-technician routes with real-time updates
- [ ] Weekly payroll report generation
- [ ] Mobile app camera & GPS capture
- [ ] Deep link invite flow
- [ ] Session persistence & auto-login
- [ ] Permission denied errors (RLS violations)

### Admin Portal Testing
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] All forms validate correctly
- [ ] Pagination works on all lists
- [ ] Search & filters work correctly
- [ ] Export to PDF functionality
- [ ] Real-time updates from technician app
- [ ] Image loading & compression
- [ ] Error states & recovery

### Technician App Testing
- [ ] Camera integration & GPS capture
- [ ] Photo gallery with remove option
- [ ] Form validation before submission
- [ ] Offline photo/report queueing
- [ ] Auto-sync on connection restored
- [ ] Deep link opens invite correctly
- [ ] Session persistence across restarts
- [ ] Pull-to-refresh works
- [ ] All touch targets (44x44px minimum)
- [ ] Text contrast & accessibility

### Performance Testing
- [ ] Dashboard load time (< 2s)
- [ ] Job list pagination (< 500ms per page)
- [ ] Photo gallery load time
- [ ] Real-time update latency (< 1s)
- [ ] Offline queue processing time
- [ ] Mobile app startup time
- [ ] Memory usage (especially with photos)
- [ ] Database query performance

---

## Documentation & Deployment

### Documentation
- [ ] API documentation (endpoints, parameters, responses)
- [ ] Database schema documentation
- [ ] Authentication flow diagrams
- [ ] Deployment guide
- [ ] Environment variables reference
- [ ] Troubleshooting guide
- [ ] User manuals (Admin, Technician)

### Deployment Preparation
- [ ] Environment variables setup (.env files)
- [ ] Database migrations & initial schema
- [ ] Storage bucket policies & CORS setup
- [ ] Email service configuration (for invites)
- [ ] SMS service configuration (optional, for invites)
- [ ] Error logging & monitoring setup
- [ ] Performance monitoring setup
- [ ] Analytics setup (if applicable)

### Admin Portal Deployment
- [ ] Next.js build optimization
- [ ] Production environment setup
- [ ] CDN configuration
- [ ] Domain & SSL certificate setup
- [ ] Automatic backups
- [ ] Monitoring & alerting

### Technician App Deployment
- [ ] Expo build (iOS & Android)
- [ ] App Store submission (iOS)
- [ ] Google Play Store submission (Android)
- [ ] Version numbering & release notes
- [ ] OTA update setup (if using Expo)
- [ ] Crash reporting & monitoring
- [ ] Analytics tracking

### Post-Launch
- [ ] Beta testing with real users
- [ ] Feedback collection & bug fixes
- [ ] Performance optimization
- [ ] Security audit
- [ ] Accessibility audit (WCAG AA)
- [ ] User onboarding & training materials
- [ ] Support documentation & FAQs

---

## Recommendations for Next Steps

### Critical Path for MVP Completion (Technician App)

1. **Photo Metadata & Validation** (2-3 hours)
   - Embed GPS coordinates in photo EXIF metadata using `expo-image-picker` hooks
   - Embed timestamp in EXIF metadata
   - Add validation that photos have required GPS + timestamp before submission
   - Implement 5-photo limit per job
   - Add visual indicator when photo is valid (GPS + timestamp present)

2. **Issue Category & Chemicals** (1-2 hours)
   - Implement issue category button set (No Issues, Motor, Filter, etc.)
   - Add conditional "Other" text input for custom issues
   - Add "Chemicals Added" text fields (chlorine, acid, other)
   - Validation: ensure issue category is selected before complete

3. **Offline Support** (3-4 hours) - MVP Optional but Important
   - Implement Zustand store for state management
   - Add queue for pending reports (AsyncStorage)
   - Store photos locally until synced
   - Detect network connection changes (expo-network or react-native-netinfo)
   - Auto-sync queued reports when connection restored
   - Show sync status indicator in UI

4. **Real-time Updates** (2-3 hours)
   - Add Supabase Realtime subscriptions to jobs list
   - Update UI when admin creates new jobs
   - Refresh progress when other jobs are completed

5. **Session Persistence** (1 hour)
   - Cache session token securely
   - Auto-login on app launch if session valid
   - Handle token refresh

### Quality & Polish

- **Validation Messages:** Add specific error messages for all form validations
- **Loading States:** Improve loading indicators across all async operations
- **Error Handling:** Graceful error messages for network failures, permission denials
- **GPS Display:** Show distance to property before START (currently shown, good!)
- **UI Polish:** Add progress bar visualization, improve spacing/styling
- **Testing:** Add unit tests for validation logic, E2E tests for job flow

### Medium-Term (v1.1)

- Properties detail view with full information
- Phone number editing in settings
- Avatar/profile picture support
- Service history view on job detail
- Photos before/after comparison
- Real-time notifications

---

## Priority & Dependencies

### Phase 1: MVP Core (Minimum Viable Product)
**Must have for v1.0:**
- Core infrastructure (DB, Auth, APIs)
- Admin: Authentication, Dashboard, Routes, Jobs, Reports
- Technician: Auth, Daily jobs list, Service form, Photo capture, Offline support
- Integration: Job creation → Technician sees → Completes → Admin approves

### Phase 2: Enhancements
**Nice to have for v1.1:**
- Admin: Property bulk import, Advanced analytics
- Technician: Properties directory, Profile editing
- Real-time updates & live notifications

### Phase 3: Polish
**Optimization & quality:**
- Performance optimization
- UI/UX refinements
- Comprehensive testing
- Documentation
- Accessibility improvements

---

## Notes

- **Key Dependency:** Core infrastructure (DB + Auth) must be done first
- **Parallel Work:** Admin portal & technician app can be built in parallel after core infra
- **Testing:** Should start early & continue throughout development
- **Real-time Features:** Supabase Realtime subscriptions critical for live updates
- **Offline:** Crucial for field technician experience
- **Mobile-First:** Technician app should prioritize mobile UX/performance

---

**Repository:** [Link to GitHub/GitLab repo if applicable]
**Slack Channel:** [Link to team Slack channel if applicable]
**Jira/Project Board:** [Link to issue tracking if applicable]
