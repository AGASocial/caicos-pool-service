# Caicos Dev Agents Plugin

A comprehensive multi-agent development system for the **Caicos pool service platform**. Coordinates autonomous agents across frontend, mobile, backend, QA, and DevOps layers to build features end-to-end with full autonomy.

## 🎯 Overview

This plugin provides **full development autonomy** by implementing a master orchestrator agent that manages 4 specialized agents:

- **Frontend Agent** — Builds Next.js admin portal components
- **Mobile Agent** — Builds React Native technician app screens
- **Backend Agent** — Builds Supabase APIs and database infrastructure
- **QA Agent** — Ensures quality through comprehensive testing and security audits

## 🚀 Features

### Master Orchestrator
- Breaks down complex features into sub-tasks
- Manages dependencies and execution order
- Runs agents in parallel or sequence as needed
- Aggregates results into production-ready implementations
- No human approval between steps

### Specialized Agents
Each agent is an expert in its domain:

| Agent | Specialization | Output |
|-------|---|---|
| **Frontend** | Next.js 14, Tailwind, Shadcn/ui, TanStack Query | React components, pages, tests |
| **Mobile** | React Native, Expo, Zustand, offline-first | App screens, stores, tests |
| **Backend** | Node.js API routes, Supabase, RLS policies | API endpoints, migrations, policies |
| **QA** | Testing, security, performance, automation | Test suites, security reports, fixes |

### 5 Domain-Specific Skills
1. **Caicos Next.js Frontend** — Admin portal best practices
2. **Caicos React Native** — Mobile app patterns and offline sync
3. **Caicos Next.js Backend** — API design and multi-tenant architecture
4. **Caicos QA & Testing** — Comprehensive testing and security audits
5. **Caicos Integrations** — GitHub, Supabase, Vercel setup

### 6 Commands
- **`/generate-frontend`** — Generate React components and pages
- **`/generate-mobile`** — Generate React Native screens
- **`/generate-backend`** — Generate API routes and database migrations
- **`/review-code`** — Comprehensive code review and testing
- **`/orchestrate`** — Coordinate multi-agent feature development
- **`/deploy-to-vercel`** — Deploy and verify on production

## 📋 Prerequisites

### Environment Variables
Create a `.env` file with:

```env
# GitHub
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GITHUB_REPOSITORY=AGASocial/caicos-pool-service

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Vercel
VERCEL_TOKEN=xxxxxxxxxxxxx
VERCEL_ORG_ID=team_xxxxxxxxxxxxx
```

### Required Access
- GitHub personal access token with `repo` scope
- Supabase service role key
- Vercel team token with deployment permissions

## 🎮 Usage Examples

### Example 1: Build a Feature End-to-End
```
User: "Build the technician service form with chemical readings, equipment checks, and photo capture"

Master Orchestrator:
1. Analyzes requirements
2. Creates execution plan
3. Dispatches Backend Agent → POST /api/jobs/[id]/service-report
4. Dispatches Mobile Agent (parallel) → service-form.tsx screen
5. Dispatches Frontend Agent (parallel) → service-report viewer component
6. Runs QA Agent → complete test suite
7. Aggregates all code → production-ready implementation
8. Ready for: git push → Vercel deployment
```

### Example 2: Review Code and Add Tests
```
User: "Review the admin job list page and ensure it's production-ready"

QA Agent:
1. Reviews code for security, performance, quality
2. Identifies missing tests
3. Generates unit test suite
4. Generates integration tests
5. Generates E2E tests for Vercel deployment
6. Runs security audit (OWASP)
7. Provides: test report + recommendations + PR with fixes
```

### Example 3: Deploy to Production
```
User: "Deploy admin portal to production with QA verification"

Deploy Command:
1. Pre-flight checks (build, tests, security)
2. Creates Vercel deployment
3. Runs smoke tests
4. Performs E2E tests on Vercel URL
5. Validates critical flows
6. Reports: deployment status + verification results
```

