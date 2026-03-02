# 🎨 AI-Generated Design Prompt: Admin Portal
**For: ChatGPT via Canva | Google Stitch | Figma AI**

---

## **Project Brief**

Create a professional, data-rich web dashboard for **Caicos Admin Portal** — an enterprise management platform for pool service company owners and administrators. The portal enables managers to oversee technician work, track service completion, manage properties and routes, and generate payroll reports.

**Target Audience:** Company owners, operations managers, dispatchers, payroll admins
**Platform:** Web (Desktop-first, responsive mobile)
**Framework Context:** Next.js 14+, Tailwind CSS, Shadcn/ui components
**Use Case:** Customer presentation deck and internal admin demo

---

## **Design System Foundations**

### **Color Palette**
- **Primary Brand:** `#0066CC` (Professional Blue - trust, navigation, active states)
- **Secondary:** `#00AA44` (Success Green - completed, approved, go status)
- **Warning:** `#FF9900` (Amber - caution, pending, review needed)
- **Error:** `#DD3333` (Red - issues, critical, delete)
- **Neutral BG:** `#FFFFFF` (White - main background)
- **Neutral Light:** `#F5F5F5` (Light Gray - cards, sections, hover states)
- **Neutral Mid:** `#E0E0E0` (Medium Gray - borders, dividers)
- **Neutral Dark:** `#666666` (Dark Gray - secondary text)
- **Text Primary:** `#1A1A1A` (Charcoal - main text, headers)
- **Text Secondary:** `#666666` (Gray - subtext, labels)
- **Accent:** `#FFD700` (Gold - achievements, highlights, badges)
- **Info:** `#0099FF` (Light Blue - informational, links)

### **Typography**
- **Headlines (H1):** 32px, Bold, 1.2 line-height (page titles)
- **Subheadings (H2):** 24px, Bold, section titles
- **Card Headers (H3):** 18px, Semi-bold
- **Body Text:** 14px-16px, Regular (default)
- **Labels & UI Text:** 12px-14px, Medium
- **Monospace (data):** 13px, Regular (numbers, codes)
- **Font Family:** Inter, Segoe UI, or system sans-serif

### **Spacing & Layout**
- Desktop-first (1920px+ / 1366px / 1024px breakpoints)
- 16px base spacing unit
- Sidebar: 240px (collapsible to 60px)
- Main content: Remaining width with 24px padding
- Card padding: 16px
- Section gap: 24px

### **UI Components**
- **Buttons:** Rounded 6px, min 40px height
  - Primary: Solid blue bg, white text
  - Secondary: Outline blue, blue text
  - Danger: Solid red, white text
  - Disabled: Gray 40% opacity
- **Inputs:** 1px border (light gray), 6px radius, 8px padding, 36px height
- **Cards:** 6px radius, white background, subtle shadow (0 1px 3px rgba(0,0,0,0.08))
- **Tables:** Striped rows (hover), 48px row height, bordered cells
- **Badges:** Pill-shaped, small padding (4px 8px), 12px font
- **Modals:** Centered, white background, shadow overlay, 6px radius
- **Progress bars:** Rounded ends, animated fill, height 8px

### **Responsive Breakpoints**
- **Desktop:** 1920px, 1366px, 1024px (primary)
- **Tablet:** 768px (iPad)
- **Mobile:** 375px-480px (reference, lower priority)

---

## **Layout Architecture**

### **Main Layout Template**
```
┌─────────────────────────────────────────────┐
│  Logo | Dashboard | Date | Notifications 🔔 │  ← Header (64px)
├────────────────────────────────────────────┤
│      │                                      │
│ Side │  Main Content Area                   │
│ bar  │  (Scrollable)                        │
│ 240px│                                      │
│      │                                      │
└──────┴──────────────────────────────────────┘
Sidebar Bottom:
- Company Settings ⚙️
- User Profile 👤
- Logout
```

### **Sidebar Navigation**
- **Primary Items (bold/highlighted when active):**
  - 🏠 Home (Dashboard)
  - 📍 Routes
  - 📋 Jobs
  - 🏢 Properties
  - 👥 Team
  - 📊 Reports
- **Secondary Items:**
  - ⚙️ Settings
  - ... (More options)
- **Collapsible to icons only** (60px width) on desktop
- **Hamburger menu** on mobile/tablet

### **Header Bar**
- **Left:** Caicos logo (40x40px) + Company name in text
- **Center:** Current page breadcrumb (e.g., "Dashboard / Jobs")
- **Right:** Date (Thu, Feb 21), Notification icon (bell), User avatar + name

---

## **Key Screens to Design**

### **Screen 1: Authentication - Login**
**Visual Style:** Clean, centered, professional, minimal

**Desktop Layout (1366px):**
- Left side (50%): Brand story / graphics / pool illustration (soft blue gradient background)
- Right side (50%): Login form on white background

**Form Section:**
- [ ] Caicos logo top-center (60x60px)
- [ ] Heading: "Admin Portal" (24px, bold, blue)
- [ ] Subheading: "Manage your pool service team" (14px, gray)
- [ ] Email input field (full width, 36px height):
  - Placeholder: "admin@company.com"
  - Label above: "Email" (12px, bold)
- [ ] Password input field (full width, 36px height):
  - Placeholder: "••••••••"
  - Label above: "Password" (12px, bold)
  - Eye icon to toggle visibility (right side of input)
- [ ] Checkbox: "Remember me" (14px, unchecked)
- [ ] "SIGN IN" button (full width, 40px height, blue, bold)
- [ ] Links below button (centered, 12px):
  - "First time? Create Company" (link blue)
  - "Forgot password? Reset" (link blue)
  - Divider line or spacing between
- [ ] Footer text: "© 2024 Caicos. All rights reserved." (10px, gray)

**Visual Hints:**
- Right side padding: 48px
- No distracting animations
- Strong contrast for accessibility
- Optional: Pool/water illustration on left (subtle, not busy)

---

### **Screen 2: Authentication - Register**
**Visual Style:** Same as login, but with more form fields

