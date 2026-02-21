# Admin Portal – Scan & Plan

After copying the example-app (iablee) into admin-portal, this doc summarizes what’s there, what Caicos needs, and a phased plan to get to the required pages.

---

## 1. Current state (what you have)

### Branding & config
- **package.json**: name `"iablee-app"`, Next **16.1.1**, React 19, **next-intl**, Turbopack, Tailwind v4.
- **CLAUDE.md**: Still describes “Iablee” (digital assets, beneficiaries, i18n).
- **Routes**: All under **`[locale]`** (en/es). No top-level `/dashboard` or `/jobs`; everything is `/[locale]/...`.

### App routes (current)

| Area | Path | Purpose (example-app) |
|------|------|------------------------|
| **Landing** | `(landing)/page.tsx`, `layout.tsx` | Marketing/landing |
| **Auth** | `[locale]/auth/login`, `register`, `callback`, `page`, `test-redirect` | Login, register, OAuth |
| **Dashboard** | `[locale]/(dashboard)/dashboard/page.tsx` | Main dashboard |
| **Digital assets** | `[locale]/(dashboard)/digital-assets/page.tsx` | Iablee: assets list |
| **Beneficiaries** | `[locale]/(dashboard)/beneficiaries/page.tsx` | Iablee: beneficiaries |
| **Billing** | `[locale]/(dashboard)/billing/page.tsx`, `billing/plans/page.tsx` | Iablee: Stripe/billing |
| **Wizard** | `[locale]/(dashboard)/wizard/page.tsx`, `layout.tsx` | Iablee: onboarding |
| **Settings** | `[locale]/(dashboard)/settings/page.tsx`, `preferences`, `security` | Profile, preferences, security |

### API routes (current)
- **Auth**: login, register, logout, callback, oauth/start, session.
- **Assets**: assets, assets/[assetId], attachments, asset-types.
- **Beneficiaries**: beneficiaries, beneficiaries/[id].
- **Billing**: plans, payment-methods, subscriptions, invoices, webhooks (Stripe, PayU).
- **User**: profile, password.
- **Security**: set-pin, change-pin, verify-pin, forgot-pin, check-session, verify-reset-code.
- **Other**: dashboard, relationships, subscription (status, check-limit), storage/upload, wizard/complete.

### Data model (current)
- **Example-app schema**: `users`, `digital_assets`, `beneficiaries`, billing tables, etc.
- **Caicos schema** (in `docs/schema.sql`): **`caicos_companies`**, **`caicos_profiles`**, **`caicos_properties`**, **`caicos_service_jobs`**, **`caicos_service_reports`**, **`caicos_report_photos`** — not yet used in admin-portal.

### Layout & nav
- **ClientLayout** → **LayoutWrapper** (sidebar + Navbar, Profile at bottom, optional SecurityPinModal).
- **Navigation.tsx**: Dashboard, Digital Assets, Beneficiaries, Billing, Setup Wizard (all with `[locale]` links).
- **Navbar**: Mobile menu, etc.

### Reusable pieces to keep
- **UI**: `components/ui/*` (button, input, card, form, label, dialog, dropdown-menu, etc.).
- **Auth flow**: Auth form pattern, login/register API, middleware (needs to be adapted for Caicos + optional locale).
- **Layout pattern**: Sidebar + main content + profile footer.
- **Supabase**: Server/client helpers (to be switched to Caicos schema and RLS).

---

## 2. Required Caicos pages (from FEATURE-ADMIN-PORTAL.md)

