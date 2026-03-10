---
name: Deploy to Vercel
aliases: [deploy, vercel, release]
description: "Deploy Caicos admin portal and technician app to Vercel production. Handles pre-deployment validation, environment setup, deployment execution, health checks, and post-deployment QA verification."
---

# Deploy to Vercel

You are the deployment specialist. Load the **Caicos Integrations & DevOps** skill.

When the user requests deployment, follow this workflow:

## 1. Pre-Deployment Verification
Ask the user:
- What's being deployed? (admin portal, technician app, or both)
- Which branch? (main/production recommended)
- Any database migrations needed?
- Environment variables updated?

Verify checklist:
- ✅ All tests passing (unit, integration, E2E)
- ✅ Build succeeds with no errors
- ✅ TypeScript strict mode passes
- ✅ No console errors/warnings
- ✅ Code review completed
- ✅ Environment variables configured in Vercel
- ✅ Database migrations up to date
- ✅ No uncommitted changes in repo

## 2. Prepare Deployment

### For Admin Portal (Next.js)
```bash
# Verify build
cd admin-portal
npm run build

# Check for errors
npm run lint
npm run type-check

# Run tests
npm run test

# Prepare Vercel
vercel --prod --scope=agasocial
```

### For Technician App (React Native)
```bash
# Build Android & iOS
cd technician-app
eas build --platform ios --profile production
eas build --platform android --profile production

# Wait for builds to complete
eas build list
```

## 3. Deploy Steps

### Step 1: Deploy Admin Portal
1. Push to main branch
2. GitHub Actions CI/CD triggers automatically
3. Vercel auto-deploys on green build
4. Monitor deployment progress in Vercel dashboard

### Step 2: Run Smoke Tests
```bash
# Health check endpoint
curl https://caicos-admin.vercel.app/api/health

# Verify critical pages load
- https://caicos-admin.vercel.app
- https://caicos-admin.vercel.app/login
- https://caicos-admin.vercel.app/dashboard
```

### Step 3: Deploy Mobile App
1. EAS builds complete
2. Submit to app stores (if production)
3. Monitor deployment in EAS dashboard

## 4. Post-Deployment Validation

### Automated Checks
- [ ] API health check passes
- [ ] All endpoints responding
- [ ] Database connections working
- [ ] Supabase RLS policies enforced
- [ ] Authentication flows working
- [ ] File uploads working

### Manual Testing
- [ ] Login flow works
- [ ] Dashboard loads with real data
- [ ] Create job works
- [ ] Edit job works
- [ ] View service reports works
- [ ] Export CSV works
- [ ] Mobile app connects to backend

### E2E Tests (Browser Automation)
```bash
npx playwright test --project=chromium

# Tests verify:
- User authentication
- Job creation flow
- Service report submission
- Photo uploads
- Data synchronization
```

## 5. Rollback (if needed)
```bash
# If deployment fails:

# For Vercel (Admin Portal)
vercel rollback --prod --scope=agasocial

# For EAS (Mobile App)
eas build list  # Find previous good build
# Notify users of delay

# For Database
supabase db pull  # Restore from backup
```

## 6. Deployment Report
Generate:
- Deployment timestamp
- Version deployed
- Changes included
- Verification results
- Performance metrics
- Any issues encountered

---

## Pre-Production Checklist

```markdown
### Code Quality
- [ ] No TypeScript errors
- [ ] ESLint passes
- [ ] Tests passing (>80% coverage)
- [ ] No console warnings
- [ ] Code review approved

### Security
- [ ] Environment variables not exposed
- [ ] No hardcoded secrets
- [ ] RLS policies verified
- [ ] OWASP checks passed
- [ ] Dependencies up to date (npm audit clean)

### Performance
- [ ] Build size within limits
- [ ] API response times < 200ms
- [ ] Database queries optimized
- [ ] Images optimized
- [ ] Lighthouse score > 90

### Infrastructure
- [ ] Database migrations ready
- [ ] Environment variables configured
- [ ] Storage buckets ready
- [ ] CDN cache settings correct
- [ ] Monitoring/logging enabled

### Documentation
- [ ] Deployment notes written
- [ ] Breaking changes documented
- [ ] API changes documented
- [ ] Known issues listed
- [ ] Rollback plan ready
```

---

## Deployment Schedule

### Recommended Process
1. **Monday-Thursday deployments** (avoid Fridays)
2. **Morning deployments** (9 AM - 5 PM timezone)
3. **During business hours** (for quick response if issues)
4. **One feature/fix per deployment** (avoid large batches)

### Avoid
- ❌ Late Friday deployments
- ❌ Holiday deployments
- ❌ Deployments during known issues
- ❌ Multiple simultaneous deployments

---

Load skill: **Caicos Integrations & DevOps**
Trigger: Automated CI/CD or manual via this command
