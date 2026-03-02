# 🎨 AI-Generated Design Prompt: Technician Mobile App
**For: ChatGPT via Canva | Google Stitch | Figma AI**

---

## **Project Brief**

Create a modern, mobile-first app interface design system for **Caicos Technician App** — a field service management platform for pool maintenance professionals. The app enables technicians to complete daily service jobs, document work with GPS-tagged photos, and report issues in real-time, with offline capability.

**Target Audience:** Field technicians, dispatchers, and pool service business owners
**Platform:** iOS & Android (React Native/Expo)
**Use Case:** Customer presentation deck showcasing app flows and UX

---

## **Design System Foundations**

### **Color Palette**
- **Primary Brand:** `#0066CC` (Professional Blue - trust, reliability)
- **Secondary:** `#00AA44` (Fresh Green - health, completion, "OK" status)
- **Warning:** `#FF9900` (Amber - caution, chemistry alerts)
- **Error:** `#DD3333` (Red - issues, problems)
- **Neutral:** `#F5F5F5` (Light Gray - backgrounds)
- **Dark Neutral:** `#2C3E50` (Charcoal - text, headers)
- **Accent:** `#FFD700` (Gold - progress, achievements)

### **Typography**
- **Headlines:** Sans-serif, bold, 24-28px (e.g., Inter, Segoe UI)
- **Body Text:** Sans-serif, regular, 14-16px
- **Labels & Buttons:** Sans-serif, medium, 12-14px
- **Status Text:** Monospace for readings (pH, ppm values)

### **Spacing & Layout**
- Mobile-first, 375px-414px width (iPhone 12/14 standard)
- 16px padding margins (safe area)
- 8px micro-spacing for component details
- Bottom tab navigation (Jobs, Properties, Profile)
- Header height: 56-64px with company branding

### **UI Components**
- **Buttons:** Rounded corners (8-12px radius), min 44px height (accessibility)
- **Cards:** 12px border radius, subtle shadow (0 4px 12px rgba(0,0,0,0.08))
- **Inputs:** Rounded 8px, 1px border, focus state color change to primary
- **Progress Bar:** Animated, gradient optional (blue → green)
- **Status Badges:** Pill-shaped, color-coded (blue=pending, orange=in-progress, green=completed)

---

## **Key Screens to Design**

### **Screen 1: Login / Authentication**
**Visual Style:** Clean, centered, trust-focused

**Layout Elements:**
- [ ] Caicos logo/wordmark at top (60x60px)
- [ ] Two input fields: Email, Password (full width, rounded)
- [ ] "Remember me" checkbox (accent color when checked)
- [ ] Large primary button: "SIGN IN →" (full width, 48px height)
- [ ] Link text: "Don't have account? Create one" (blue, 14px)
- [ ] Subtle gradient background (light blue → white, very faint)
- [ ] Tap target: 44x44px minimum for all interactive elements

**Visual Hints:**
- Emphasize security (lock icon optional next to password)
- Calm, professional tone
- Form should feel quick & efficient

---

### **Screen 2: Daily Jobs Dashboard**
**Visual Style:** Task-focused, progress-driven, motivational

**Layout Elements:**
- [ ] Header: Company logo (left), date (center), settings icon (right)
- [ ] Card 1 - Route Info:
  - Date: "Tuesday, Feb 21"
  - Route name: "🛣️ Ruta 1" (badge)
  - Subtitle: "(Same route daily)" in gray
- [ ] Progress Section:
  - Heading: "PROGRESS: 0 of 22"
  - Animated progress bar (0% full, blue gradient)
  - Text below: "0% Complete" in gray
- [ ] House Cards (scrollable list):
  - Each card: 100% width, 12px radius, shadow
  - House number (large, 20px, bold): "5461"
  - Customer name: "Residencia Miller" (gray)
  - Address: "📍 1244 Blue Water" (small, gray)
  - Status badge: "⏳ Pending" (blue pill)
  - CTA Button: "Start Service" (secondary style, teal/blue outline)
