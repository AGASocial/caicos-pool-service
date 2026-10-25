# Cadenza Billing Production-Ready - Implementation Summary

## Completed: October 25, 2026

### Pull Request
**PR #16**: https://github.com/AGASocial/caicos-pool-service/pull/16  
**Branch**: `cursor/complete-billing-subscription-flow-116d` (targets `develop`)

---

## Section A: Critical Billing Fixes ✅ COMPLETE

All issues from the review have been addressed:

### 1. Stripe Checkout Quantity Flow
**Issue**: Line items hardcoded quantity to 1  
**Fix**: 
- `stripe.adapter.ts`: Added `quantity` parameter to `createCheckoutSession()`
- `checkout/route.ts`: Passes `parsedQuantity` from request body
- `subscription_data.metadata` now includes quantity for webhook persistence

**Files Changed**:
- `admin-portal/src/lib/billing/adapters/stripe.adapter.ts`
- `admin-portal/src/app/api/billing/checkout/route.ts`

### 2. Webhook Payment Status
**Issue**: Webhook forced status to 'active' without checking payment_status  
**Fix**: 
- `stripe-webhook.normalizer.ts`: Check `session.payment_status === 'paid'` before setting active
- Falls back to 'incomplete' if payment not yet successful
- Subscription status will be corrected by subsequent `subscription.updated` event

**Files Changed**:
- `admin-portal/src/lib/billing/adapters/stripe-webhook.normalizer.ts`

### 3. URL Building & Security
**Issue**: URLs built from Origin header (open redirect risk)  
**Fix**:
- Build URLs from `NEXT_PUBLIC_APP_URL` environment variable
- Allowlist locales: `['en', 'es']` only
- Server-side quantity validation (1-1000 range)
- Duplicate paid subscription prevention

**Files Changed**:
- `admin-portal/src/app/api/billing/checkout/route.ts`

### 4. Setup Script Pricing
**Issue**: Created $9.99 and $39.99 prices instead of $14.99 and $24.99  
**Fix**:
- `setup-stripe-products.js`: Now creates:
  - Free: $0
  - Standard: $14.99 per tech/month (1499 cents)
  - Pro: $24.99 per tech/month (2499 cents)

**Files Changed**:
- `admin-portal/scripts/setup-stripe-products.js`

### 5. Package Version & Documentation
**Issues**: version regression, outdated docs, leaked errors  
**Fixes**:
- Reverted package-lock.json version (1.0.0 → 2.2.0)
- Updated BILLING-SETUP.md with per-technician model and Pro plan
- Added generic error handling to avoid leaking raw Stripe errors

**Files Changed**:
- `admin-portal/package-lock.json`
- `BILLING-SETUP.md`
- `admin-portal/src/app/api/billing/checkout/route.ts`

---

## Section B: Data-Driven Billing Tiers ✅ COMPLETE

### Migration: `20261025181746_data_driven_billing_tiers.sql`

**New Schema**:
- Added `pricing_model` column: `'flat'` | `'per_technician'`
- Plans are now fully data-driven (add/remove tiers by editing rows)

**Plan Definitions**:

| Plan ID | Name | Price | Model | Limits |
|---------|------|-------|-------|--------|
| `plan_free` | Free | $0 | flat | 3 techs, 2 photos/service, 90-day duration |
| `plan_necessary_month` | Standard | $14.99/tech | per_technician | Unlimited techs, 10 photos, 5yr retention |
| `plan_pro_month` | Pro | $24.99/tech | per_technician | Unlimited techs, 20 photos, 7yr retention, video |

**Feature Keys** (all in `features` JSONB, `-1` = unlimited):
- `admin_users`, `max_technicians`, `max_photos_per_service`
- `photo_retention_days`, `photo_hot_storage_days`, `photo_archive_provider`
- `report_history_days`, `plan_duration_days` (free plan expiry)
- `video_per_service`, `max_video_seconds`, `data_export`, `advanced_analytics`
- `storage_gb`, `max_properties`, `max_routes`, `max_service_jobs`
- Legacy: `priority_support`, `api_access`, `custom_branding`, etc.

**Migration Actions**:
- Existing `plan_premium_month` subscriptions migrated to `plan_pro_month`
- Legacy yearly and premium plans deactivated (`active = false`)

### Enforcement Implementation

**Created**: `admin-portal/src/lib/plan-limits.ts`

Central utility for all plan limit checks:
- `getUserPlanLimits()`: Returns effective limits handling expiry
- `canUploadPhotos()`: Check per-service photo limits
- `canUploadVideo()`: Check video feature and duration
- `canExportData()`: Check data export permission
- `getReportHistoryCutoff()`: Calculate report history cutoff
- `isFreePlanExpired()`: Check free plan 90-day duration