| Route | Purpose |
|-------|--------|
| **Auth** | |
| `/auth/login` | Email/password, “Create Company” link, Forgot password |
| `/auth/register` | Full Name, Email, **Company Name**, Password, Confirm, terms |
| **Dashboard** | |
| `/dashboard` | Summary cards (jobs today, completed, pending, active technicians), recent jobs, quick actions (Create job, Property, Invite tech) |
| **Jobs** | |
| `/dashboard/jobs` or `/jobs` | List with filters (date, technician, status), Create job, rows: property, tech, time, status, actions |
| `/jobs/new` (or modal) | Create: property, technician, date, time, duration, route order, notes |
| `/jobs/[id]` | Job detail + embedded service report (readings, equipment, tasks, photos, notes, follow-up), Edit/Print/Delete |
| **Properties** | |
| `/properties` | List (search, filters), Create property, cards: name, address, type/surface, phone, status |
| `/properties/[id]` | Property detail (customer, address, pool details, equipment notes) |
| `/properties/new` | New property form |
| **Team** | |
| `/team` | Technicians list (invite, deactivate) |
| `/team/new` | Invite modal/page |
| `/team/[id]` | Technician detail |
| **Reports** | |
| `/reports` | List with filters (date range, tech, property), columns: property, tech, date, status |
| `/reports/[id]` | Report detail: chemical readings, equipment, tasks, chemicals added, photos, notes, follow-up, Export PDF |
| **Settings** | |
| `/settings` | Company settings (and optionally profile) |

SOLUTION.md suggests routes under **`/dashboard`** (e.g. `/dashboard/jobs`, `/dashboard/properties`). FEATURE uses both `/jobs` and “Dashboard → Jobs”; we can standardize on **`/dashboard/jobs`**, **`/dashboard/properties`**, **`/dashboard/technicians`**, **`/dashboard/reports`**, **`/dashboard/settings`** for consistency.

---

## 3. Gap summary

| Required | Current | Action |
|----------|---------|--------|
| Auth: login with company context | Login exists (generic) | Adapt copy, add “Create Company” → register |
| Auth: register with **Company Name** | Register exists (no company) | Add company name, create `caicos_companies` + owner profile |
| Dashboard with job/property/tech stats | Dashboard exists (iablee) | Replace with Caicos KPIs + recent jobs + quick actions |
| Jobs list + filters + create + detail | Missing | New: jobs list, job form, job detail (+ report) |
| Properties list + detail + new | Missing | New: properties list, property form, property detail |
| Team (technicians) list + invite + detail | Missing | New: team list, invite flow, technician detail |
| Reports list + detail (readings, photos, PDF) | Missing | New: reports list, report detail |
| Settings (company) | Settings exists (profile/preferences/security) | Add company settings or repurpose |
| Data layer | Iablee (users, assets, beneficiaries) | Add Caicos types + APIs for companies, profiles, properties, jobs, reports |
| Nav items | Dashboard, Digital Assets, Beneficiaries, Billing, Wizard | Replace with: Dashboard, Jobs, Properties, Team, Reports, Settings |
| Locale | All routes under `[locale]` | Decide: keep i18n and `[locale]` or simplify to single locale for MVP |

---

## 4. Phased plan

### Phase 0 – Foundation (do first)
1. **Rename & brand**
   - `package.json`: name → `admin-portal` (or `caicos-admin`), ensure Next/React versions are supported on your stack.
   - Replace “Iablee” / “iablee” with “Caicos” in UI and CLAUDE.md / README.
2. **Route strategy**
   - Decide: keep **`[locale]`** (en/es) or drop it for MVP and use flat `/dashboard`, `/auth`, etc.
   - If keeping locale: all new pages live under `[locale]/(dashboard)/...` and auth under `[locale]/auth/...`.
   - If dropping: move to flat structure and update middleware + links.
3. **Supabase + types**
   - Add **Caicos** types (from `docs/schema.sql`): `caicos_companies`, `caicos_profiles`, `caicos_properties`, `caicos_service_jobs`, `caicos_service_reports`, `caicos_report_photos`.
   - In `lib/` add `supabase.ts` (or adapt existing) with these types and **company_id**-scoped RLS in mind.
4. **Navigation**
   - Update **Navigation** (and any nav config) to: **Dashboard**, **Jobs**, **Properties**, **Team**, **Reports**, **Settings**.
   - Remove or hide: Digital Assets, Beneficiaries, Billing, Wizard (or stub links for later).

### Phase 1 – Auth & dashboard
5. **Login**
   - Keep existing login page/API; adjust copy to “Caicos Admin”, add link to “Create Company” (→ register).
   - Ensure redirect after login goes to `/dashboard` (or `/[locale]/dashboard`).