- [ ] Empty scroll area with "see more" hint
- [ ] Bottom tab bar: Jobs (active/highlighted), Properties, Me

**Visual Hints:**
- Progress bar should feel rewarding as it fills
- Cards should feel tappable/interactive (subtle shadow on hover/active state)
- Use icons (pool 🏊, location 📍, timer ⏳) for visual scanning
- Light background, high contrast text

---

### **Screen 3: Service Form / Job Detail**
**Visual Style:** Data-rich, organized, action-oriented

**Layout Elements:**
- [ ] Header: Back arrow, "Job #1" title, optional sync indicator
- [ ] Property Header Card (non-editable):
  - Pool icon (🏊)
  - Customer name: "Residencia Miller" (large)
  - Address: "1244 Blue Water" (gray)
  - Gate code: "🔑 Gate: 1234" (small badge)
  - Status: "Pending" or "In Progress" (color-coded badge)
- [ ] Green "START" Button (prominent, 48px) - only shown when status=pending
- [ ] Collapsible Sections (after START tapped):

  **Section 1: 💧 Chemical Readings**
  - 7 input fields in a 2-column layout:
    - pH: [input] | Ideal: 7.2-7.6 pH
    - Chlorine: [input] | Ideal: 1-3 ppm
    - Alkalinity: [input] | Ideal: 80-120 ppm
    - (etc.)
  - Invalid inputs: Yellow border/highlight
  - Monospace font for numbers

  **Section 2: ✅ Tasks (Toggles)**
  - 6 task items, each with React Switch/toggle:
    - ☐ Skimmed surface
    - ☑ Vacuumed floor (example: checked)
    - ☐ Brushed walls & steps
    - (etc.)
  - Green when checked, gray when unchecked

  **Section 3: 🔧 Equipment Status**
  - 4 equipment items, each with two buttons:
    - Pump: [OK (green)] [ISSUE (red)]
    - Filter: [OK] [ISSUE]
    - (etc.)
  - Selected button: solid color, unselected: outlined

  **Section 4: 📷 Photos**
  - Two buttons: [📷 Camera] [🖼️ Gallery]
  - Grid of photo thumbnails (90x90px, 2-column)
  - Remove (X) icon on each thumbnail
  - Info text: "✓ GPS + timestamp captured"
  - Allow up to 5 photos

  **Section 5: ⚠️ Issue Category (Required)**
  - Single-select button group (6 options):
    - [✓ No Issues] (default)
    - [⚠️ Motor]
    - [⚠️ Filter]
    - [⚠️ Circulation]
    - [⚠️ Timer]
    - [⚠️ Chemistry]
    - [📝 Other] → reveals text field if selected
  - Selected: solid blue background, white text
  - Unselected: outlined blue border, blue text

  **Section 6: 📝 Comments & Notes**
  - Large text area (80px min height)
  - Placeholder: "Service notes, observations, issues..."
  - Gray border, blue focus state

  **Section 7: Follow-up Notes (optional)**
  - Smaller text area (60px min height)
  - Placeholder: "e.g., Check heater tomorrow — parts on order"

- [ ] Bottom Action Button: "MARK COMPLETE" (full width, green, 48px)
  - Only enabled when:
    - At least 1 photo taken
    - Issue category selected
    - Form validated
  - Show spinner during submission
  - Success toast: "✓ House completed"

**Visual Hints:**
- Sections should be clearly separated (light dividers)
- Icons aid visual hierarchy
- Form should feel methodical but not overwhelming
- Color changes on valid/invalid inputs
- Mobile-friendly: large touch targets, ample spacing

---

### **Screen 4: Properties Directory**
**Visual Style:** Reference list, searchable, professional