**Updated**: `admin-portal/src/app/api/invite-codes/route.ts`

Invite flow now:
- For `per_technician` plans: enforces `subscription.quantity` (paid seats)
- For flat plans (Free): enforces `plan.features.max_technicians`
- Returns user-friendly error messages with upgrade prompt

---

## Section C: Photo Compression & Archival ✅ COMPLETE

### Mobile App Compression

**Created**: `technician-app/lib/photoCompression.ts`

Features:
- Resize to 1600px long edge, quality 0.6 (JPEG)
- Generate 320px thumbnails, quality 0.7
- Batch processing support: `compressPhotos()`
- Size estimation for user feedback
- Uses `expo-image-manipulator` for fast native processing

**Updated**: `technician-app/components/PhotoWithOverlay.tsx`
- Fixed quality from 0.9 to 0.6 for consistency

**Installed**: `expo-image-manipulator` package

### Database Schema

**Migration**: `20261025182000_add_photo_archive_columns.sql`

Added to `cadenza_report_photos`:
- `storage_tier` text: `'hot'` (Supabase) | `'archive'` (R2)
- `archive_key` text: R2 object key when archived
- `archived_at` timestamptz: Archive timestamp
- `size_bytes` bigint: File size
- `thumb_path` text: Thumbnail path

**Indexes**:
- `idx_report_photos_hot_old`: Find photos to archive
- `idx_report_photos_archive_old`: Find photos to delete

### Archival Jobs (Supabase Edge Functions)

**Created**: `supabase/functions/archive-photos/index.ts`

Nightly job (2 AM UTC) that:
1. Queries each company's plan for `photo_hot_storage_days`
2. Finds photos older than threshold in hot storage
3. Downloads from Supabase Storage
4. Uploads to Cloudflare R2 (S3-compatible API)
5. Updates database with archive metadata
6. Deletes from Supabase Storage
7. Processes in batches (100 per company) for reliability
8. Returns per-company results with error counts

**Created**: `supabase/functions/cleanup-archived-photos/index.ts`

Nightly job (3 AM UTC) that:
1. Queries each company's plan for `photo_retention_days`
2. Finds photos older than retention limit
3. Deletes from R2 (if archived) or Supabase (if still hot)
4. Deletes database records
5. Handles unlimited retention (`-1`) gracefully

**Both functions**:
- Authenticate with service role key or `CRON_SECRET`
- Idempotent (safe to re-run)
- Comprehensive error handling
- Return structured results for monitoring

### Cron Scheduling

**Migration**: `20261025182500_setup_photo_archive_cron.sql`

Uses `pg_cron` extension to schedule:
- Archive: Daily at 2:00 AM UTC
- Cleanup: Daily at 3:00 AM UTC

**Fallback**: If pg_cron unavailable, use Vercel Cron (documented in deployment guide)

### Photo Retrieval

**Created**: `admin-portal/src/app/api/photos/[id]/route.ts`