6. **Register**
   - Add **Company Name** (required); on submit create `auth.users` (Supabase Auth), then `caicos_companies` row and `caicos_profiles` row with role `owner`.
   - Redirect to dashboard after signup.
7. **Dashboard**
   - Replace current dashboard content with:
     - 4 KPI cards: Jobs today, Completed, Pending, Active technicians (query Caicos tables).
     - Recent jobs list (e.g. latest 5).
     - Quick actions: Create job, Create property, Invite technician (links or buttons to the right pages).

### Phase 2 – Jobs
8. **Jobs list** – `dashboard/jobs/page.tsx` (or `jobs/page.tsx`)
   - Filters: date range, technician, status.
   - Table/cards: property, technician, scheduled time, status; actions: View, Edit, Delete.
   - “Create job” button → job form (page or modal).
9. **Create job** – `dashboard/jobs/new/page.tsx` (or modal)
   - Form: property (dropdown), technician (dropdown), date, time, duration, route order, notes.
   - POST to API that inserts `caicos_service_jobs`.
10. **Job detail** – `dashboard/jobs/[id]/page.tsx`
    - Job info (property, technician, date, time, status).
    - If job has a report: show service report block (readings, equipment, tasks, photos, notes, follow-up).
    - Actions: Edit, Print, Delete.

### Phase 3 – Properties
11. **Properties list** – `dashboard/properties/page.tsx`
    - Search, filters (status, pool type); “Create property”.
    - Cards/table: customer name, address, pool type/surface, phone, status; Edit, View jobs, Delete.
12. **Property detail** – `dashboard/properties/[id]/page.tsx`
    - Customer info, address, pool details, equipment notes; Edit, View jobs.
13. **New property** – `dashboard/properties/new/page.tsx`
    - Form for all `caicos_properties` fields; POST to API.

### Phase 4 – Team (technicians)
14. **Team list** – `dashboard/technicians/page.tsx` (or `team/page.tsx`)
    - List profiles with `role = 'technician'` (and admin if needed); invite button; deactivate.
15. **Invite** – `dashboard/technicians/new/page.tsx` or modal
    - Create invite (e.g. link or email); optionally create `caicos_profiles` with `is_active = false` until they sign up.
16. **Technician detail** – `dashboard/technicians/[id]/page.tsx`
    - Profile, assigned jobs, activity.

### Phase 5 – Reports
17. **Reports list** – `dashboard/reports/page.tsx`
    - Filters: date range, technician, property; list from `caicos_service_reports` (join job, property, profile).
18. **Report detail** – `dashboard/reports/[id]/page.tsx`
    - Chemical readings, equipment checks, tasks, chemicals added, photos, notes, follow-up; “Export PDF” (can stub first).

### Phase 6 – Settings & cleanup
19. **Settings**
    - Add or repurpose settings for **company** (name, logo, phone, address). Keep profile/preferences/security if useful.
20. **Remove or stub Iablee**
    - Digital assets, beneficiaries, billing, wizard: remove from nav and optionally delete routes or leave as 404/stub.
21. **APIs**
    - Add CRUD APIs (or Server Actions) for: companies (if needed), properties, jobs, reports, profiles (team), and ensure all use `company_id` from session (RLS).

---

## 5. Suggested order of implementation

1. **Phase 0** – Foundation (rename, nav, Caicos types, route strategy).
2. **Phase 1** – Auth (register with company) + Dashboard (KPIs + recent jobs + quick actions).
3. **Phase 2** – Jobs (list → new → detail).
4. **Phase 3** – Properties (list → new → detail).
5. **Phase 4** – Team (list → invite → detail).
6. **Phase 5** – Reports (list → detail, then PDF).
7. **Phase 6** – Settings + cleanup.

This gets you from the current example-app copy to the required Caicos admin pages in a clear sequence. If you tell me your preference (e.g. keep or drop `[locale]`, and exact path names), the next step is to implement Phase 0 and Phase 1 in the codebase.
