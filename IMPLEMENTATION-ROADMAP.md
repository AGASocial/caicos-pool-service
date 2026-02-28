# 🚀 CAICOS POOL SERVICE - Implementation Roadmap
## Simplified Workflow (WhatsApp → Mobile App)

---

## 📋 FINAL WORKFLOW

### Admin Portal:
1. **Route Setup** (One-time + maintenance)
   - Create routes (group of houses in geographic area)
   - Assign houses to routes
   - Assign technician to route
   - Technicians repeat same route daily

2. **Daily Management**
   - Dashboard showing today's jobs status
   - View completed services with photos + comments
   - Generate weekly reports for technician pay

### Technician App:
1. **Daily Start**
   - Open app → See assigned route (same houses daily)
   - "Tuesday, Feb 21 • 22 houses assigned"

2. **Service Workflow** (Per house)
   - Tap house from list
   - Take photo(s) → GPS + timestamp auto-captured
   - Add comment (free text)
   - Select issue category (if applicable) - buttons like:
     - ✓ No issues
     - ⚠️ Motor problem
     - ⚠️ Filter needs change
     - ⚠️ Circulation issue
     - ⚠️ Timer issue
     - ⚠️ Other (then free text)
   - Tap "COMPLETE" → Status changes pending → completed

3. **End of Day**
   - All 22 houses completed
   - Ready for admin review

---

## ✅ CURRENT SPECS ALIGNMENT

### What's Already Good:

| Feature | Spec | Status |
|---------|------|--------|
| Daily jobs list | Jobs Dashboard ✓ | Already designed |
| Select job | Job card tappable ✓ | Already designed |
| Take photos | Service form with photo section ✓ | Already designed |
| Add comments | Notes field ✓ | Already designed |
| Offline sync | Offline capability ✓ | Already designed |
| Status tracking | pending → in_progress → completed ✓ | Already designed |
| View reports | Admin portal reports section ✓ | Already designed |
| See completed with photos | Report detail view ✓ | Already designed |

### What Needs Adjustment/Clarification:

| Feature | Current Spec | Adjustment Needed |
|---------|--------------|-------------------|
| **Route Assignment** | Not explicitly covered | Add to admin portal + technician app |
| **Issue Categories** | Not mentioned | Add to service form (buttons) |
| **GPS + Timestamp** | "Photos section" mentioned | Explicit requirement: auto-capture |
| **Weekly Reports** | General "Reports" section | Add specific "Weekly Completion" report |
| **Technician Route/Assignment** | Jobs show as list | Clarify they're pre-assigned daily route |

---

## 🔧 IMPLEMENTATION CHECKLIST

### Admin Portal Enhancements:

- [ ] **Routes Management Screen**
  - Create new route
  - Add/remove houses to route
  - View houses on map
  - Assign technician to route

- [ ] **Weekly Completion Report**
  - Select technician + week
  - Show all assigned houses
  - Mark each as completed/pending
  - Filter by completion status
  - Show completion percentage
  - Export for payroll

- [ ] **Service Report View** (Already in spec, confirm includes):
  - Photos gallery
  - Comments/notes from technician
  - Issue category selected
  - GPS location
  - Timestamp
  - Customer info

### Technician App Enhancements:

- [ ] **Daily Route Display**
  - Show assigned route name
  - Show count: "22 houses today"
  - Show progress: "8 of 22 completed"
  - Color code: pending vs completed

- [ ] **Service Form Refinements**
  - House/pool selection clearly shows which one
  - **Issue Category Buttons:**
    ```
    [ ✓ No Issues ]
    [ ⚠️ Motor ]  [ ⚠️ Filter ]  [ ⚠️ Circulation ]
    [ ⚠️ Timer ]  [ ⚠️ Chemistry ]
    [ 📝 Other (free text) ]
    ```
  - Comments field for additional details
  - Photo capture with GPS auto-enabled
  - Show timestamp when photo taken

- [ ] **Photo Requirements**
  - Auto-embed GPS coordinates in photo
  - Auto-embed timestamp in photo
  - Can take multiple photos per house
  - Optional: Visual timestamp overlay on photo

