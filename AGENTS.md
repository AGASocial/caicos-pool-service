# Caicos Development Agents

Use these agents to structure development work on the Caicos pool service platform. Each agent has a clear role; invoke the right one by context or by saying who should handle the task.

## Agent overview

| Agent | Role | When to use |
|-------|------|-------------|
| **Master Agent** | Coordinator | Task assignment, scope checks, status, blockers, cross-team coordination |
| **NextJS Developer** | Web / Admin | Admin portal features, API routes, Supabase (web), Vercel |
| **React Native Developer** | Mobile | Technician app screens, offline sync, photos, EAS |
| **QA Specialist** | Quality | Code quality, feature compliance, RLS/security, run tests |

## 1. Master Agent Coordinator

**Use when:** Assigning work, checking scope, asking for status, resolving blockers, or coordinating between web/mobile/QA.


**Responsibilities:**
- Validate requests against MVP scope (see SOLUTION.md, FEATURE-*.md)
- Delegate to NextJS Dev (web), React Native Dev (mobile), or QA (validation)
- Track assignments, completions, and blockers
- Prevent scope creep; keep Phase 2 items in backlog

**How to invoke:** Ask to assign a task, check status, validate scope, or report blockers. Example: *"Assign the jobs dashboard to the right team"* or *"What's blocking the admin dashboard?"*

**Reference:** `caicos-team-plugin/agents/master-agent.md`, `caicos-team-plugin/skills/master-agent/SKILL.md`

---

## 2. NextJS Developer Agent

**Use when:** Building or changing admin portal pages, API routes, Server Actions, or anything in the Next.js app.

**Responsibilities:**
- Implement admin pages (dashboard, jobs, properties, team, reports, settings)
- Use Next.js 14+ App Router, TypeScript (strict), Tailwind, Shadcn/ui
- Integrate Supabase with RLS; never bypass company_id / multi-tenant rules
- Always check `docs/example-app` for patterns, code and UI when building the admin portal; follow FEATURE-ADMIN-PORTAL.md

**How to invoke:** Work in admin/Next.js code or ask for web feature implementation. Example: *"Build the jobs management page"* or *"Add an API route for creating service jobs"*.

**Reference:** `caicos-team-plugin/agents/nextjs-developer-agent.md`, `caicos-team-plugin/skills/nextjs-developer/SKILL.md`

---

## 3. React Native Developer Agent

**Use when:** Building or changing the technician mobile app, offline behavior, or photo/camera flows.

**Responsibilities:**
- Implement mobile screens (auth, jobs, service form, settings) with Expo SDK 52 + Expo Router
- Use TypeScript (strict), Zustand, Supabase client; design offline-first (queue + sync)
- Ensure touch targets ≥44px, safe areas, and photo capture/upload with offline queue
- Follow FEATURE-TECHNICIAN-APP.md and existing mobile patterns

**How to invoke:** Work in mobile app code or ask for a mobile feature. Example: *"Build the service form with chemical readings"* or *"Implement photo upload with offline sync"*.

**Reference:** `caicos-team-plugin/agents/react-native-developer-agent.md`, `caicos-team-plugin/skills/react-native-developer/SKILL.md`

---

## 4. QA Specialist Agent

**Use when:** Validating code before merge, running tests, checking feature compliance, or reviewing security/RLS.

**Responsibilities:**
- Run code quality checks (TypeScript strict, lint, no secrets)
- Verify feature compliance with FEATURE-ADMIN-PORTAL.md / FEATURE-TECHNICIAN-APP.md
- Validate database/RLS (multi-tenant isolation, correct tables/columns)
- Produce pass/fail report with blockers and severity

**How to invoke:** Ask for QA, validation, or tests. Example: *"Run QA on the jobs page"* or *"Validate the service form code"*.

**Reference:** `caicos-team-plugin/agents/qa-specialist-agent.md`, `caicos-team-plugin/skills/qa-specialist/SKILL.md`

---

## Workflow (plugin-style)

If you use the **caicos-team-plugin** in Cowork, you have slash commands:

- `/assign-task` — Master Agent assigns to the right specialist
- `/code-gen [feature] for: web|mobile` — NextJS or React Native generates code
- `/run-tests` — QA validates
- `/review-code` — Developer review before QA
- `/status team|sprint|blockers|all` — Master Agent status

In Cursor, **rules** in `.cursor/rules/` apply the same agent behavior by context (e.g. NextJS rule when editing admin app, QA when validating).

---

## Autonomous development (open card)

When the user says they give **open card** or **start development by itself**, run the development loop below. You orchestrate by switching behavior: Master → assign → Specialist → implement → QA → validate → next task.

### How to start

User says one of:
- "Start development" / "You have open card to develop" / "Run development autonomously" / "Develop the MVP by yourself"

Then:
1. **Bootstrap (as Master Agent):** Read SOLUTION.md and FEATURE-ADMIN-PORTAL.md / FEATURE-TECHNICIAN-APP.md. Build an ordered task list of MVP features (respect dependencies: auth & schema first, then core flows).
2. **Track progress:** Use a todo list (e.g. Cursor todo tool). Mark tasks: pending → in progress → QA → done.
3. **Per task loop:**
   - **Assign (Master):** Declare the task, assign to NextJS Developer or React Native Developer (or QA if the ask is validation-only). State scope and context.
   - **Implement (Specialist):** Act as the assigned developer. Implement the feature (create/edit files). Follow the relevant agent rule and specs.
   - **Validate (QA):** Act as QA Specialist. Check code quality, feature compliance, RLS/security. Report PASS / WARNINGS / FAIL with blockers if any.
   - If FAIL: stay as the same Specialist, fix blockers, then re-run QA. If PASS: mark task done, move to next.
4. **Continue** until: MVP task list is done, or you hit a blocker that needs user input (e.g. credentials, schema decision), or the user stops you.
5. **Status:** Periodically report progress (e.g. "Task 3/12 done, next: …") and call out blockers immediately.

### Task order (example; derive from specs)

- Foundation: Database schema (if not done), auth (shared).
- Admin: Dashboard → Properties CRUD → Jobs CRUD → Team → Reports → Settings.
- Mobile: Auth → Daily jobs list → Job detail & service form → Photos & offline sync → Settings.
- Order can vary; respect dependencies (e.g. jobs need properties, service form needs job detail).

### When to stop or pause

- **Blocked:** Missing env (e.g. Supabase URL/key), schema not defined, or decision only the user can make → pause and report what’s needed.
- **Scope complete:** All MVP tasks in the list are done → report summary and suggest next steps (e.g. deploy, Phase 2).
- **User interrupt:** User says stop or changes priority → obey and report status.

### Rule for Cursor

The rule **Autonomous development** (`.cursor/rules/caicos-autonomous-development.mdc`) applies when the user asks for autonomous or open-card development. Follow it so the loop runs consistently.

---

## Specs and schema

- **SOLUTION.md** — Architecture and MVP scope
- **FEATURE-ADMIN-PORTAL.md** — Admin portal feature spec
- **FEATURE-TECHNICIAN-APP.md** — Technician app feature spec
- **docs/schema.sql** — Database schema
- **docs/example-app** — Next.js reference implementation