**Form Section:**
- [ ] Heading: "Create Your Company Account" (24px, bold)
- [ ] Subheading: "Set up your Caicos account in 2 minutes" (14px, gray)
- [ ] Form fields (stacked, full width):
  - Full Name: [input field]
  - Email: [input field]
  - Company Name: [input field]
  - Password: [input field] (with eye toggle)
  - Confirm Password: [input field] (with eye toggle)
- [ ] Checkbox: "I agree to Terms of Service" (14px, with link)
- [ ] "CREATE ACCOUNT" button (full width, 40px, blue)
- [ ] Link below: "Already have account? Sign in" (12px, link blue)

**Visual Hints:**
- Clear field labels above each input
- Password strength indicator (optional): Green bar under password field showing "Strong", "Medium", "Weak"
- All required fields marked with red asterisk (*)

---

### **Screen 3: Dashboard - Home**
**Visual Style:** Overview-focused, metrics-driven, dashboard aesthetic

**Header Section:**
- [ ] Page title: "Dashboard" (32px, bold)
- [ ] Subtitle: "Thu, Feb 21, 2026" (14px, gray)
- [ ] "Quick Actions" button bar (right side):
  - [+ NEW JOB] (primary blue)
  - [+ PROPERTY] (secondary outline)
  - [+ INVITE TECH] (secondary outline)

**KPI Cards (4-column grid on desktop, 2-column on tablet):**
- [ ] Card 1 - Today's Jobs:
  - Large number: "22" (32px, bold, blue)
  - Label: "Jobs Today" (12px, gray)
  - Icon: 📋 (left side, 24px, blue)
  - Subtle bg: Light blue (F0F8FF)
- [ ] Card 2 - Completed:
  - Large number: "8" (32px, bold, green)
  - Label: "Completed (36%)" (12px, gray)
  - Icon: ✅ (left side, 24px, green)
  - Trend: "↑ 2 from yesterday" (11px, green)
- [ ] Card 3 - Pending:
  - Large number: "14" (32px, bold, amber)
  - Label: "Pending (64%)" (12px, gray)
  - Icon: ⏳ (left side, 24px, amber)
- [ ] Card 4 - Active Team:
  - Large number: "5" (32px, bold, blue)
  - Label: "Technicians Active" (12px, gray)
  - Icon: 👥 (left side, 24px, blue)

**Today's Summary Section:**
- [ ] Section title: "TODAY'S ROUTES" (14px, bold, uppercase)
- [ ] Table with 4 columns:
  - Column 1: Route Name (e.g., "Ruta 1", "Ruta 3")
  - Column 2: Technician (e.g., "Nicolás Teuffel", "Luis Mena")
  - Column 3: Progress (animated bar: "15 of 22" + percentage %)
  - Column 4: Status (green dot + "Active" or "View Details" link)
- [ ] Table rows (3-5 visible):
  - Hover state: Light gray background
  - Row height: 48px
  - Alternating row colors (white / light gray)
- [ ] Each row clickable → Routes detail page

**Recent Jobs Section (below):**
- [ ] Section title: "RECENT JOBS" (14px, bold, uppercase)
- [ ] Table with columns:
  - Property (e.g., "Residencia Smith")
  - Technician (e.g., "John T.")
  - Time (e.g., "8:30 AM")
  - Status (badge: green "✅ Completed" / orange "⏳ In Progress" / gray "⏹️ Pending")
  - Action link: "View Report"
- [ ] 5 visible rows, "View All →" link at bottom
- [ ] Each row: 48px height

**Visual Hints:**
- KPI cards have subtle shadows and rounded corners
- Progress bars are animated (smooth fill)
- Status badges use color coding (green/orange/gray)
- Tables have hover effect (row darkens slightly)
- Plenty of whitespace between sections (24px gaps)

---

### **Screen 4: Routes Management**
**Visual Style:** Data-focused, professional, list-based

**Header Section:**
- [ ] Page title: "Routes" (32px, bold)
- [ ] Subtitle: "(2 total)" (14px, gray)
- [ ] [+ CREATE ROUTE] button (primary blue, top right)

**Routes List (Card-based OR Table):**
- [ ] Each route card (or table row):
  - Card style: White background, 6px radius, shadow, 16px padding
  - **Top row:**
    - Route name: "Ruta 1 - Nicolás" (18px, bold)
    - Status badge: "🟢 Active" (green pill, 12px)
  - **Details row:**
    - "22 pools assigned" (14px, gray)
    - "Technician: Nicolás Teuffel" (14px, gray)
    - "Created: Jan 23, 2026" (12px, gray)
  - **Action buttons (right side):**
    - [View] (secondary outline, 32px height)
    - [Edit] (secondary outline, 32px height)
    - [Delete] (danger red outline, 32px height)
  - **Bottom row (optional):**
    - "Today's completion: 15 of 22 (68%)" (12px, gray)
    - Progress bar (green gradient, 8px height, rounded)

**Layout:**
- Cards stacked vertically (full width on desktop)
- 16px gap between cards
- Each card: ~380px tall (with all details)
- 2-column grid on tablet, single column on desktop (conservative)

**Empty State (if no routes):**
- [ ] Icon: 📍 (large, 64px, light gray)
- [ ] Heading: "No routes yet" (18px, bold)
- [ ] Text: "Create your first route to assign pools to technicians" (14px, gray)
- [ ] [+ CREATE ROUTE] button (primary blue, centered)

---

### **Screen 5: Create/Edit Route Modal**
**Visual Style:** Form-based, modal overlay, clean

**Modal Layout:**
- [ ] Modal width: 600px (on desktop)
- [ ] Modal height: Auto (scrollable if content > viewport)
- [ ] Title: "Create Route" or "Edit Route" (20px, bold)
- [ ] Close button (X) top right

**Form Fields:**
- [ ] Field 1: Route Name (required)
  - Label: "Route Name" (12px, bold)
  - Input: [________________] (full width, 36px)
  - Example: "Ruta 1 - Nicolás"
  - Validation: No empty values

- [ ] Field 2: Technician (required)
  - Label: "Assign Technician" (12px, bold)
  - Dropdown: [Nicolás Teuffel ▼] (full width, 36px)
  - Shows active team members only
  - Searchable