## 🏗️ Architecture

### Caicos Platform Stack
```
Frontend (Web)
├── Next.js 14+ (App Router)
├── TypeScript + Tailwind CSS
├── Shadcn/ui components
└── TanStack Query (data fetching)

Mobile App
├── React Native + Expo SDK 52
├── Zustand (state management)
├── Offline SQLite + sync
└── Expo Router (navigation)

Backend API
├── Next.js API routes
├── Supabase (PostgreSQL)
├── Row Level Security (multi-tenant)
└── Real-time subscriptions

Infrastructure
├── Vercel (web hosting)
├── EAS (mobile CI/CD)
├── GitHub Actions (CI/CD)
└── Supabase (managed database)
```

### Multi-Tenant Architecture
- All data partitioned by `company_id`
- RLS policies enforce strict isolation
- No cross-tenant data leaks
- Role-based access control (owner/admin/technician)

## 📚 Skills Documentation

### 1. Caicos Next.js Frontend
Expertise in:
- Next.js 14 App Router
- TypeScript strict mode
- TanStack Query patterns
- Shadcn/ui components
- Form validation and submission
- Multi-tenant access control

### 2. Caicos React Native
Expertise in:
- React Native + Expo SDK 52
- Cross-platform compatibility
- Zustand state management
- Camera/gallery integration
- Offline-first architecture
- Sync queue implementation

### 3. Caicos Next.js Backend
Expertise in:
- RESTful API design
- Supabase integration
- Row Level Security policies
- Database migrations
- File upload handling
- Real-time subscriptions

### 4. Caicos QA & Testing
Expertise in:
- Unit testing (Vitest)
- Integration testing (Supertest)
- E2E testing (Playwright)
- Security audits (OWASP)
- Performance testing (Lighthouse)
- Browser automation

### 5. Caicos Integrations & DevOps
Expertise in:
- GitHub repository setup
- GitHub Actions CI/CD
- Supabase project setup
- Database migrations
- Vercel deployment
- Environment management

## 🔄 Workflow

### Task Flow
```
User Request
    ↓
Master Orchestrator (analyzes & plans)
    ↓
Specialized Agents (execute in parallel/sequence)
    ├─ Backend Agent (API + database)
    ├─ Frontend Agent (React components)
    ├─ Mobile Agent (React Native screens)
    └─ QA Agent (testing & validation)
    ↓
Orchestrator (aggregates results)
    ↓
Production-Ready Code (ready to merge)
    ↓
Vercel Deployment (via /deploy-to-vercel)
```

### Execution Model
- **Backend tasks**: Usually blocking (other tasks depend on APIs)
- **Frontend + Mobile**: Can run in parallel (both consume same APIs)
- **QA**: Runs after implementation (validates everything)
- **Deployment**: Final step (only after QA approval)

## 🧪 Testing Approach

### Test Coverage Standards
- **Unit Tests**: >80% coverage
- **Integration Tests**: >60% coverage
- **E2E Tests**: 100% for critical flows
- **Total**: Aim for >70% overall

### Test Types
1. **Unit Tests** — Individual functions, hooks, stores
2. **Integration Tests** — API routes, database queries
3. **E2E Tests** — Browser automation on Vercel deployments
4. **Security Tests** — OWASP compliance, input validation
5. **Performance Tests** — Lighthouse, load testing

## 🔒 Security

### Built-In Security
- Row Level Security (RLS) on all tables
- Multi-tenant data isolation
- Authentication on all APIs
- Input validation on forms
- Secure password hashing
- No exposed secrets

### Security Review
QA Agent performs:
- OWASP Top 10 audit
- SQL injection checks
- XSS prevention validation
- Authentication/authorization testing
- RLS policy compliance
- Dependency vulnerability scanning

## 📈 Performance Standards

