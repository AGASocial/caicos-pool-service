# Working Directory Guide & Current Implementation Status

## Folder Structure Overview

```
/sessions/adoring-youthful-wozniak/mnt/caicos/
├── admin-portal/                    # Next.js web app for admins
│   ├── src/
│   │   ├── app/                    # Next.js pages (routes)
│   │   ├── components/             # Reusable UI components
│   │   ├── lib/                    # Utilities & helpers
│   │   ├── models/                 # Data models
│   │   └── context/                # React context
│   ├── public/                     # Static assets
│   ├── package.json                # Dependencies
│   └── node_modules/               # Installed packages
│
├── technician-app/                  # Expo/React Native mobile app
│   ├── app/                        # Expo Router pages
│   │   ├── (app)/(tabs)/           # Tabbed navigation
│   │   ├── (app)/job/              # Job detail screens
│   │   └── (auth)/                 # Auth screens
│   ├── components/                 # Reusable components
│   ├── lib/                        # Utilities
│   ├── constants/                  # Color, strings, config
│   ├── assets/                     # Images, icons
│   ├── package.json
│   └── node_modules/
│
├── docs/                           # Business documentation & WhatsApp chats
├── FEATURE-ADMIN-PORTAL.md         # ✅ Updated spec (Feb 28)
├── FEATURE-TECHNICIAN-APP.md       # ✅ Updated spec (Feb 28)
├── IMPLEMENTATION-ROADMAP.md       # Implementation guide
├── BUSINESS-LOGIC-ANALYSIS.md      # Gap analysis
└── SPEC-UPDATES-SUMMARY.md         # Change summary
```

## How to Work with Folders

### Option 1: Work on Admin Portal
```bash
cd /sessions/adoring-youthful-wozniak/mnt/caicos/admin-portal
npm install    # If needed
npm run dev    # Start development server
```
Key files to check:
- `src/app/[locale]/(dashboard)/` — Dashboard pages
- `src/components/` — UI components
- `src/lib/` — API and database utilities

### Option 2: Work on Technician App
```bash
cd /sessions/adoring-youthful-wozniak/mnt/caicos/technician-app
npm install    # If needed
npm run start  # or `npx expo start`
```
Key files to check:
- `app/(app)/(tabs)/` — Main navigation screens
- `app/(app)/job/[id].tsx` — Job detail screen
- `components/` — Reusable UI components

### Option 3: Work on Documentation
Read and update the feature specs:
- `/sessions/adoring-youthful-wozniak/mnt/caicos/FEATURE-ADMIN-PORTAL.md`
- `/sessions/adoring-youthful-wozniak/mnt/caicos/FEATURE-TECHNICIAN-APP.md`

## Current Implementation Status

### ✅ Completed
- Both projects are initialized and scaffolded
- Authentication flow (login/register) in admin portal
- Tab-based navigation in technician app
- Database context in admin portal
- Component structure for both apps

### ⚠️ Needs Update to Match New Specs

#### Admin Portal Updates Needed:
1. **Routes Management Pages** (NEW)
   - `/[locale]/(dashboard)/routes/` — List view with CRUD
   - `/[locale]/(dashboard)/routes/[id]/` — Edit/detail view
   - Create route, assign pools, assign technician

2. **Weekly Completion Report** (NEW)
   - `/[locale]/(dashboard)/reports/weekly-completion/` — Report view
   - Select technician + date range
   - Show X of Y pools completed
   - Filter by completion status
   - [Approve for Payroll] button

3. **Technicians Page** (Needs Update)
   - Current: Basic technician list
   - Needed: Show routes assigned to each technician

4. **Pool/House Directory** (Needs Update)
   - Current: Likely exists as "beneficiaries" or similar
   - Needed: Must allow assignment to routes

#### Technician App Updates Needed:
1. **Dashboard Screen** (Major Update)
   - Current: Shows "3 jobs scheduled"
   - Needed: Show route name ("Ruta 1 • 22 pools assigned")
   - Replace time-based schedule with house list
   - Show "(Same route daily)" indicator

2. **Service Form** (Major Update)
   - Current: Unknown current implementation
   - Needed: 7 issue category buttons (No Issues, Motor, Filter, Circulation, Timer, Chemistry, Other)
   - Photos must capture GPS + timestamp auto-capture
   - Simplified form: Photo + Issue Category (required), Comments (optional)
   - Remove chemical reading fields

3. **Job Screen** (Update)
   - Current: `app/(app)/job/[id].tsx` exists
   - Needed: Align with new service form structure
   - Add issue category button set
   - Add GPS validation

4. **Offline Support** (NEW)
   - Queue reports locally when offline
   - Auto-sync when connection returns
   - Show sync status indicator

## Next Steps

### Phase 1: Code Alignment (Current)
- [x] Update feature specifications ✅ Done Feb 28
- [ ] Review existing components for gaps
- [ ] Create component checklist

### Phase 2: Feature Implementation
- [ ] Build Routes Management (admin-portal)
- [ ] Build Weekly Completion Report (admin-portal)
- [ ] Update Technician Dashboard (technician-app)
- [ ] Implement Issue Category buttons (technician-app)
- [ ] Add GPS + timestamp capture (technician-app)

### Phase 3: Integration & Testing
- [ ] Backend integration (Supabase)
- [ ] End-to-end testing
- [ ] Offline sync testing

## Helpful Commands

**Admin Portal:**
```bash
# Start development server
cd admin-portal && npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Check code coverage
npm run test:coverage
```

**Technician App:**
```bash
# Start Expo
cd technician-app && npx expo start

# Build for iOS
npx expo build:ios

# Build for Android
npx expo build:android

# Clear cache and rebuild
npx expo start --clear
```

## Key Implementation Notes

### Routes vs Jobs
- **Old Model**: Admin creates ad-hoc jobs daily → Technician sees jobs scheduled for today
- **New Model**: Admin creates routes once, assigns pools to routes, assigns technician to route → Technician sees same route daily with all assigned pools

### Issue Categories
These are required buttons in the service form:
1. ✓ No Issues (default)
2. ⚠️ Motor problem
3. ⚠️ Filter needs change
4. ⚠️ Circulation issue
5. ⚠️ Timer issue
6. ⚠️ Chemistry problem
7. 📝 Other (free-text field)

### GPS + Timestamp
- Must be captured automatically from device
- Should be stored in EXIF metadata of photos
- UI should show "📍 GPS captured" and "🕐 Timestamp: HH:MM:SS"
- Validation: No photo submission without GPS data

### Payroll Reporting
- Admin selects technician + week date range
- Shows: "X of Y pools completed" with percentage
- Filter by: Completed, Pending, or All
- Approval workflow: [Approve for Payroll] button marks week as approved

## Files to Review First

Start by reviewing these in order:
1. **FEATURE-ADMIN-PORTAL.md** — Understand admin requirements
2. **FEATURE-TECHNICIAN-APP.md** — Understand technician requirements
3. **IMPLEMENTATION-ROADMAP.md** — See how it all connects
4. **admin-portal/src/app/** — Check current page structure
5. **technician-app/app/** — Check current screen structure
