# Caicos Team Plugin

AI-powered development team coordination plugin for the Caicos pool service platform. Orchestrates four specialized agents working together to design, build, and validate the Caicos MVP.

## What's Inside

### 4 Specialized Agents
- **Master Agent Coordinator**: Project management, scope validation, task assignment
- **NextJS Developer Agent**: Web admin portal development with TypeScript & Supabase
- **React Native Developer Agent**: Mobile technician app with offline support
- **QA Specialist Agent**: Code quality, feature compliance, security validation

### 5 Commands
- `/assign-task` — Delegate features to the right team member
- `/code-gen` — Generate production-ready code for features
- `/run-tests` — Validate code quality and compliance
- `/review-code` — Get feedback before QA submission
- `/status` — Check team progress and blockers

### 4 Skills
- Master Agent Coordinator Skill
- NextJS Developer Skill
- React Native Developer Skill
- QA Specialist Skill

### Supabase Integration
- Direct database schema access for code generation
- RLS policy inspection for security
- SQL query execution for testing
- Type-safe database integration

## Quick Start

### Installation

1. Download the `.plugin` file
2. In Cowork: Settings → Plugins → Add Plugin
3. Select the caicos-team plugin file
4. Authorize access

### Configuration

Set these environment variables in your Cowork session:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_API_KEY=your-service-role-key
```

Get these from:
1. Supabase Dashboard
2. Project Settings → API
3. Copy URL and service role key

**Security Note:** Use service role key (admin) only in development. For production, use restricted anon key.

### First Steps

```bash
# 1. Start with status check
/status team

# 2. Assign first feature
/assign-task Build the daily jobs dashboard for mobile

# 3. Generate code
/code-gen Daily jobs dashboard for: mobile

# 4. Validate code
/run-tests Daily jobs screen

# 5. Check progress
/status sprint
```

## MVP Scope

### Technician App (React Native)
- ✅ Authentication & company signup
- ✅ Daily job list with real-time updates
- ✅ Service form with chemical readings
- ✅ Equipment checks & task tracking
- ✅ Photo capture & offline sync
- ✅ Settings & profile
- ✅ Offline-first architecture

### Admin Portal (NextJS)
- ✅ Company owner registration
- ✅ Team member management
- ✅ Property/customer CRUD
- ✅ Service job scheduling
- ✅ Report viewer with exports
- ✅ Company settings
- ✅ Multi-tenant security (RLS)

### Backend
- ✅ Supabase PostgreSQL
- ✅ Row Level Security policies
- ✅ Photo storage
- ✅ Realtime subscriptions
- ✅ Authentication

## Feature Specs Reference

- **SOLUTION.md** — High-level architecture & overview
- **FEATURE-TECHNICIAN-APP.md** — Mobile app detailed spec
- **FEATURE-ADMIN-PORTAL.md** — Web portal detailed spec
- **schema.sql** — Database schema with RLS

## Workflow Example

### Assigning a Feature

```
You: /assign-task Build the service form with chemical readings

Master Agent:
  ✓ Validates scope (MVP)
  ✓ Checks dependencies (job detail screen ready)
  ✓ Assigns to React Native Developer
  → Loads feature spec & database schema
  → Explains context & deliverables
  → Tracks assignment
```

### Generating Code

```
You: /code-gen Service form with chemical readings for: mobile

React Native Developer:
  ✓ Reads FEATURE-TECHNICIAN-APP.md
  ✓ Reviews database schema
  ✓ Checks existing patterns
  → Generates TypeScript component
  → Implements Zustand store
  → Adds Supabase integration
  → Handles offline support
  → Ready for QA
```

### Validating Code

```
You: /run-tests Service form code

QA Specialist:
  ✓ TypeScript type checking
  ✓ Feature compliance testing
  ✓ Database validation
  ✓ Security scanning
  → ✅ PASS or ❌ FAIL with blockers
  → Report with specific issues
  → Developer can quickly fix