### Target Metrics
- Page load: < 3 seconds
- API response: < 200ms
- Mobile app load: < 5 seconds
- Lighthouse score: > 90
- Test execution: < 5 minutes

## 🚀 Deployment

### Supported Targets
- **Web**: Vercel (next.js admin portal)
- **Mobile iOS**: Apple App Store (via EAS)
- **Mobile Android**: Google Play Store (via EAS)
- **Database**: Supabase (managed PostgreSQL)

### Deployment Process
1. Push to main branch
2. GitHub Actions CI/CD pipeline triggers
3. All tests must pass
4. Vercel auto-deploys on success
5. Smoke tests verify deployment
6. E2E tests validate functionality

## 📝 Configuration

### Environment Setup
```bash
# Copy example
cp .env.example .env

# Fill in your credentials
GITHUB_TOKEN=your_token
SUPABASE_URL=your_url
VERCEL_TOKEN=your_token
```

### Initial Setup
```bash
# Link repositories
gh auth login
supabase link --project-id YOUR_PROJECT_ID
vercel link --scope=agasocial --project=caicos-admin

# Set up environment variables
# In Vercel dashboard: Settings → Environment Variables
# In GitHub: Settings → Secrets and variables → Actions
```

## 🎓 Learning Path

### For New Team Members
1. Read: `SOLUTION.md` (platform architecture)
2. Review: `FEATURE-ADMIN-PORTAL.md` (web specification)
3. Review: `FEATURE-TECHNICIAN-APP.md` (mobile specification)
4. Try: `/generate-frontend` to build a simple component
5. Try: `/orchestrate` to build a complete feature

### For Deployment
1. Review: Pre-deployment checklist
2. Run: Pre-deployment tests
3. Execute: `/deploy-to-vercel`
4. Verify: Smoke tests on Vercel

## 🤝 Team Coordination

### Master Orchestrator's Role
- Plans feature decomposition
- Manages agent coordination
- Ensures no conflicts
- Maintains type consistency
- Communicates blockers

### Agent Autonomy
Agents have full autonomy to:
- Make implementation decisions
- Write complete code + tests
- Suggest optimizations
- Identify issues

Agents ask for approval on:
- Architecture changes
- Scope modifications
- Timeline impacts

## 📞 Support

### Troubleshooting

**Build fails with TypeScript errors:**
```bash
npm run type-check
# Fix errors then retry
```

**Tests failing after code changes:**
```bash
npm run test
# Review failures and regenerate tests with QA agent
```

**Deployment stuck:**
- Check Vercel dashboard for build logs
- Verify environment variables are set
- Run: npm run build locally

## 🗺️ Project Structure

```
caicos-dev-agents/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── commands/
│   ├── generate-frontend.md
│   ├── generate-mobile.md
│   ├── generate-backend.md
│   ├── review-code.md
│   ├── orchestrate.md
│   └── deploy-to-vercel.md
├── agents/
│   ├── master-orchestrator.md
│   ├── frontend-agent.md
│   ├── mobile-agent.md
│   ├── backend-agent.md
│   └── qa-agent.md
├── skills/
│   ├── caicos-frontend/SKILL.md
│   ├── caicos-mobile/SKILL.md
│   ├── caicos-backend/SKILL.md
│   ├── caicos-qa/SKILL.md
│   └── caicos-integrations/SKILL.md
├── .mcp.json                    # MCP server integrations
└── README.md                    # This file
```

## 🎯 Success Criteria

Development is successful when:
- ✅ All features implemented end-to-end
- ✅ 80%+ test coverage across all layers
- ✅ Zero high/critical security findings
- ✅ Performance targets met
- ✅ Deployed successfully to production
- ✅ E2E tests pass on Vercel
- ✅ Code ready for team handoff

## 📄 License

Part of the Caicos Pool Service Platform. All rights reserved.

---

**Ready to build Caicos?** Start with:
```
/orchestrate "Build [feature name]"
```

Then let the agents handle the rest! 🚀