**Layout Elements:**
- [ ] Header: "CAICOS" (left), Search icon (right)
- [ ] Heading: "Properties (12)"
- [ ] Filter dropdown: "[All ▼]" (filterable by type: residential, commercial)
- [ ] Property Cards (similar to job cards):
  - Customer name: "Residencia Smith" (large)
  - Address: "1244 Blue Water" (gray)
  - Pool type: "💧 Residential" (small badge, gray)
  - Phone: "📞 (555) 123-4567" (optional, gray)
  - Tap to expand/navigate to detail view
- [ ] Scrollable list
- [ ] Search bar (optional): Full-width, rounded, icon left

**Visual Hints:**
- Consistent card styling with job list
- Professional, reference-like feel
- Easy to scan (names, addresses, types)

---

### **Screen 5: Profile / Settings**
**Visual Style:** Personal, clear, minimal

**Layout Elements:**
- [ ] Header: "CAICOS" (left), Settings icon (right)
- [ ] Profile Card:
  - Avatar placeholder (circular, 80px, initials or default icon)
  - Name: "John Technician" (bold)
  - Email: "john@caicos.com" (gray)
  - Role: "Technician" (badge, blue)
  - Company: "Caicos" (gray)
- [ ] Editable Fields:
  - Full Name: [text input]
  - Email: [read-only, grayed]
  - Phone: [text input]
- [ ] "SAVE CHANGES" button (blue, full width)
- [ ] Divider (light gray line)
- [ ] App Info Section:
  - Version: 1.0.0
  - Build: 42
- [ ] Action Buttons:
  - "LOGOUT" (gray outline)
  - "DELETE ACCOUNT" (red outline, destructive warning)

**Visual Hints:**
- Clean, minimal aesthetic
- Clear distinction: read-only vs. editable fields
- Destructive actions clearly marked (red)

---

## **Visual Design Specifications**

### **Iconography**
- Use **Feather Icons** or **Material Design Icons** (consistent set)
- All icons: 20-24px standard size
- Icon colors: Match text color or use accent color for active states
- Examples to include:
  - 🏊 Pool (house/property)
  - 📍 Location/GPS
  - ⏳ Pending/In Progress
  - ✅ Complete/Checkmark
  - ⚠️ Warning/Issue
  - 📷 Camera
  - 🔧 Equipment
  - 💧 Water/Chemistry
  - 📝 Notes
  - ⚙️ Settings
  - 📞 Phone

### **Animations & Micro-interactions**
- **Progress bar:** Smooth fill animation (0.5s duration)
- **Button states:** Subtle scale (1.02x) + shadow depth on press
- **Toggles:** Smooth slide transition (0.3s)
- **Cards:** Fade-in on load, 0.2s duration
- **Form inputs:** Blue border glow on focus
- **Success feedback:** Green checkmark animation + toast notification slide-up

### **Dark Mode Consideration** (Optional)
- All colors should have dark mode variants
- E.g., backgrounds: light gray → dark charcoal
- Text: dark → light
- Borders: add opacity for dark mode

---

## **Layout Grid & Responsive Design**

### **Mobile (375px - 414px)**
- 16px left/right margin
- Full-width cards with 12px padding
- Two-column grids where applicable
- Bottom navigation always visible
- Safe area top/bottom respected

### **Tablet (iPad, 768px+)** - Future
- 3-column layouts possible
- Side navigation optional
- Larger touch targets

---

## **Typography Hierarchy**

| Level | Size | Weight | Use Case |
|-------|------|--------|----------|
| H1 | 28px | Bold | Screen titles, header "PROGRESS:" |
| H2 | 24px | Bold | Card titles, customer names |
| H3 | 18px | Semi-bold | Section headers, "💧 Chemical Readings" |
| Body | 16px | Regular | Descriptions, labels |
| Caption | 12px | Regular | Helper text, metadata (address, gate code) |
| Mono | 14px | Regular | Data inputs (pH, ppm readings) |

---

## **Validation & Error States**