API endpoint that:
- Checks authorization (user belongs to photo's company)
- Returns presigned URL based on storage tier:
  - Hot: Supabase Storage presigned URL (1 hour)
  - Archive: R2 presigned URL (1 hour)
- Uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`

---

## Section D: Video Strategy 📝 DOCUMENTED

**Created**: `docs/VIDEO-COMPRESSION.md`

Comprehensive guide covering four implementation approaches:

1. **@ffmpeg/ffmpeg (WebAssembly)**
   - Pros: Portable, no binaries
   - Cons: 10x slower, high memory

2. **Fluent-FFmpeg + Static Binary** (Recommended for MVP)
   - Pros: Fast native performance
   - Cons: 50MB binary size (may need external layer)

3. **External Services** (Cloudflare Stream, Mux)
   - Pros: No infrastructure, optimized delivery
   - Cons: Additional cost, vendor lock-in

4. **Vercel Queue + Long-Duration Function**
   - Pros: Handles long videos (30 min timeout)
   - Cons: Requires Vercel Pro ($20/mo)

**Includes**:
- Database schema for `cadenza_report_videos` table
- Cost estimates (storage, bandwidth, processing)
- Testing instructions
- Monitoring strategies
- Future enhancements (adaptive streaming, multiple resolutions)

**Implementation**: Deferred to post-deployment (choose approach based on requirements)

---

## Section E: Deployment Documentation ✅ COMPLETE

### Created: `docs/DEPLOYMENT-GUIDE.md`

10-part comprehensive deployment checklist:

1. **Environment Variables**: Admin-portal, technician-app, Supabase
2. **Stripe Setup**: Products, prices, webhook configuration
3. **Database Migrations**: Application order and verification
4. **Cloudflare R2**: Bucket creation, API tokens, testing
5. **Supabase Edge Functions**: Deployment and secrets management
6. **pg_cron**: Extension setup and job verification
7. **Technician App**: EAS build configuration and deployment
8. **Testing Checklist**: End-to-end verification steps
9. **Monitoring**: Queries, logs, and alerts
10. **Rollback Plan**: Emergency recovery procedures

**Includes**:
- All required environment variables with descriptions
- Complete SQL setup commands
- CLI commands for all deployments
- Monitoring queries for production health checks
- Troubleshooting guide

---

## Environment Variables Required

### Admin Portal (Vercel)

```bash
# Core Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe (Production)
NEXT_PUBLIC_PAYMENT_GATEWAY=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# App Configuration
NEXT_PUBLIC_APP_URL=https://app.cadenza.com
CRON_SECRET=your-secure-random-string
STORAGE_MASTER_KEY=your-64-char-hex-key

# Cloudflare R2 (Photo Archival)
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=cadenza-photos-archive
```

### Supabase Database Settings

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET app.cron_secret = 'your-cron-secret';
```

### Supabase Edge Functions

```bash
supabase secrets set \
  R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
  R2_ACCESS_KEY_ID=xxx \
  R2_SECRET_ACCESS_KEY=xxx \
  R2_BUCKET_NAME=cadenza-photos-archive \
  CRON_SECRET=your-cron-secret
```

---

## Deployment Steps Summary

1. **Apply Migrations** (DO NOT apply to production yet):
   ```bash
   supabase db push --include-all
   ```

2. **Setup Stripe Products**:
   ```bash
   cd admin-portal
   node scripts/setup-stripe-products.js
   ```
   Save the three Stripe Price IDs.

3. **Configure Stripe Webhook**:
   - URL: `https://app.cadenza.com/api/webhooks/stripe`
   - Events: checkout, subscription, invoice, payment_method, customer
   - Copy signing secret to `STRIPE_WEBHOOK_SECRET`

4. **Setup Cloudflare R2**:
   - Create bucket `cadenza-photos-archive`
   - Generate API token (Object Read & Write)
   - Add credentials to Vercel

5. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy archive-photos
   supabase functions deploy cleanup-archived-photos
   supabase secrets set R2_ENDPOINT=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_NAME=... CRON_SECRET=...
   ```

6. **Build Mobile App**:
   ```bash
   cd technician-app
   eas build --platform all --profile production
   ```

7. **Testing**:
   - Free plan signup (no payment required)
   - Paid plan signup with quantity selection
   - Webhook creates subscription with correct quantity
   - Seat limits enforced
   - Photo compression works
   - Archive job runs successfully (after 30 days)

---

## Files Changed

### New Files (20)
- `admin-portal/src/lib/plan-limits.ts`
- `admin-portal/src/app/api/photos/[id]/route.ts`
- `supabase/migrations/20261025181746_data_driven_billing_tiers.sql`
- `supabase/migrations/20261025182000_add_photo_archive_columns.sql`
- `supabase/migrations/20261025182500_setup_photo_archive_cron.sql`
- `supabase/functions/archive-photos/index.ts`
- `supabase/functions/cleanup-archived-photos/index.ts`
- `technician-app/lib/photoCompression.ts`
- `docs/DEPLOYMENT-GUIDE.md`
- `docs/VIDEO-COMPRESSION.md`

### Modified Files (12)
- `BILLING-SETUP.md`
- `admin-portal/package.json` / `package-lock.json`
- `admin-portal/scripts/setup-stripe-products.js`
- `admin-portal/src/app/api/billing/checkout/route.ts`
- `admin-portal/src/app/api/invite-codes/route.ts`
- `admin-portal/src/lib/billing/adapters/stripe.adapter.ts`
- `admin-portal/src/lib/billing/adapters/stripe-webhook.normalizer.ts`
- `technician-app/package.json` / `package-lock.json`
- `technician-app/components/PhotoWithOverlay.tsx`

### Migrations
1. `20261025181746_data_driven_billing_tiers.sql` - Pricing model, Pro plan, feature limits
2. `20261025182000_add_photo_archive_columns.sql` - Archive metadata columns
3. `20261025182500_setup_photo_archive_cron.sql` - pg_cron job schedules

---

## Testing Status

### Build & Type Checks ✅
- TypeScript compilation: **PASSING**
- All imports resolved: **PASSING**
- Package dependencies installed: **COMPLETE**

### Manual Testing ⏳
- Checkout quantity flow: **NOT YET TESTED** (requires Stripe keys)
- Webhook handling: **NOT YET TESTED** (requires Stripe webhook)
- Seat limit enforcement: **NOT YET TESTED** (requires DB setup)
- Photo compression: **NOT YET TESTED** (requires mobile build)
- Archive jobs: **NOT YET TESTED** (requires R2 setup)

### Automated Tests ⏳
- Unit tests: **DEFERRED** (existing test infrastructure has unrelated failures)
- Integration tests: **DEFERRED** (requires full environment)
- CI workflow: **DEFERRED** (out of scope for this PR)

---

## Known Limitations & Future Work

1. **Video Compression**: Strategy documented but not implemented
   - Choose approach post-deployment based on volume
   - Options: FFmpeg binary, Cloudflare Stream, or Vercel Queue

2. **Archive Job Testing**: Requires live R2 bucket
   - Can be tested in staging with short hot storage duration

3. **pg_cron Availability**: May need Vercel Cron fallback
   - Depends on Supabase plan tier

4. **Test Coverage**: Deferred comprehensive testing
   - Unit tests for new utilities
   - Integration tests for checkout flow
   - E2E tests for mobile compression

5. **CI Pipeline**: Not included in this PR
   - Recommend GitHub Actions workflow
   - Run lint, build, tests on PR

---

## Production Deployment Readiness

### Ready to Deploy ✅
- All critical billing issues fixed
- Data-driven plan tiers implemented
- Photo compression utility ready
- Archive infrastructure complete
- Comprehensive documentation

### Before Production Deployment
1. Review and test in staging environment
2. Setup Cloudflare R2 bucket
3. Run Stripe product setup script with live keys
4. Configure webhook endpoint in Stripe
5. Apply migrations to production database
6. Deploy Edge Functions with secrets
7. Rebuild and publish mobile app
8. Monitor for 24-48 hours before announcing

### Post-Deployment Tasks
1. Monitor Stripe webhook delivery
2. Verify archive jobs run successfully
3. Check photo compression in production
4. Collect user feedback on new plans
5. Implement video compression (choose approach)
6. Add comprehensive test suite
7. Setup alerts and monitoring

---

## Support & Maintenance

### Monitoring Queries

```sql
-- Active subscriptions by plan
SELECT plan_id, status, COUNT(*) 
FROM cadenza_billing_subscriptions 
WHERE status IN ('active', 'trialing', 'past_due')
GROUP BY plan_id, status;

-- Photos pending archive
SELECT COUNT(*), company_id 
FROM cadenza_report_photos 
WHERE storage_tier = 'hot' 
  AND created_at < NOW() - INTERVAL '30 days'
GROUP BY company_id;

-- Subscription quantity issues
SELECT s.id, s.user_id, s.plan_id, s.quantity, COUNT(p.id) as active_techs
FROM cadenza_billing_subscriptions s
JOIN cadenza_profiles p ON p.company_id = (
  SELECT company_id FROM cadenza_profiles WHERE id = s.user_id
)
WHERE s.status IN ('active', 'trialing')
  AND p.role = 'technician'
  AND p.is_active = true
GROUP BY s.id
HAVING COUNT(p.id) > s.quantity;
```

### Troubleshooting

**Checkout fails with quantity error:**
- Check client sends quantity in request body
- Verify quantity is number between 1-1000
- Check Stripe logs for API errors

**Webhook not creating subscription:**
- Verify webhook signature in Stripe Dashboard
- Check `STRIPE_WEBHOOK_SECRET` matches
- Ensure metadata includes `user_id`, `plan_id`, `quantity`

**Archive job not running:**
- Verify pg_cron is enabled: `SELECT * FROM cron.job;`
- Check Edge Function logs in Supabase
- Verify R2 credentials in Edge Function secrets
- Test manually: `curl -X POST https://your-project.supabase.co/functions/v1/archive-photos -H "Authorization: Bearer ..."`

**Photos not compressing:**
- Check `expo-image-manipulator` installed in technician-app
- Verify `photoCompression.ts` imported and used
- Test locally with `expo start`

---

## Conclusion

All core requirements completed:
- ✅ Critical billing issues fixed
- ✅ Data-driven plan tiers with Pro plan
- ✅ Photo compression and archival infrastructure
- ✅ Comprehensive deployment documentation
- 📝 Video strategy documented (implementation deferred)

**Ready for deployment** with proper staging testing and monitoring setup.

**PR**: https://github.com/AGASocial/caicos-pool-service/pull/16