- [ ] **End-of-Day Summary**
  - Show "22 of 22 completed ✓"
  - Ready to sync

---

## 📊 DATA MODEL NOTES

### Key Entities:

**Route**
- route_id
- company_id
- route_name (e.g., "Ruta 1", "Ruta 3")
- description
- assigned_technician_id
- houses: [house_ids]

**House/Pool**
- house_id
- company_id
- house_number (e.g., 5461, 7320)
- address
- customer_name
- pool_type (residential/commercial)
- assigned_route_id

**ServiceJob**
- job_id
- house_id
- route_id
- technician_id
- scheduled_date
- status (pending/in_progress/completed)
- created_at
- updated_at

**ServiceReport**
- report_id
- job_id
- technician_id
- completed_at
- photos: [{url, gps, timestamp}]
- comments: string
- issue_category: enum (no_issues, motor, filter, circulation, timer, chemistry, other)
- issue_notes: string (if category = other)

---

## 🎯 KEY REQUIREMENTS

1. **Photo Capture**
   - Must include GPS coordinates
   - Must include timestamp
   - Option to embed on image for visual proof

2. **Route Assignment**
   - Technician gets same route daily
   - Admin assigns houses to routes (not daily jobs)
   - App generates daily jobs from route + date

3. **Issue Categories**
   - Quick-select buttons
   - Free text option for "Other"
   - Used for follow-up service queue

4. **Weekly Reporting**
   - Admin can see all houses served per tech
   - Can mark as verified for payroll
   - Generate completion report

5. **Sync Strategy**
   - Photos sync to cloud
   - Service data syncs
   - Offline capability maintained

---

## 📱 SCREEN FLOW SUMMARY

```
TECHNICIAN APP:
Login
  ↓
Daily Dashboard
  "Tuesday, Feb 21 • Route 1 (Nicolás) • 22 houses"
  Progress: 0 of 22
  ↓
House List (scrollable)
  [House 5461]
  [House 5492]
  [House 720]
  ... (22 total)
  ↓
SELECT HOUSE → Service Form
  House: 5461
  ──────────────
  [Take Photo] → GPS + timestamp captured
  [Take Another Photo] (optional)
  ──────────────
  Issue Category:
  [✓ No Issues] [⚠️ Motor] [⚠️ Filter] [⚠️ Circulation] [⚠️ Timer] [📝 Other]
  ──────────────
  Additional Comments:
  [Free text input area]
  ──────────────
  [MARK COMPLETE]
  ↓
Back to House List (show 1 of 22, 2 of 22, etc.)
  ↓
(Repeat for remaining 21 houses)
  ↓
End of Day
  "✓ All 22 completed"
  [Auto-sync to cloud]
```

```
ADMIN PORTAL:
Dashboard
  ↓
SELECT: View Reports
  ↓
SELECT: Weekly Completion
  Select Technician: [Nicolás ▼]
  Select Week: [Week of Feb 24 ▼]
  ↓
Report View:
  Nicolás - Week of Feb 24
  Route 1: 77 houses assigned
  
  ✓ Completed: 75
  ⏳ Pending: 2
  
  Completion: 97%
  
  [View by Day] [View All] [Export PDF]
  
  Details:
  □ 5461  ✓  Completed  Motor issue  [View Photos]
  □ 5492  ✓  Completed  No issues    [View Photos]
  □ 720   ✓  Completed  Filter       [View Photos]
  ...
  □ 9100  ⏳ Pending    -            [Reassign?]
  □ 1120  ⏳ Pending    -            [Reassign?]
```

---

## ✨ SUMMARY

Your current feature specs are **95% aligned** with this simplified workflow. The main additions needed are:

1. **Route management** in admin portal
2. **Issue category buttons** in technician app
3. **GPS + timestamp** explicit requirements in photos
4. **Weekly completion report** template in admin portal
5. **Route-based job assignment** (instead of ad-hoc jobs)

Everything else (photos, offline sync, daily dashboard, service forms, reports) is already designed in the specs.

**Next step:** Should I create updated feature spec documents that explicitly include these clarifications?