- [ ] Field 3: Pools (required)
  - Label: "Assign Pools" (12px, bold)
  - Search box: [Search pools...] (full width, 36px, with magnifying glass icon)
  - List below (scrollable, max-height 300px):
    - Each pool item:
      - [ ] Checkbox (left)
      - Pool number (bold, 14px): "5461"
      - Customer name (gray, 12px): "Residencia Smith"
      - Address (gray, 11px): "1244 Blue Water Dr"
      - Hover state: Light gray background
    - Items: 5-7 visible at once
  - Selected count: "22 pools selected" (green text, 12px, below list)

**Form Actions:**
- [ ] [SAVE ROUTE] button (full width, 40px, blue, bold)
- [ ] [CANCEL] button (full width, 40px, gray outline)
- [ ] Buttons at bottom of modal, 12px gap between

**Visual Hints:**
- Modal has white background, 6px radius
- Overlay: Semi-transparent dark (rgba(0,0,0,0.4))
- Form has 24px padding
- All fields have visual feedback on focus (blue border)
- Validation errors in red below field

---

### **Screen 6: Jobs Management**
**Visual Style:** Data table, filterable, action-rich

**Header Section:**
- [ ] Page title: "Jobs" (32px, bold)
- [ ] Filters (left to right):
  - [Date Range ▼] (dropdown: "Today", "This Week", "Custom range")
  - [Technician ▼] (dropdown: "All", "Nicolás", "Luis", etc.)
  - [Status ▼] (dropdown: "All", "Completed", "In Progress", "Pending")
- [ ] [+ CREATE JOB] button (top right, primary blue)

**Jobs Table:**
- [ ] Column headers (12px, bold, gray background):
  - Property (25% width)
  - Technician (20% width)
  - Scheduled (15% width)
  - Status (15% width)
  - Actions (25% width)

- [ ] Table rows (48px height each):
  - Property: "Residencia Smith" (bold, 14px)
  - Technician: "John Technician" (gray, 13px)
  - Scheduled: "Feb 21, 8:30 AM" (13px)
  - Status: Badge with icon:
    - Green ✅ "Completed"
    - Orange ⏳ "In Progress"
    - Gray ⏹️ "Pending"
  - Actions: [View Report] [Edit] [Delete] (blue links, 12px)

- [ ] Striped rows (white / light gray alternating)
- [ ] Hover state: Row darkens slightly to #FAFAFA
- [ ] 10 rows visible, pagination at bottom: "< 1 of 3 >"

**Empty State:**
- [ ] Icon: 📋 (large, light gray)
- [ ] Text: "No jobs found. Create one to get started." (14px, gray)
- [ ] [+ CREATE JOB] button (centered, blue)

---

### **Screen 7: Create Job Modal**
**Visual Style:** Form modal, similar to Route creation

**Form Fields:**
- [ ] Property (required): [Residencia Smith ▼]
- [ ] Technician (required): [John Technician ▼]
- [ ] Date (required): [Feb 21, 2026] (date picker)
- [ ] Time (required): [08:30 AM] (time picker, 12-hour)
- [ ] Duration (optional): [30] minutes (number input with up/down arrows)
- [ ] Route Order (optional): [1] (number input)
- [ ] Notes (optional): [Large text area, 80px min height]

**Buttons:**
- [ ] [SAVE JOB] (full width, blue)
- [ ] [CANCEL] (full width, gray outline)

---

### **Screen 8: Job Detail View**
**Visual Style:** Full-width detail page, document-like

**Top Section:**
- [ ] Breadcrumb: "Dashboard / Jobs / Job #UL42K" (12px, gray)
- [ ] Title: "Residencia Smith" (32px, bold)
- [ ] Address: "1244 Blue Water Dr, Orlando FL" (14px, gray)
- [ ] Gate Code: "🔑 1234" (14px, gray badge)
- [ ] Action buttons (top right):
  - [EDIT] (secondary blue)
  - [PRINT] (secondary gray)
  - [DELETE] (danger red)

**Job Header Card:**
- White card, 6px radius, shadow, 16px padding
- 3-column layout:
  - Col 1: Technician: "John Technician" (14px, bold)
  - Col 2: Status: "✅ COMPLETED" (14px, green)
  - Col 3: Date/Time: "Feb 21, 2026 @ 8:30 AM" (14px)
- Second row:
  - Duration: "28 minutes" (12px, gray)
  - Route: "#1" (12px, gray)

**Service Report Sections (Collapsible or Expanded):**

**Section 1: 💧 Chemical Readings**
- White card with light blue header bar (6px radius)
- 2-column table inside:
  - Column 1 (Property):
    - Row 1: "pH" (bold) | "7.4" (monospace) | "Ideal: 7.2-7.6"
    - Row 2: "Chlorine" (bold) | "2.1 ppm" | "Ideal: 1-3"
    - Row 3: "Alkalinity" (bold) | "95 ppm" | "Ideal: 80-120"
    - (Continue for all 7 readings)
  - Each row: Light gray divider

**Section 2: 🔧 Equipment Status**
- Card with equipment items:
  - Row 1: "Pump" | Status: ✅ "OK" (green)
  - Row 2: "Filter" | Status: ✅ "OK" (green)
  - Row 3: "Heater" | Status: ⚠️ "ISSUE" (red)
  - Row 4: "Cleaner" | Status: ✅ "OK" (green)

**Section 3: ✅ Tasks Completed**
- List of checkboxes:
  - ☑ Skimmed surface
  - ☑ Vacuumed floor
  - ☑ Brushed walls & steps
  - ☑ Emptied baskets
  - ☑ Backwashed filter
  - ☐ Cleaned filter

**Section 4: 📷 Photos Gallery**
- [ ] Heading: "Photos (3)" (14px, bold)
- [ ] Grid of thumbnails (120x120px, 2-3 columns):
  - Each thumbnail: 6px radius, border, expandable on click
  - Overlay on hover: "View full image" (12px, centered, white text, dark overlay)
- [ ] "GPS + timestamp captured" badge below gallery (12px, gray)

**Section 5: 📝 Notes & Follow-up**
- [ ] Section: "Service Notes"
  - Large text block (gray background, rounded): "Pool looks good. Minor issue with heater - customer aware."
