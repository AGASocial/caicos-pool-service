# Cadenza

Multi-tenant SaaS platform for pool service companies — admin web portal and technician mobile app.

## Applications

| App | Stack | Path |
|-----|-------|------|
| **Admin Portal** | Next.js 14+, Supabase, Tailwind, Shadcn/ui | [`admin-portal/`](./admin-portal/) |
| **Technician App** | React Native, Expo SDK 52, Supabase | [`technician-app/`](./technician-app/) |

## Documentation

All documentation is organized under [`docs/`](./docs/README.md).

| Start here | For |
|------------|-----|
| [START-HERE.md](./START-HERE.md) | First-time orientation |
| [docs/README.md](./docs/README.md) | Full categorized doc index |
| [docs/architecture/SOLUTION.md](./docs/architecture/SOLUTION.md) | Architecture & MVP scope |
| [AGENTS.md](./AGENTS.md) | AI agent roles & dev workflow |

## Quick links by role

- **Product / stakeholders** → [docs/business/BUSINESS-CONTEXT.md](./docs/business/BUSINESS-CONTEXT.md), [docs/architecture/SOLUTION.md](./docs/architecture/SOLUTION.md), [docs/cost/](./docs/cost/)
- **Web developers** → [docs/specs/FEATURE-ADMIN-PORTAL.md](./docs/specs/FEATURE-ADMIN-PORTAL.md)
- **Mobile developers** → [docs/specs/FEATURE-TECHNICIAN-APP.md](./docs/specs/FEATURE-TECHNICIAN-APP.md)
- **Design / branding** → [docs/branding/](./docs/branding/), [docs/design/](./docs/design/)
- **QA / Testing** → [docs/QA.md](./docs/QA.md)

## Testing & QA

Automated end-to-end tests cover complete user flows across admin portal and technician app.

**Run locally:**
```bash
npm run qa:seed         # Seed test data
npm run qa:test         # Run E2E tests
npm run qa:cleanup      # Clean up test data
```

**CI/CD:** E2E tests run automatically on every PR to `develop`. Results are posted as a PR comment.

**Required GitHub secrets:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `VERCEL_AUTOMATION_BYPASS_SECRET`
- `QA_ADMIN_PASSWORD`, `QA_TECH_PASSWORD`

See [docs/QA.md](./docs/QA.md) for complete setup and usage guide.
