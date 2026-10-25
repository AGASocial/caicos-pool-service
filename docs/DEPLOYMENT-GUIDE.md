# Production Deployment Guide - Billing & Features

Complete guide for deploying the production-ready billing, subscription, photo archival, and video features to Cadenza.

## Prerequisites

- Supabase project (production instance)
- Vercel account with admin-portal deployed
- Stripe account (production mode)
- Cloudflare R2 bucket for photo archival
- EAS account for technician-app builds

## Part 1: Environment Variables

### Admin Portal (Vercel)

Add these environment variables in Vercel Dashboard → Project → Settings → Environment Variables:

```bash
# Supabase
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

# Cloudflare R2 (Photo Archival)
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=cadenza-photos-archive

# Storage Encryption
STORAGE_MASTER_KEY=your-64-char-hex-key

# Optional: PayU (if using)
PAYU_MERCHANT_ID=xxx
PAYU_ACCOUNT_ID=xxx
PAYU_API_KEY=xxx
PAYU_API_LOGIN=xxx
PAYU_TEST=false
PAYU_RESPONSE_URL=https://app.cadenza.com/payments/payu/return
```

### Technician App (EAS Build)

Add to `eas.json` secrets or `.env.production`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Supabase (Database Settings)

Configure in Supabase Dashboard → Project Settings → Database → Custom Settings:

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET app.cron_secret = 'your-cron-secret';
```

## Part 2: Stripe Setup

### 1. Create Products and Prices

Run the setup script locally with production Stripe keys:

```bash
cd admin-portal
STRIPE_SECRET_KEY=sk_live_... \
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node scripts/setup-stripe-products.js
```

This creates:
- Free Plan: price_xxx (price_free_monthly)
- Standard Plan: price_xxx at $14.99 per unit/month
- Pro Plan: price_xxx at $24.99 per unit/month

**Save the Stripe Price IDs** output by the script - you'll need them.

### 2. Update Database with Price IDs

If the script didn't update the database automatically, run:

```sql
UPDATE cadenza_billing_plans
SET provider_price_map = jsonb_set(
  provider_price_map,
  '{stripe}',
  '"price_xxx"'
)
WHERE id = 'plan_free';

UPDATE cadenza_billing_plans
SET provider_price_map = jsonb_set(
  provider_price_map,
  '{stripe}',
  '"price_xxx"'
)
WHERE id = 'plan_necessary_month';

UPDATE cadenza_billing_plans
SET provider_price_map = jsonb_set(
  provider_price_map,
  '{stripe}',
  '"price_xxx"'
)
WHERE id = 'plan_pro_month';
```

Replace `price_xxx` with actual Stripe Price IDs.

### 3. Configure Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://app.cadenza.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `payment_method.attached`
   - `payment_method.detached`
   - `customer.created`
   - `customer.updated`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET` env var

### 4. Test Webhook Delivery

```bash
# Send test event
stripe trigger checkout.session.completed --api-key sk_live_...

# Check Vercel logs for successful processing
vercel logs --prod
```

## Part 3: Database Migrations

Apply migrations to production Supabase:

```bash
cd /workspace
supabase link --project-ref your-project-ref
supabase db push --include-all
```

Or apply manually via Supabase SQL Editor:

1. `20261025181746_data_driven_billing_tiers.sql`
2. `20261025182000_add_photo_archive_columns.sql`
3. `20261025182500_setup_photo_archive_cron.sql`

**Verify migrations:**

```sql
-- Check billing plans
SELECT id, name, amount_cents, pricing_model, active FROM cadenza_billing_plans;

-- Check archive columns
\d cadenza_report_photos

-- Check cron jobs
SELECT * FROM cron.job;
```

## Part 4: Cloudflare R2 Setup

### 1. Create R2 Bucket

1. Go to Cloudflare Dashboard → R2 → Create Bucket
2. Name: `cadenza-photos-archive`
3. Location: Automatic

### 2. Create API Token

1. R2 → Manage R2 API Tokens → Create API Token
2. Permissions: Object Read & Write
3. Save Access Key ID and Secret Access Key
4. Add to Vercel environment variables (see Part 1)

### 3. Test R2 Connection

```bash
# Install AWS CLI (R2 is S3-compatible)
aws configure --profile r2
# Enter R2 Access Key ID and Secret

# Test upload
echo "test" > test.txt
aws s3 cp test.txt s3://cadenza-photos-archive/ \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com \
  --profile r2

# Verify
aws s3 ls s3://cadenza-photos-archive/ \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com \
  --profile r2
```

## Part 5: Supabase Edge Functions

Deploy archive and cleanup Edge Functions:

```bash
cd /workspace

# Deploy archive function
supabase functions deploy archive-photos \
  --project-ref your-project-ref \
  --no-verify-jwt

# Deploy cleanup function
supabase functions deploy cleanup-archived-photos \
  --project-ref your-project-ref \
  --no-verify-jwt

# Set secrets for Edge Functions
supabase secrets set \
  R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
  R2_ACCESS_KEY_ID=xxx \
  R2_SECRET_ACCESS_KEY=xxx \
  R2_BUCKET_NAME=cadenza-photos-archive \
  CRON_SECRET=your-cron-secret \
  --project-ref your-project-ref
```

**Test Edge Functions:**

```bash
# Test archive function
curl -X POST https://your-project.supabase.co/functions/v1/archive-photos \
  -H "Authorization: Bearer your-service-role-key"

# Check logs
supabase functions logs archive-photos --project-ref your-project-ref
```

## Part 6: Enable pg_cron Extension

pg_cron is included in Supabase but may need to be enabled:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Verify schedules
SELECT * FROM cron.job;
```

If pg_cron is not available on your Supabase plan, use Vercel Cron instead:

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/archive-photos",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/cleanup-photos",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Create corresponding API routes in admin-portal.

## Part 7: Technician App Build

### Update Mobile App

1. **Install dependencies:**
   ```bash
   cd technician-app
   npm install expo-image-manipulator @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   ```

2. **Update eas.json for production:**
   ```json
   {
     "build": {
       "production": {
         "env": {
           "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
           "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJ..."
         }
       }
     }
   }
   ```

3. **Build and submit:**
   ```bash
   eas build --platform all --profile production
   eas submit --platform all --profile production
   ```

## Part 8: Testing Checklist

### Billing Flow
- [ ] Free plan signup works (no payment)
- [ ] Paid plan signup redirects to Stripe Checkout
- [ ] Checkout quantity field works (1-1000 validation)
- [ ] Checkout session receives correct quantity
- [ ] Webhook creates subscription with correct quantity
- [ ] Seat limits enforced when inviting technicians
- [ ] Upgrade/downgrade flow works
- [ ] Subscription cancellation works

### Photo Compression
- [ ] Mobile app compresses photos to 1600px max
- [ ] Thumbnails generated at 320px
- [ ] Photos visible in admin dashboard
- [ ] Archive job moves old photos to R2 (check after 30 days)
- [ ] Archived photos retrievable via API
- [ ] Cleanup job deletes photos beyond retention

### Plan Limits
- [ ] Free plan expires after 90 days (or configured duration)
- [ ] Photo per-service limits enforced
- [ ] Video upload blocked on non-Pro plans
- [ ] Report history filtered by plan limit
- [ ] Data export blocked on non-Pro plans

## Part 9: Monitoring

### Stripe Dashboard
- Monitor subscription creations
- Check for failed payments
- Review webhook delivery logs

### Vercel Logs
```bash
vercel logs --prod --since 1h
```

### Supabase Logs
- Check Edge Function logs for archive/cleanup jobs
- Monitor database for failed photos (storage_tier inconsistencies)

### Database Queries

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

-- Archive job errors
SELECT * FROM cadenza_report_photos 
WHERE storage_tier = 'archive' 
  AND archive_key IS NULL;
```

## Part 10: Rollback Plan

If critical issues arise:

1. **Stripe Webhook Issues:**
   - Disable webhook in Stripe Dashboard
   - Fix and redeploy admin-portal
   - Re-enable webhook

2. **Archive Job Failures:**
   ```sql
   -- Pause cron jobs
   SELECT cron.unschedule('archive-old-photos');
   SELECT cron.unschedule('cleanup-archived-photos');
   
   -- Fix and reschedule
   SELECT cron.schedule(...);
   ```

3. **Database Migration Issues:**
   ```sql
   -- Rollback tiers migration
   UPDATE cadenza_billing_plans SET pricing_model = 'flat' WHERE pricing_model = 'per_technician';
   DELETE FROM cadenza_billing_plans WHERE id = 'plan_pro_month';
   ```

## Support

For issues during deployment:
- Check Vercel logs: `vercel logs --prod`
- Check Supabase logs: Dashboard → Logs
- Check Stripe webhook delivery: Dashboard → Developers → Webhooks → [endpoint] → Attempts
- Review migration status: `SELECT * FROM supabase_migrations.schema_migrations;`

## Post-Deployment

1. Test complete signup flow end-to-end
2. Verify cron jobs run successfully (wait 24h)
3. Monitor for any errors in first week
4. Set up alerts for:
   - Failed Stripe webhooks
   - Archive job failures
   - Stuck video compression jobs
5. Document any production-specific configuration changes