- [ ] Section: "Follow-up Needed"
  - Status: ☑ "Yes" (checked, green)
  - Follow-up text: "Check heater tomorrow - parts on order" (gray background)

**Bottom Action:**
- [ ] [EXPORT PDF] button (secondary blue, bottom right)

---

### **Screen 9: Properties Management**
**Visual Style:** Table-based, searchable, directory-like

**Header Section:**
- [ ] Page title: "Properties" (32px, bold)
- [ ] Subtitle: "(15 total)" (14px, gray)
- [ ] Search bar (top left): [Search properties...] (200px width, with magnifying glass)
- [ ] Filters (horizontal):
  - [Status ▼] (Active / Inactive)
  - [Type ▼] (All, Residential, Commercial)
- [ ] [+ CREATE PROPERTY] button (top right, blue)

**Properties Table:**
- [ ] Column headers:
  - Customer Name (25% width)
  - Address (30% width)
  - Type (15% width)
  - Phone (15% width)
  - Status (8% width)
  - Actions (7% width)

- [ ] Table rows (48px height):
  - Customer: "Residencia Smith" (bold, 14px)
  - Address: "1244 Blue Water Dr, Orlando" (13px)
  - Type: "💧 Residential" (badge, light blue, 12px)
  - Phone: "(555) 123-4567" (13px)
  - Status: 🟢 "Active" (green icon, 12px) OR 🟡 "Inactive" (gray icon)
  - Actions: [Edit] [View Jobs] [Delete] (blue links)

- [ ] Striped rows, hover effect
- [ ] 10 rows visible, pagination at bottom

**Empty State:**
- [ ] Icon: 🏢 (large, light gray)
- [ ] Text: "No properties found" (14px)
- [ ] [+ CREATE PROPERTY] button (blue, centered)

---

### **Screen 10: Create/Edit Property Modal**
**Form Fields:**
- [ ] Full Name: [_________________]
- [ ] Email: [_________________]
- [ ] Phone: [_________________]
- [ ] Address: [_________________]
- [ ] City: [_________________]
- [ ] State: [FL ▼] (dropdown)
- [ ] ZIP: [_________________]
- [ ] Pool Type: [Residential ▼]
- [ ] Surface: [Plaster ▼]
- [ ] Equipment Notes: [_________________]
- [ ] Gate Code: [_________________]
- [ ] Other Notes: [Large text area]

**Buttons:**
- [ ] [SAVE PROPERTY] (full width, blue)
- [ ] [CANCEL] (full width, gray)

---

### **Screen 11: Team Management**
**Visual Style:** Role-based grouping, cards + list

**Header:**
- [ ] Page title: "Team" (32px, bold)
- [ ] Subtitle: "(5 members)" (14px, gray)
- [ ] [+ INVITE TECHNICIAN] button (top right, blue)

**Team Members Grouped by Role:**

**Section 1: OWNER (group header, 12px uppercase, bold)**
- [ ] Card: Sarah Johnson
  - Avatar: "SJ" (circular, 40x40px, blue background)
  - Name: "Sarah Johnson" (bold, 14px)
  - Email: "sarah@caicos.com" (gray, 13px)
  - Role badge: "👑 OWNER" (gold/yellow pill, 12px)
  - Status: "🟢 Active" (green, 12px)
  - Joined: "Jan 2024" (gray, 11px)
  - Actions: [Edit] [View Profile] (blue links)

**Section 2: ADMINS (group header)**
- [ ] Card: Mike Wilson
  - (Similar structure to owner card, but role badge: "👮 ADMIN")

**Section 3: TECHNICIANS (group header)**
- [ ] Cards: John Technician, Maria Garcia
  - Include extra metric: "Jobs Completed: 42" (12px, gray)
  - Status: Active or Inactive (icon)

**Visual Hints:**
- Cards in grid (2-3 columns on desktop, 1 on mobile)
- Group headers have 24px top margin
- Cards have consistent height (~200px)

---

### **Screen 12: Invite Technician Modal**
**Visual Style:** Simple form + generated link display

**Form Section:**
- [ ] Email (required): [_________________] (36px height)
- [ ] Full Name (required): [_________________]
- [ ] Role (required): [Technician ▼] (dropdown)