### **Input Validation**
- **Valid:** Green checkmark icon, green border (optional)
- **Invalid:** Red border, red icon, error message below input
- **Warning (out of range):** Yellow/amber border, warning icon
- **Focus state:** Blue border (primary color), subtle shadow

### **Loading States**
- Spinner (rotating circle, primary color)
- Skeleton screens (shimmer effect) for async data
- Button state: Disabled + spinner during submission

### **Success States**
- Green checkmark (animated)
- Toast notification: "✓ House completed"
- Progress bar update (animated)

### **Error Messages**
- Clear, actionable text (not technical jargon)
- Example: "At least 1 photo required" (not "validation_error: photo_count")
- Placed below the problematic field

---

## **Copy & Tone**

### **Button Labels**
- Action-oriented, concise
- "START SERVICE" (not "Begin")
- "MARK COMPLETE" (not "Submit")
- "SIGN IN →" (arrow suggests forward motion)

### **Microcopy**
- Helpful, encouraging tone
- "Tap START to begin service" (instructional)
- "(Same route daily)" (contextual hint)
- "✓ GPS + timestamp captured" (reassurance)

### **Empty States**
- Friendly, not empty: "No houses assigned today"
- Include icon + brief explanation

---

## **Customer Presentation Context**

**Design should convey:**
1. **Efficiency:** Clean layouts, minimal friction to task completion
2. **Trust:** Professional colors, clear data hierarchy, security indicators
3. **Field-Ready:** Large touch targets, high contrast (outdoor visibility)
4. **Offline Capability:** Sync indicators, "Pending" status messaging
5. **Results-Driven:** Progress visualization, completed job feedback
6. **Accuracy:** GPS/timestamp metadata, photo evidence, issue categorization

---

## **Design Assets to Generate**

### **High Priority**
1. ✅ Login screen (full detail)
2. ✅ Daily jobs dashboard (with 3-4 sample house cards)
3. ✅ Service form (show all sections collapsed, then one expanded as example)
4. ✅ Success completion screen
5. ✅ Properties list screen
6. ✅ Settings/Profile screen

### **Medium Priority**
7. Error states (invalid credentials, network error, validation failure)
8. Loading states (skeleton form, spinner buttons)
9. Offline indicator (banner at top)
10. Sync success toast notification

### **Enhancement** (Nice-to-have)
11. Onboarding/Welcome screens
12. Photo capture screen mockup
13. Issue category selection detail
14. Dark mode versions of 2-3 key screens

---

## **Design File Specifications for Output**

### **Canvas/Stitch Output Format**
- **Artboards per screen:** One artboard = one complete screen
- **Naming convention:**
  - `Screen_01_Login`
  - `Screen_02_Dashboard`
  - `Screen_03_ServiceForm`
  - `Screen_04_Properties`
  - `Screen_05_Profile`
  - `State_01_LoadingSpinner`
  - `State_02_ErrorValidation`
  - `State_03_SuccessToast`
- **Dimensions:** 390px (width) × 844px (height) — iPhone standard
- **Safe area:** Top 44px, Bottom 34px (account for notch + home indicator)
- **Format:** High-res (2x pixels for mobile) or vector-based

### **Deliverable Quality**
- Production-ready mockups (pixel-perfect)
- All text editable (not rasterized)
- Components grouped logically (header, card, button, etc.)
- Color swatches exported separately
- Icon libraries linked (not rasterized)

---

## **Example Prompt for ChatGPT in Canva / Google Stitch**

*Copy-paste this into your AI design tool:*

---

### **START HERE: Copy-Paste into Canva/Stitch AI**

"Design a modern mobile app interface for **Caicos Technician App**, a field service management platform for pool maintenance. Create 6 screens in iPhone dimensions (390x844px):

1. **Login Screen** — Clean, centered, professional. Include Caicos logo, email/password fields, 'Remember me' checkbox, 'SIGN IN →' button (primary blue), signup link below.