```

## Commands Reference

### /assign-task
Delegate work to specialists. Master Agent validates scope and assigns to:
- NextJS Developer (web features)
- React Native Developer (mobile features)
- QA Agent (validation & testing)

**Usage:**
```
/assign-task Build the jobs management page for admins
/assign-task Implement photo upload with offline sync
/assign-task Validate the authentication code
```

### /code-gen
Generate production-ready code for features. Automatically routes to appropriate developer.

**Usage:**
```
/code-gen Jobs management page for: web
/code-gen Service form for: mobile
/code-gen API route for creating jobs for: web
```

### /run-tests
Validate code quality, feature compliance, database integrity, and security.

**Usage:**
```
/run-tests Jobs page code
/run-tests Service form all
/run-tests Authentication security
```

### /review-code
Request feedback from developer specialists before submitting to QA.

**Usage:**
```
/review-code Service form architecture for: mobile
/review-code Admin dashboard queries for: web
```

### /status
Check team progress, current work, blockers, and project status.

**Usage:**
```
/status team        (who's working on what)
/status sprint      (overall progress)
/status blockers    (what's preventing progress)
/status all         (complete picture)
```

## Tech Stack

### Frontend
- **Web:** Next.js 14+, TypeScript, Tailwind CSS, Shadcn/ui, React Query, Zustand
- **Mobile:** React Native, Expo SDK 52, Expo Router, NativeWind, Zustand, React Query

### Backend
- **Database:** Supabase (PostgreSQL, RLS, Auth, Storage)
- **Deployment:** Vercel (web), EAS (mobile)

### Development
- **Language:** TypeScript (strict mode)
- **Package Manager:** npm
- **Version Control:** Git
- **CI/CD:** GitHub Actions, Vercel, EAS Build

## Deployment

### Admin Portal (NextJS)
```bash
# Deploy to Vercel
git push origin main
# Vercel auto-deploys on push

# Environment variables
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Technician App (React Native)
```bash
# Build with EAS
eas build --platform ios
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Team Communication

Use these patterns:

### Asking for Work
```
/assign-task [Feature description]
```

### Generating Code
```
/code-gen [Feature] for: [web|mobile]
```

### Validating Work
```
/run-tests [Feature] [category]
```

### Checking Progress
```
/status [scope]
```

## Troubleshooting

### "RLS policy error"
→ Check Supabase RLS policies are properly set up
→ Verify company_id filtering in queries
→ Use Master Agent to escalate

### "Code doesn't match spec"
→ Have developer re-read feature spec
→ Ask QA to detail specific mismatches
→ Use /review-code before /run-tests

### "Blocked on database schema"
→ Report to Master Agent
→ Schema must be finalized before coding
→ Use /status blockers to track

### "TypeScript errors"
→ Enable strict mode locally
→ Fix type errors before QA
→ Use /code-gen to regenerate if needed

## Project Structure

```
caicos-team/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── commands/
│   ├── assign-task.md        # Task delegation
│   ├── code-gen.md           # Code generation
│   ├── review-code.md        # Code review
│   ├── run-tests.md          # QA validation
│   └── status.md             # Progress tracking
├── agents/
│   ├── master-agent.md       # Project coordinator
│   ├── nextjs-developer-agent.md    # Web dev
│   ├── react-native-developer-agent.md # Mobile dev
│   └── qa-specialist-agent.md       # QA lead
├── skills/
│   ├── master-agent/
│   │   └── SKILL.md
│   ├── nextjs-developer/
│   │   └── SKILL.md
│   ├── react-native-developer/
│   │   └── SKILL.md
│   └── qa-specialist/
│       └── SKILL.md
├── .mcp.json                 # Supabase MCP config
└── README.md                 # This file
```

## Tips for Success

### Best Practices
- Always validate scope with Master Agent before assigning work
- Have developers review existing code patterns before generating new code
- Use /status to check blockers before assigning related features
- Database schema must be finalized early (blocks multiple teams)
- QA validation is mandatory before marking features complete

### Common Patterns
```
# Start a new feature
1. /assign-task [Feature]
2. /code-gen [Feature] for: [web|mobile]
3. /run-tests [Feature] code
4. Fix if needed, then repeat /run-tests
5. Deploy when QA passes

# Check progress
/status sprint      (see % complete)
/status blockers    (see what's stuck)
/status team        (see current work)

# Unblock teams
/status blockers    (identify what's stuck)
→ Work with Master Agent to resolve
→ Reassign unblocked work meanwhile
```

## Support & Feedback

For issues with the plugin:
1. Check /status blockers (might identify the issue)
2. Review feature specs (may need clarification)
3. Ask Master Agent for guidance

For plugin improvements:
- Document the feature gap
- Request in project backlog
- Can be added in future version

## Version

**caicos-team v0.1.0** (MVP Release)

Built for Caicos pool service platform.
Compatible with Cowork mode.

---

**Ready to build Caicos?** Start with: `/status team`