**Generated Link Section (appears after filling form):**
- [ ] Heading: "Invite Link" (14px, bold)
- [ ] Text: "Share this link with the technician:" (12px, gray)
- [ ] Link display (read-only):
  - [ ] Box with gray background (light gray #F5F5F5)
  - [ ] Text: "https://app.caicos.com/join?code=ABC123XYZ" (monospace, 12px)
  - [ ] [Copy] button (blue, inside right side of box)
- [ ] Instructions: "Expires in 7 days" (gray, 11px)

**Buttons:**
- [ ] [SEND INVITE EMAIL] (full width, blue)
- [ ] [CLOSE] (full width, gray)

**Visual Hints:**
- Link box changes to light blue on focus/copy action
- "Copied!" toast notification appears after clicking Copy
- Link is selectable (user can manually copy)

---

### **Screen 13: Team Member Profile Detail**
**Visual Style:** Single member overview, action-focused

**Top Section:**
- [ ] Avatar: "JT" (circular, 60x60px)
- [ ] Name: "John Technician" (24px, bold)
- [ ] Email: "john@caicos.com" (gray, 14px)
- [ ] Phone: "(555) 987-6543" (gray, 14px)
- [ ] Role: "🔧 Technician" (badge, blue pill)
- [ ] Status: "🟢 Active" (green text, 12px)

**Statistics Card:**
- Jobs Completed: 42 (bold, 18px)
- Avg Rating: 4.8/5 (stars + text, 12px)
- Last Job: Feb 21 @ 9:00 AM (gray, 12px)
- Joined: Mar 15, 2024 (gray, 12px)

**Actions Section:**
- [ ] Toggle: "Inactive" (switch control, off/on)
- [ ] Buttons:
  - [EDIT] (secondary blue)
  - [REMOVE FROM TEAM] (danger red)
- [ ] Role change dropdown:
  - Current: "Technician ▼"
  - [UPDATE ROLE] button

**Visual Hints:**
- Edit and Remove buttons have hover states (darker red for delete)
- Toggle switch animates smoothly

---

### **Screen 14: Reports - Service Reports List**
**Visual Style:** Data table, searchable, export-rich

**Header:**
- [ ] Page title: "Service Reports" (32px, bold)
- [ ] Filters (horizontal):
  - [Date Range ▼] (dropdown)
  - [Technician ▼]
  - [Property ▼]
  - [Export ▼] (PDF, CSV options)
- [ ] Search: [Search by customer name...] (200px, magnifying glass)

**Reports Table:**
- [ ] Column headers:
  - Date/Time (15%)
  - Property (25%)
  - Technician (20%)
  - Status (12%)
  - Actions (28%)

- [ ] Table rows (48px):
  - Date/Time: "Feb 21, 8:30 AM" (13px)
  - Property: "Residencia Smith" (bold, 14px)
  - Technician: "John T." (13px)
  - Status: ✅ "Completed" (green badge)
  - Actions: [View Details] [Download PDF] (blue links)

- [ ] 15 rows visible, pagination
- [ ] Result count: "Found: 427 reports" (gray, 12px, top right)

**Empty State:**
- Icon + text: "No reports found. Service reports will appear here."
- [Go Back] link

---

### **Screen 15: Weekly Completion Report**
**Visual Style:** Summary-focused, payroll-ready, progress visualization

**Header Section:**
- [ ] Page title: "Weekly Completion Report" (32px, bold)
- [ ] Filters:
  - Technician: [Nicolás Teuffel ▼]
  - Week: [Week of Feb 24 - Mar 2 ▼]
- [ ] Buttons (top right):
  - [EXPORT PDF] (secondary blue)
  - [REFRESH] (secondary gray)

**Summary Card:**
- [ ] Route name: "Ruta 1 - Nicolás" (18px, bold)
- [ ] Total assigned: "77 pools" (14px, gray)
- [ ] Progress section:
  - Large percentage: "97%" (32px, bold, green)
  - Progress bar (animated, green gradient, 10px height, rounded):
    - Filled to 97%
    - Label inside bar: "75 of 77 completed"
- [ ] Counts section (2-column):
  - Completed: "✓ 75" (14px, green)
  - Pending: "⏳ 2" (14px, amber)

**Details Table:**
- [ ] Column headers:
  - Pool # (12%)
  - Customer (25%)
  - Status (12%)
  - Issue Category (20%)
  - Actions (31%)

- [ ] Table rows (48px):
  - Pool #: "5461" (bold, 14px)
  - Customer: "Smith" (14px)
  - Status: ✅ (green checkmark) or ⏳ (pending)
  - Issue: "-" (no issue) or "Motor" / "Filter" / "Circulation" (red text if issue)
  - Actions: [View Photos] (blue link)

- [ ] 20 rows visible (scrollable)
- [ ] Total rows visible at bottom: "Showing 1-20 of 77"

**Filter Bar (above table):**
- [ ] [All] [Completed ✓] [Pending ⏳] (toggle buttons)

**Action Buttons (bottom):**
- [ ] [APPROVE FOR PAYROLL] (primary green, full width)
  - On click: Confirmation modal: "Approve 75 pools for payroll? This generates a payroll record."
  - [YES] [CANCEL]
- [ ] [HOLD] (secondary gray, full width)

**Visual Hints:**
- Progress bar animates on page load
- Table rows highlight on hover
- Issue categories color-coded (red for problems)
- Status icons immediately identify completed vs pending

---

### **Screen 16: Settings - Company Settings**
**Visual Style:** Form-based, sectioned, settings page aesthetic

**Header:**
- [ ] Page title: "Settings" (32px, bold)
- [ ] Sidebar tabs (left, sticky):
  - Company (active, blue highlight)
  - Account
  - Billing

**Company Section (main content):**

**Logo & Branding:**
- [ ] Heading: "Logo & Branding" (16px, bold)
- [ ] Logo upload: [Upload Logo] button (gray box with dashed border, 120x120px)
  - Placeholder: "📷 Drop logo here or click to upload"
- [ ] Supported formats: "PNG, JPG (max 2MB)" (gray, 11px)

**Company Info:**
- [ ] Section heading: "Company Information" (16px, bold)
- [ ] Fields:
  - Company Name: [Caicos Pool Service] (full width input)
  - Email: [admin@caicos.com] (full width input)
  - Phone: [(305) 555-1234] (full width input)
  - Address: [123 Main St, Miami, FL 33101] (full width input)
- [ ] [SAVE CHANGES] button (secondary blue, 40px)

**Subscription & Billing:**
- [ ] Section heading: "Subscription" (16px, bold, divider line above)
- [ ] Status card:
  - Current Plan: "Pro (Monthly)" (14px, bold)
  - Monthly Cost: "$99/month" (14px)
  - Billing Date: "Mar 21, 2026" (14px, gray)
  - [Manage Billing →] link (blue, 12px)

**Account Section (tab):**
- [ ] Email: admin@caicos.com (read-only gray input, 13px)
- [ ] Password: •••••••• (read-only, gray input)
  - [CHANGE PASSWORD] button (secondary blue, 40px)
- [ ] Two-Factor Authentication: [Off] (toggle switch, 14px)
  - [ENABLE 2FA] link (blue, 12px)

**Danger Zone:**
- [ ] Section heading: "Danger Zone" (16px, bold, with red accent)
- [ ] Warning text: "Deleting your company account will remove all data permanently. This action cannot be undone." (12px, gray)
- [ ] [DELETE COMPANY & DATA] button (danger red, full width, 40px, bold)
  - On click: Confirmation modal with warnings
  - Requires typing company name to confirm deletion

**Visual Hints:**
- Form sections separated by divider lines (light gray)
- Danger zone has light red background (#FFF5F5)
- All inputs consistent style (36-40px height)
- Save button only enabled if form fields changed
- Tab navigation on left with hover states

---

## **Visual Design Specifications**

### **Shadows & Depth**
- **Card shadow:** `0 1px 3px rgba(0,0,0,0.08)`
- **Hover shadow:** `0 2px 8px rgba(0,0,0,0.12)`
- **Modal shadow:** `0 4px 12px rgba(0,0,0,0.15)`
- **Z-index hierarchy:** Sidebar (10), Header (20), Modal overlay (30), Modal (40), Tooltips (50)

### **Animations & Interactions**
- **Button hover:** Background color change + subtle scale (1.01x)
- **Progress bar:** Smooth width animation (600ms, ease-out)
- **Form inputs:** Border color change on focus (blue), smooth transition (200ms)
- **Table rows:** Fade in on load, staggered (50ms delay per row)
- **Modal open:** Fade in overlay + slide down modal (300ms)
- **Badge transitions:** Color changes animate smoothly (200ms)
- **Tab switches:** Fade out → Fade in content (150ms)

### **Icons & Iconography**
- **Style:** Line-based, 24px standard size (adjustable to 18px, 32px)
- **Libraries:** Use Feather Icons, Heroicons, or Material Design Icons
- **Color:** Match text color, or use brand color for active/important states
- **Examples to include:**
  - 🏠 Home / Dashboard
  - 📍 Routes / Location
  - 📋 Jobs / List
  - 🏢 Properties / Building
  - 👥 Team / People
  - 📊 Reports / Chart
  - ⚙️ Settings / Gear
  - 🔔 Notifications / Bell
  - 👤 Profile / Person
  - ✅ Completed / Checkmark
  - ⏳ Pending / Clock
  - ⚠️ Issue / Warning
  - 💧 Water / Chemistry
  - 📷 Photos / Camera
  - 📞 Phone / Contact
  - 📧 Email / Envelope
  - 🔐 Security / Lock
  - 🔑 Gate Code / Key
  - 💰 Billing / Money
  - 📈 Growth / Trend
  - 🗑️ Delete / Trash

### **Status Badges & States**
- **Completed:** Green (#00AA44) with ✅ icon
- **In Progress:** Amber (#FF9900) with ⏳ icon
- **Pending:** Gray (#999999) with ⏹️ icon
- **Active:** Green (#00AA44) with 🟢 icon
- **Inactive:** Gray (#999999) with 🟡 icon
- **Issue:** Red (#DD3333) with ⚠️ icon

### **Responsive Design Strategy**

**Desktop (1920px, 1366px, 1024px):**
- Sidebar always visible
- 2-4 column grids
- Full tables with all columns

**Tablet (768px):**
- Sidebar collapsible to icons
- 2-column grids
- Simplified tables (hide some columns)

**Mobile (375px):**
- Hamburger menu for sidebar
- Single-column layouts
- Card-based tables (stack data vertically)
- Bottom navigation bar option

### **Accessibility Considerations**
- **Contrast ratios:** All text >4.5:1 (WCAG AA)
- **Touch targets:** Minimum 40px × 40px buttons
- **Focus states:** Blue outline, visible keyboard navigation
- **Color coding:** Don't rely only on color; include icons/text too
- **Form labels:** Always visible, not placeholders
- **Alt text:** All icons have aria-labels or alternative text
- **Skip navigation:** Skip to main content link available

---

## **Dark Mode** (Optional Enhancement)

### **Dark Palette Adjustments**
- **Background:** `#1A1A1A` (very dark gray/charcoal)
- **Card background:** `#2A2A2A` (dark gray)
- **Hover background:** `#3A3A3A`
- **Text primary:** `#FFFFFF` (white)
- **Text secondary:** `#CCCCCC` (light gray)
- **Borders:** `#444444` (dark gray)
- **Inputs:** `#2A2A2A` border with `#3A3A3A` background

### **Color Adjustments**
- Primary blue: Slightly lighter (#3399FF)
- Success green: Slightly brighter (#00DD55)
- Warning amber: Brighter (#FFAA00)
- Error red: Brighter (#FF5555)

---

## **Component Library Examples**

### **Button Variants**
```
Primary (Blue):
  Rest: Blue bg, white text
  Hover: Darker blue bg
  Active: Even darker, scale 0.98x
  Disabled: Gray bg, gray text, 50% opacity

Secondary (Outline):
  Rest: White bg, blue border, blue text
  Hover: Light blue bg
  Active: Solid blue
  Disabled: Gray border, gray text, 50% opacity

Danger (Red):
  Rest: Red bg, white text
  Hover: Darker red
  Active: Scale effect
  Disabled: Gray, 50% opacity
```

### **Form Input States**
```
Default: Gray border, white bg
Focus: Blue border, white bg, shadow
Filled: Gray border, value visible
Error: Red border, error message below
Success: Green border, success icon
Disabled: Gray bg, lighter gray border, no cursor
```

### **Table Row States**
```
Default: White bg, gray bottom border
Hover: Light gray bg (#F5F5F5)
Active/Selected: Blue background (#E3F2FD), blue text
Disabled: Gray text, 50% opacity
```

---

## **Copy & Tone**

### **Button Labels**
- "SIGN IN →" (action-oriented with arrow)
- "CREATE ROUTE" (clear action)
- "SAVE CHANGES" (confirms action)
- "EXPORT PDF" (output action)
- "APPROVE FOR PAYROLL" (consequential action)
- "DELETE COMPANY & DATA" (destructive, clear consequences)

### **Status Messages**
- "15 of 22 completed" (clear numerics)
- "Route is active and ready" (reassuring)
- "Pending review" (non-alarming)
- "Issue flagged for follow-up" (actionable)

### **Microcopy**
- "Expires in 7 days" (contextual info)
- "This action cannot be undone" (warning)
- "Max 2MB file size" (constraint info)
- "All team members from this company" (clarification)

---

## **Design Specifications - Technical**

### **File Format & Dimensions**
- **Canvas:** 1366px × 768px (standard desktop laptop)
- **Alternative:** 1920px × 1080px (larger desktop)
- **Tablet mockup:** 768px × 1024px (iPad)
- **Format:** Vector-based (Figma, Canva, Stitch) — NOT rasterized images

### **Layer Organization**
- **Artboards:**
  - `Screen_01_Login`
  - `Screen_02_Register`
  - `Screen_03_Dashboard`
  - `Screen_04_Routes_List`
  - `Screen_05_Routes_Create_Modal`
  - `Screen_06_Jobs_List`
  - `Screen_07_Jobs_Create_Modal`
  - `Screen_08_Jobs_Detail`
  - `Screen_09_Properties_List`
  - `Screen_10_Properties_Create_Modal`
  - `Screen_11_Team_List`
  - `Screen_12_Team_Invite_Modal`
  - `Screen_13_Team_Profile`
  - `Screen_14_Reports_List`
  - `Screen_15_Weekly_Completion_Report`
  - `Screen_16_Settings`
  - `State_01_Loading_Skeleton`
  - `State_02_Error_Message`
  - `State_03_Empty_State`
  - `Component_01_Buttons`
  - `Component_02_Form_Inputs`
  - `Component_03_Cards`
  - `Component_04_Badges`
  - `Component_05_Modals`

### **Component Export**
- All buttons grouped into `Component_01_Buttons` artboard
- All form inputs in `Component_02_Form_Inputs`
- Consistent naming: `Button_Primary`, `Button_Secondary`, `Input_Text`, `Input_Dropdown`, etc.
- Colors & typography as shared styles (if Figma) or swatches exported as reference

### **Export Quality**
- **2x resolution** for high-DPI displays (e.g., export at 2x native size)
- **SVG export** for icons (scalable, crisp)
- **PNG export** for mockups/screenshots
- **Color palette** exported as separate swatch file

---

## **Design Presentation Context**

**This admin portal should convey:**
1. **Authority & Control:** Professional layout, clear hierarchy, full data visibility
2. **Efficiency:** Minimal clicks to key actions (create job, approve payroll, view reports)
3. **Safety:** Clear warnings for destructive actions (delete, payroll approval)
4. **Data Integrity:** Transparency in technician metrics, completion tracking, payroll approvals
5. **Scalability:** Can handle 50+ technicians, 1000+ properties, complex routes
6. **Real-time Updates:** Dashboard reflects current job status instantly
7. **Audit Trail:** All reports exportable, timestamped, traceable

---

## **Design Assets to Generate**

### **High Priority (Core UX)**
1. ✅ Login screen (with clean form)
2. ✅ Dashboard (with KPI cards + route progress)
3. ✅ Routes list (card-based)
4. ✅ Create Route modal (with pool selection)
5. ✅ Jobs list (table view)
6. ✅ Job detail page (full service report)
7. ✅ Properties list (table view)
8. ✅ Team list (role-grouped cards)
9. ✅ Weekly Completion Report (progress + payroll approval)
10. ✅ Settings page (company info + billing)

### **Medium Priority (Supporting Views)**
11. Job create/edit modal
12. Property create/edit modal
13. Team member profile detail
14. Reports list page
15. Invite technician modal
16. Register page (company setup)

### **Enhancement (Polish & States)**
17. Empty states (6 different messages)
18. Loading skeletons (dashboard, table)
19. Error states (network error, validation)
20. Success toasts (job saved, profile updated)
21. Modals in different states (loading, submitting, error)

### **Optional (Advanced)**
22. Dark mode versions of 5-6 key screens
23. Mobile responsive versions (tablet + mobile)
24. Print-friendly PDF layouts
25. Component library (all buttons, inputs, badges in one artboard)

---

## **Example Prompt for ChatGPT in Canva / Google Stitch**

*Copy-paste this into your AI design tool:*

---

### **START HERE: Copy-Paste into Canva/Stitch AI**

"Design a professional web dashboard for **Caicos Admin Portal**, an enterprise management system for pool service companies. Create 10 screens in desktop dimensions (1366x768px):

1. **Login Screen** — Split layout (left: brand storytelling + pool illustration with soft blue gradient; right: login form). Include Caicos logo, email/password inputs with labels, 'Remember me' checkbox, blue 'SIGN IN →' button. Links below for signup and password reset.

2. **Dashboard** — Header with 'Dashboard' title + date + quick actions ([+ NEW JOB], [+ PROPERTY], [+ INVITE TECH]). Four KPI cards in a row: '22 Jobs Today' (blue card), '8 Completed (36%)' (green card with trend ↑), '14 Pending (64%)' (amber card), '5 Technicians Active' (blue card). Below: 'TODAY'S ROUTES' table showing route name, technician, progress bar ('15 of 22'), and status. Then 'RECENT JOBS' list with property, technician, time, status badge, and view/edit links.

3. **Routes List** — Heading 'Routes (2 total)' + [+ CREATE ROUTE] button. Show 2 route cards stacked: each card has route name (e.g., 'Ruta 1 - Nicolás'), status badge (green 🟢 Active), '22 pools assigned', technician name, created date, progress bar showing daily completion, and [View][Edit][Delete] buttons.

4. **Create Route Modal** — Modal popup with title 'Create Route'. Fields: Route Name input, Technician dropdown, Pools multi-select searchable list (show 5-7 pools with checkboxes, customer names), 'Pool Count: 22 assigned' text. Action buttons: [SAVE ROUTE] (blue, full width) [CANCEL] (gray, full width).

5. **Jobs List** — Title 'Jobs', filters: [Date Range ▼][Technician ▼][Status ▼], [+ CREATE JOB] button. Table with columns: Property, Technician, Scheduled, Status (color-coded badges: green ✅ Completed, orange ⏳ In Progress, gray ⏹️ Pending), Actions. 10 rows visible, striped background, hover effects. Pagination '< 1 of 3 >'.

6. **Job Detail** — Breadcrumb at top, large title 'Residencia Smith', address '1244 Blue Water Dr', gate code. White card header: Technician name, Status (✅ COMPLETED green), Date/Time. Sections (vertical cards): 💧 Chemical Readings (table with pH, Chlorine, etc. + ideal ranges), 🔧 Equipment Status (list with Pump OK, Filter OK, Heater ISSUE), ✅ Tasks Completed (checklist with green checkmarks), 📷 Photos (3 thumbnails in grid, 'GPS + timestamp captured' note), 📝 Notes (gray background text block), Follow-up (green badge 'Needed' + text). Bottom: [EXPORT PDF] button.

7. **Properties List** — Title 'Properties (15 total)', search bar, filters [Status ▼][Type ▼], [+ CREATE PROPERTY] button. Table: Customer Name, Address, Type (badge 💧 Residential), Phone, Status (🟢 Active), Actions ([Edit][View Jobs][Delete]). 10 rows with striped background, hover effects.

8. **Team List** — Title 'Team (5 members)', [+ INVITE TECHNICIAN] button. Grouped sections: 'OWNER' header with Sarah Johnson card (avatar 'SJ', name, email, role badge 👑 OWNER, 🟢 Active status, joined date, [Edit][View Profile]). 'ADMINS' section with similar card. 'TECHNICIANS' section with team member cards (add 'Jobs Completed: 42' metric).

9. **Weekly Completion Report** — Title 'Weekly Completion Report', filters: Technician [Nicolás Teuffel ▼], Week [Week of Feb 24 - Mar 2 ▼], buttons [EXPORT PDF] [REFRESH]. Summary card: 'Ruta 1 - Nicolás', '77 pools assigned', large green percentage '97%', animated progress bar filled to 97% with label '75 of 77 completed', counts section (✓ 75 Completed | ⏳ 2 Pending). Table below with columns: Pool #, Customer, Status, Issue Category, Actions. Show 15 rows. Bottom: [APPROVE FOR PAYROLL] (green, full width) [HOLD] (gray, full width).

10. **Settings - Company** — Title 'Settings'. Left sidebar with tabs: Company (active/highlighted), Account, Billing. Main content: 'Logo & Branding' section with upload box (120x120px, dashed border), 'Company Information' fields (Company Name, Email, Phone, Address), [SAVE CHANGES] button. Divider line. 'Subscription' section showing Current Plan 'Pro (Monthly)', Monthly Cost '$99/month', Billing Date, [Manage Billing →] link. Divider. 'Account' section with email (read-only), password (masked), [CHANGE PASSWORD] link, 2FA toggle. Red 'Danger Zone' section with warning text and [DELETE COMPANY & DATA] button.

**Design System:**
- Colors: Primary Blue (#0066CC), Success Green (#00AA44), Warning Amber (#FF9900), Error Red (#DD3333), Neutral Light Gray (#F5F5F5), Text Charcoal (#1A1A1A)
- Typography: Bold sans-serif headers (32px for page titles, 18px for sections), regular body (14px), monospace for data (13px)
- Components: 6px border radius, white cards with subtle shadow (0 1px 3px), 40px minimum button height, striped/hover table rows, rounded badges, modal overlays
- Layout: Sidebar (240px) on left, main content on right, top header with navigation
- Icons: Use Feather or Material Icons (home, routes, jobs, properties, team, reports, settings, etc.)
- Interactions: Button hover with subtle scale, progress bar animation, table row fade-in on load, modal open/close transitions

**Output:** Create artboards for each screen, properly layer components, group all UI elements logically, export color palette and typography specifications separately, ensure all text is editable (not rasterized)."

---

## **Refinement Prompts to Use Later**

Once you generate the initial designs, use these follow-up prompts to iterate:

1. **For better dashboard visualization:**
   - "Show a real-time update animation on the progress bar (from 14% to 15%)"
   - "Add a sparkline/mini chart showing weekly job completion trend"
   - "Make the KPI cards interactive — hover to see more details"

2. **For more professional tables:**
   - "Add row hover effects (light background change)"
   - "Include pagination controls and 'Rows per page' selector"
   - "Add inline editing for critical fields (rename job, change date)"

3. **For enhanced modals:**
   - "Add validation indicators (red borders on empty required fields)"
   - "Show a progress indicator (Step 1 of 3) for multi-step forms"
   - "Include a success confirmation screen after form submission"

4. **For error/loading states:**
   - "Design a skeleton loading state for the dashboard"
   - "Create an error message design for failed API calls"
   - "Show a 404 page for missing resources"

5. **For mobile responsiveness:**
   - "Design the dashboard for iPad (768px width)"
   - "Show how routes list collapses to a 1-column layout on mobile"
   - "Design a hamburger menu version of the sidebar"

---

## **Questions to Refine Before Generation**

1. Do you prefer a **light theme** (white) or **dark theme** (charcoal)?
2. Should the **sidebar be always visible** or collapsible?
3. Do you want **real company branding** (logo, colors) or generic Caicos branding?
4. Should the **dashboard auto-refresh** with real-time data (show indicator)?
5. Do you need **mobile/tablet mockups** or desktop-only?
6. Should **tables have bulk action checkboxes** (select multiple rows)?
7. Do you want **advanced filters** (date range pickers, multi-select) or simple dropdowns?
8. Should **payroll approval have a confirmation workflow** (2-step process)?

---

**Ready to generate?** Paste the prompt above into ChatGPT in Canva, Google Stitch, or Figma AI and iterate! 🎨

---

## **Implementation Notes for Your Presentation**

### **How to Use This Prompt**
1. **Open ChatGPT in Canva:** canva.com → AI Design → Paste the "START HERE" prompt
2. **Or Google Stitch:** stitch.google.com → New Design → Paste prompt
3. **Or Figma AI (Ace):** figma.com → Create file → Paste into AI comment/prompt field
4. **Refine:** Ask for variations, dark mode, mobile layouts, interactions

### **Post-Generation Customization**
- [ ] Update company logo with your actual Caicos branding
- [ ] Replace sample data (technician names, pool numbers, addresses) with real examples
- [ ] Adjust color palette to match your brand guidelines
- [ ] Add company-specific fields (e.g., billing hours, service packages)
- [ ] Export individual screens as high-res PNGs for PowerPoint

### **Presentation Flow**
1. **Start with Login** → Shows security & professionalism
2. **Dashboard Overview** → Real-time visibility, key metrics
3. **Routes & Jobs** → Operational backbone (route creation, job assignment)
4. **Reports & Payroll** → ROI story (time savings, accuracy, payroll automation)
5. **Settings** → Scalability & flexibility

### **Customer Talking Points**
- **For Owners:** "Complete visibility into technician work, real-time completion tracking"
- **For Dispatchers:** "One-click job creation, route optimization, photo evidence"
- **For Payroll:** "Automated weekly reports, verified completion, export-ready for processing"
- **For Growth:** "Scales from 5 to 100+ technicians without manual overhead"

---

**Status:** Complete design specification ready for AI generation

*Created for: AGA Social (Caicos App Project)*
