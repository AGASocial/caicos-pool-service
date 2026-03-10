---
name: Caicos Integrations & DevOps
trigger: "github integration", "supabase setup", "vercel deployment", "environment variables", "devops", "ci/cd pipeline"
description: "Expert guidance for integrating Caicos with GitHub (version control, actions, PRs), Supabase (database, auth, storage, migrations), and Vercel (deployment, preview environments, monitoring). Handles repository setup, environment management, CI/CD pipelines, database migrations, and production deployments."
---

# Caicos Integrations & DevOps

You are a DevOps specialist managing Caicos infrastructure integrations. Use this knowledge to set up repositories, configure deployments, and manage environments.

## GitHub Repository Setup

### Repository Structure
```
AGASocial/caicos-pool-service (mono-repo)
├── admin-portal/              # Next.js web app
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vercel.json
├── technician-app/            # React Native app
│   ├── app/
│   ├── src/
│   ├── package.json
│   ├── app.json
│   ├── tsconfig.json
│   └── eas.json
├── shared/                    # Shared types & utilities
│   ├── types/
│   ├── utils/
│   └── package.json
├── docs/                      # Documentation
├── .github/
│   └── workflows/
├── .env.example
├── .gitignore
└── README.md
```

### Branching Strategy
```
main
├── production branch (protected)
├── Requires: 2 PR reviews, CI passing
└── Auto-deploys to vercel.app + EAS

staging
├── Staging branch (protected)
├── Requires: 1 PR review, CI passing
└── Auto-deploys to preview environments

develop
├── Development branch
├── Open for PRs
└── No auto-deployment

feature/*
├── Individual feature branches
└── Branch from: develop
```

### PR Template
```markdown
## Description
Brief summary of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing done
- [ ] E2E tests pass

## Checklist
- [ ] Code follows project style
- [ ] No console errors/warnings
- [ ] TypeScript strict mode passes
- [ ] Environment variables documented
```

## GitHub Actions CI/CD Pipelines

### Test Pipeline
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, staging, develop]
  pull_request:
    branches: [main, staging, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Run integration tests
        run: npm run test:integration
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

      - name: Build
        run: npm run build

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Deploy Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: vercel/action@main
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID_ADMIN }}
          scope: ${{ secrets.VERCEL_ORG_ID }}
          working-directory: admin-portal
          production: true

      - name: Build Mobile App
        run: |
          cd technician-app
          eas build --platform ios --wait
          eas build --platform android --wait
        env:
          EAS_TOKEN: ${{ secrets.EAS_TOKEN }}
```

## Supabase Setup & Configuration

### Project Initialization
```bash
# 1. Create Supabase project
supabase projects create --name caicos-prod

# 2. Link to local development
supabase link --project-id YOUR_PROJECT_ID

# 3. Create initial migration
supabase migration new init_schema
```

### Environment Variables (.env.local)
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyxxxxx
SUPABASE_DB_PASSWORD=xxxxx

# GitHub
GITHUB_TOKEN=ghp_xxxxx
GITHUB_REPO=AGASocial/caicos-pool-service

# Vercel
VERCEL_TOKEN=xxxxx
VERCEL_ORG_ID=xxxxx
VERCEL_PROJECT_ID_ADMIN=xxxxx
VERCEL_PROJECT_ID_TECH=xxxxx

# Expo
EAS_TOKEN=xxxxx
```

### Database Migration Example
```sql
-- migrations/001_init_schema.sql

-- Create companies (tenants)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  plan TEXT DEFAULT 'starter', -- starter, pro, enterprise
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('owner', 'admin', 'technician')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users see only their company
CREATE POLICY companies_isolation ON companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.company_id = companies.id
      AND users.id = auth.uid()
    )
  );

-- Policy: Users see only their company's users
CREATE POLICY users_isolation ON users
  FOR SELECT USING (company_id = (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- Apply migrations
supabase migration up
```

### Seeding Development Data
```sql
-- seeds/dev-data.sql

-- Create test company
INSERT INTO companies (name, email, plan)
VALUES ('Test Company', 'admin@testcompany.com', 'pro');

-- Create test users
INSERT INTO users (company_id, email, role)
SELECT id, 'admin@test.com', 'owner' FROM companies
WHERE name = 'Test Company';

-- Reload schema to update sequences
\c postgres
SELECT pg_catalog.setval('public.companies_id_seq', (SELECT MAX(id) FROM companies), true);
```

## Vercel Deployment

### Project Configuration (vercel.json)
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "projectSettings": {
    "nodeVersion": "20.x"
  },
  "env": [
    {
      "key": "NEXT_PUBLIC_SUPABASE_URL",
      "value": "@supabase_url"
    },
    {
      "key": "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "value": "@supabase_anon_key"
    },
    {
      "key": "SUPABASE_SERVICE_ROLE_KEY",
      "value": "@supabase_service_key"
    }
  ]
}
```

### Preview Deployments
```bash
# Every PR creates preview deployment
# URL: caicos-admin-pr-123.vercel.app

# Environment variables for preview
VERCEL_ENV=preview
DATABASE_URL=<staging-db>
```

### Production Deployment
```bash
# Deploy to main project
vercel --prod

# Checks before deploy
- All tests passing
- Build succeeds
- No TypeScript errors
- Environment variables set
- Database migrations up to date
```

## EAS Build Configuration (React Native)

### eas.json
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccount": "@android_service_account",
        "track": "internal"
      },
      "ios": {
        "appleId": "@apple_id",
        "ascAppId": "@asc_app_id",
        "appleTeamId": "@apple_team_id"
      }
    }
  }
}
```

### Build Commands
```bash
# Development build
eas build --platform ios --profile development

# Preview build (for testing)
eas build --platform android --profile preview --wait

# Production build
eas build --platform ios --profile production --auto-submit
eas build --platform android --profile production --auto-submit
```

## Environment Management

### Local Development
```bash
# Copy example
cp .env.example .env.local

# Fill in values from Supabase dashboard
NEXT_PUBLIC_SUPABASE_URL=<from-supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-supabase>

# Start development
npm run dev
```

### Staging Environment
```bash
# Vercel staging project
vercel link --scope=agasocial --project=caicos-admin-staging

# Environment setup in Vercel dashboard
# Auto-populated from GitHub secrets
```

### Production Environment
```bash
# Vercel production project
vercel link --scope=agasocial --project=caicos-admin-prod

# Manual deployment verification
curl https://caicos-admin.vercel.app/api/health
```

## Monitoring & Logging

### Vercel Analytics
```typescript
// Analytics tracking
import { reportWebVitals } from 'next/analytics';

export function reportWebVitals(metric) {
  console.log(metric);
  // Vercel auto-collects: LCP, FID, CLS
}
```

### Error Tracking (Sentry)
```typescript
// Sentry integration for production
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### Database Monitoring
```bash
# Check Supabase dashboard for:
- Query performance
- Storage usage
- Auth metrics
- Real-time subscribers
```

## Backup & Recovery

### Database Backups
```bash
# Automatic daily backups via Supabase
# Manual backup
supabase db push --local

# Restore from backup
supabase db pull
```

### Disaster Recovery Plan
```
1. Identify issue
2. Check backup status (Supabase dashboard)
3. If needed, restore from backup
4. Verify data integrity
5. Redeploy application
6. Test critical flows
```

---

See `references/` for complete GitHub Actions workflows, Supabase migration templates, and Vercel configuration examples.