2. **Daily Jobs Dashboard** — Show date (Tuesday, Feb 21), route name (Ruta 1), progress bar (0 of 22 completed), and 3 sample house cards with customer names, addresses (📍), and 'Start Service' buttons. Use blue progress bar, white/light gray background.

3. **Service Form** — After technician taps START, show collapsible sections:
   - 💧 Chemical Readings (7 input fields: pH, Chlorine, etc., with ideal ranges)
   - ✅ Service Tasks (6 checkboxes: Skimmed surface, Vacuumed, etc.)
   - 🔧 Equipment Status (4 items, each with [OK] [ISSUE] buttons)
   - 📷 Photo section (Camera/Gallery buttons, grid of 90x90px thumbnails)
   - ⚠️ Issue Category (6 single-select buttons: No Issues, Motor, Filter, etc.)
   - 📝 Comments & Follow-up Notes (text areas)
   - Large green 'MARK COMPLETE' button at bottom

4. **Success Screen** — After job completion. Show checkmark animation, 'House completed' message, option to return to dashboard.

5. **Properties Directory** — Scrollable list of properties. Show customer name, address, pool type (e.g., 💧 Residential), phone number. Include search bar and filter dropdown.

6. **Profile/Settings** — Avatar placeholder, editable name/phone fields, app info (v1.0.0), and action buttons (Save Changes, Logout, Delete Account). Keep minimal and clean.

**Design System:**
- Colors: Primary Blue (#0066CC), Success Green (#00AA44), Warning Amber (#FF9900), Error Red (#DD3333), Neutral Light Gray (#F5F5F5)
- Typography: Bold sans-serif for headers (28px), regular for body (16px), monospace for data (14px)
- Components: Rounded corners (12px), minimum 44px tap targets, card shadows (0 4px 12px), bottom tab navigation
- Icons: Use Feather or Material Icons (pool, location, camera, settings, etc.)
- Tone: Professional, efficient, field-ready (high contrast for outdoor use)

**Output:** Create artboards for each screen, group components logically, make text editable, export color palette separately."

---

## **Implementation Notes for Your Presentation**

### **How to Use This Prompt**
1. **Open ChatGPT in Canva:** canva.com → click AI Design button → paste above prompt
2. **Or Google Stitch:** stitch.google.com → New Design → Paste prompt into generation field
3. **Or Figma AI (Ace):** figma.com → create file → paste prompt into comment
4. **Refine:** Ask for variations like:
   - "Show the form in a different layout (horizontal scroll vs. vertical)"
   - "Add a dark mode variant of the dashboard"
   - "Create an error state for network timeout"
   - "Show the form 80% complete (fields filled in)"

### **Post-Generation Customization**
- [ ] Update Caicos logo with your actual brand
- [ ] Replace sample data (customer names, addresses) with real examples
- [ ] Adjust colors to match your brand guide (if different from suggested palette)
- [ ] Add company name/tagline in header
- [ ] Export individual screens as PNGs for PowerPoint presentation

### **Presentation Tips**
- **Flow:** Show login → dashboard → start service → complete → success
- **Highlight:** Emphasize offline capability, GPS accuracy, one-tap completion
- **Interactive:** If possible, link screens in Figma/Canva for click-through demo
- **Focus:** Lead with dashboard (most used) and service form (core value)
- **Client Angle:** "Reduce paperwork, increase accuracy, keep technicians connected"

---

## **Questions to Refine Further**

1. Do you want dark mode variants displayed?
2. Should we include onboarding/welcome screens?
3. Any custom branding colors/logo to incorporate?
4. Do you need tablet/iPad responsive layouts?
5. Should we add a "photo upload success" confirmation screen?
6. Prefer iOS or Android design language (tab bar placement, etc.)?

---

**Ready to generate?** Paste the prompt into ChatGPT in Canva or Google Stitch and iterate! 🎨
