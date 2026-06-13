# Cadenza Documentation

All project documentation lives under `docs/`, organized by purpose. Start with [INDEX.md](./INDEX.md) for the full reading guide and development roadmap.

**Quick entry points:**
- New to the project → [../START-HERE.md](../START-HERE.md)
- Architecture overview → [architecture/SOLUTION.md](./architecture/SOLUTION.md)
- Building features → [specs/](./specs/)
- AI agents & dev workflow → [../AGENTS.md](../AGENTS.md)

---

## Architecture & Product

High-level platform design, MVP scope, and tech stack decisions.

| Document | Description |
|----------|-------------|
| [SOLUTION.md](./architecture/SOLUTION.md) | Platform architecture, MVP scope, tech stack, schema overview |
| [INDEX.md](./INDEX.md) | Full documentation index, reading order, and roadmap |

---

## Feature Specifications

Detailed product specs for each application and background jobs.

| Document | Description |
|----------|-------------|
| [FEATURE-ADMIN-PORTAL.md](./specs/FEATURE-ADMIN-PORTAL.md) | Admin web portal — screens, journeys, API, permissions |
| [FEATURE-TECHNICIAN-APP.md](./specs/FEATURE-TECHNICIAN-APP.md) | Technician mobile app — workflows, data models, offline |
| [FEATURE-CRON-JOB.md](./specs/FEATURE-CRON-JOB.md) | Scheduled jobs (photo cleanup, consistency tasks) |

---

## Business & Domain Analysis

Workflow research, gap analysis, product decisions, and business brainstorming context.

| Document | Description |
|----------|-------------|
| **[BUSINESS-CONTEXT.md](./business/BUSINESS-CONTEXT.md)** | **Start here** for business questions, ideas, strategy, and pilot context |
| [BUSINESS-LOGIC-ANALYSIS.md](./business/BUSINESS-LOGIC-ANALYSIS.md) | Gabriella's WhatsApp workflow vs. current specs |
| [IMPLEMENTATION-ROADMAP.md](./business/IMPLEMENTATION-ROADMAP.md) | Simplified workflow roadmap (WhatsApp → mobile app) |
| [SPEC-UPDATES-SUMMARY.md](./business/SPEC-UPDATES-SUMMARY.md) | Changelog for routes, weekly reports, and workflow updates |

---

## Cost & Financial Analysis

Pilot economics, infrastructure scaling, billing, and photo storage strategy.

| Document | Description |
|----------|-------------|
| [COST-ANALYSIS-PILOT.md](./cost/COST-ANALYSIS-PILOT.md) | Pilot customer revenue, costs, and margins |
| [COST-SCALING-PHOTOS.md](./cost/COST-SCALING-PHOTOS.md) | How Supabase/Vercel costs scale with photo volume |
| [PHOTO-RETENTION-STRATEGY.md](./cost/PHOTO-RETENTION-STRATEGY.md) | Photo retention tiers and external storage options |
| [NEXT-ACTIONS-BILLING-LAUNCH.md](./cost/NEXT-ACTIONS-BILLING-LAUNCH.md) | Billing system launch checklist and integration steps |

---

## Branding & Design

Brand identity, applied rebrand notes, and AI design prompts for presentations.

| Document | Description |
|----------|-------------|
| [BRAND-IDENTITY.md](./branding/BRAND-IDENTITY.md) | Logo, colors, typography, voice & tone |
| [Mobile_App_Branding_Update.md](./branding/Mobile_App_Branding_Update.md) | Mobile app color token specifications |
| [NEURA_POOL_REBRAND_APPLIED.md](./branding/NEURA_POOL_REBRAND_APPLIED.md) | Applied rebrand changelog (technician app) |
| [AI-DESIGN-PROMPT.md](./design/AI-DESIGN-PROMPT.md) | AI design prompt for technician mobile app |
| [AI-DESIGN-PROMPT-ADMIN.md](./design/AI-DESIGN-PROMPT-ADMIN.md) | AI design prompt for admin portal |

---

## Development & Implementation

Progress tracking, implementation checklists, and repo layout.

| Document | Description |
|----------|-------------|
| [DEVELOPMENT-CHECKLIST.md](./development/DEVELOPMENT-CHECKLIST.md) | MVP completion status (admin + mobile) |
| [IMPLEMENTATION-CHECKLIST.md](./development/IMPLEMENTATION-CHECKLIST.md) | Code tasks to align with updated specs |
| [WORKING-DIRECTORY-GUIDE.md](./development/WORKING-DIRECTORY-GUIDE.md) | Repo structure and implementation status |

---

## Setup & Technical Guides

Environment setup, auth integration, and database configuration.

| Document | Description |
|----------|-------------|
| [setup-supabase.md](./setup/setup-supabase.md) | Supabase project setup |
| [supabase-redirect-setup.md](./setup/supabase-redirect-setup.md) | Auth redirect URLs |
| [GOOGLE_SIGN_IN_IMPLEMENTATION.md](./setup/GOOGLE_SIGN_IN_IMPLEMENTATION.md) | Google Sign-In integration |

---

## Testing

| Document | Description |
|----------|-------------|
| [TESTING.md](./testing/TESTING.md) | Testing approach and procedures |
| [TEST_SUMMARY.md](./testing/TEST_SUMMARY.md) | Test run summary |

---

## Agents & Tooling

AI development team plugin and agent coordination.

| Document | Description |
|----------|-------------|
| [PLUGIN-SUMMARY.md](./agents/PLUGIN-SUMMARY.md) | Cadenza team plugin delivery summary |
| [../AGENTS.md](../AGENTS.md) | Agent roles, workflow, and autonomous development loop |

---

## Other Resources

| Location | Description |
|----------|-------------|
| [schema.sql](./schema.sql) | Database schema |
| [example-app/](./example-app/) | Next.js reference implementation |
| [migrations/](./migrations/) | Migration notes |
| [Claude/cadenza-team-plugin/](./Claude/cadenza-team-plugin/) | Claude Cowork plugin (agents, skills, commands) |
