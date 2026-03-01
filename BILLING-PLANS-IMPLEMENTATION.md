# CAICOS Billing Plans - Implementation Guide

**Date:** 2026-03-01
**Status:** Ready for development
**Priority:** Critical for pilot launch

---

## Overview

This document shows how to integrate the billing plan limits into your Expo/React Native app and Next.js admin portal. The database schema (`BILLING-PLANS-SCHEMA.sql`) defines limits; this guide shows where and how to enforce them.

---

## 1. Pilot Setup (Day 1)

When your cousin signs up, manually create her subscription:

```sql
-- Create company (if not exists)
INSERT INTO caicos_companies (name, owner_email)
VALUES ('Cousin Pool Service', 'cousin@email.com')
RETURNING id;

-- Create subscription (using returned company_id)
INSERT INTO caicos_company_subscriptions (
  company_id,
  plan_id,
  trial_ends_at,
  status,
  monthly_cost
)
SELECT
  'COMPANY_ID_HERE',
  id,
  NOW() + INTERVAL '90 days',
  'active',
  0
FROM caicos_billing_plans
WHERE slug = 'free-trial';
```

**Result:** Free trial for 90 days, max 10 users total (mix of admins, technicians, etc.), max 2 photos per service, 90-day photo retention.

---

## 2. Technician App Limits

### 2.1 Before Creating Service Job

**File:** `technician-app/app/(app)/job/[id].tsx`

Add this validation before allowing "Mark Complete":

```typescript
import { supabase } from '@/lib/supabase';

async function checkCanCreateJob(companyId: string): Promise<{
  canCreate: boolean;
  jobsThisMonth: number;
  maxAllowed: number;
  message: string;
}> {
  const { data, error } = await supabase.rpc('check_monthly_job_limit', {
    p_company_id: companyId,
  });

  if (error) {
    console.error('Failed to check job limit:', error);
    return {
      canCreate: false,
      jobsThisMonth: 0,
      maxAllowed: 0,
      message: 'Unable to verify job limit',
    };
  }

  return data[0];
}

// In handleMarkComplete():
const handleMarkComplete = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Check monthly limit
  const limitCheck = await checkCanCreateJob(user.user_metadata.company_id);
  if (!limitCheck.canCreate) {
    Alert.alert('Job Limit Reached', limitCheck.message);
    return;
  }

  // Check photo requirement
  if (photos.length === 0) {
    Alert.alert('Missing Photos', 'At least 1 photo is required');
    return;
  }

  // Check issue category
  if (!selectedIssueCategory) {
    Alert.alert('Missing Issue Category', 'Please select an issue category or "No Issues"');
    return;
  }

  // If all checks pass, create the job
  await submitServiceJob();
};
```

### 2.2 Before Uploading Photo

**File:** `technician-app/app/(app)/job/[id].tsx`

Add this validation before photo upload:

```typescript
async function checkCanUploadPhoto(
  companyId: string,
  serviceJobId: string,
  photosToAdd: number = 1
): Promise<{
  canUpload: boolean;
  currentCount: number;
  maxAllowed: number;
  message: string;
}> {
  const { data, error } = await supabase.rpc('check_photo_limit', {
    p_company_id: companyId,
    p_service_job_id: serviceJobId,
    p_new_photo_count: photosToAdd,
  });

  if (error) {
    console.error('Failed to check photo limit:', error);
    return {
      canUpload: false,
      currentCount: 0,
      maxAllowed: 0,
      message: 'Unable to verify photo limit',
    };
  }

  return data[0];
}

// When taking/selecting photos:
const handleAddPhoto = async (photoUri: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Check photo limit
  const photoCheck = await checkCanUploadPhoto(
    user.user_metadata.company_id,
    jobId,
    1
  );

  if (!photoCheck.canUpload) {
    Alert.alert('Photo Limit Reached', photoCheck.message);
    return;
  }

  // Upload photo
  const fileName = `photo_${Date.now()}.jpg`;
  const filePath = `${user.user_metadata.company_id}/${new Date().toISOString().split('T')[0]}/${propertyId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('report-photos')
    .upload(filePath, {
      uri: photoUri,
      name: fileName,
      type: 'image/jpeg',
    });

  if (uploadError) {
    Alert.alert('Upload Failed', uploadError.message);
    return;
  }

  // Add to local state
  setPhotos([...photos, filePath]);
};
```

---

## 3. Admin Portal Limits

### 3.1 Before Adding Technician

**File:** `admin-portal/pages/settings/team.tsx`

```typescript
import { supabase } from '@/lib/supabase-client';

async function checkCanAddUser(companyId: string): Promise<{
  canAddUser: boolean;
  currentCount: number;
  maxAllowed: number;
  planName: string;
  message: string;
}> {
  const { data, error } = await supabase.rpc('check_technician_limit', {
    p_company_id: companyId,
  });

  if (error) {
    console.error('Failed to check user limit:', error);
    return {
      canAddUser: false,
      currentCount: 0,
      maxAllowed: 0,
      planName: 'Unknown',
      message: 'Unable to verify user limit',
    };
  }

  return data[0];
}

// In handleAddUser (works for adding any user type):
const handleAddUser = async (email: string, role: 'admin' | 'technician') => {
  // Check limit first
  const limitCheck = await checkCanAddUser(companyId);

  if (!limitCheck.canAddUser) {
    setError(`${limitCheck.message}. Upgrade to add more.`);
    return;
  }

  // Send invite
  await inviteUser(email, role);
};
```

### 3.2 Subscription Dashboard

**File:** `admin-portal/pages/settings/subscription.tsx`

Display current subscription with visual indicators:

```typescript
import { supabase } from '@/lib/supabase-client';

async function getSubscriptionStatus(companyId: string) {
  const { data, error } = await supabase
    .from('caicos_subscription_dashboard')
    .select('*')
    .eq('company_id', companyId)
    .single();

  return data;
}

// In component:
export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    getSubscriptionStatus(companyId).then(setSubscription);
  }, [companyId]);

  return (
    <div className="space-y-6">
      {/* Plan info */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h2 className="text-lg font-bold">{subscription?.plan_name}</h2>
        <p className="text-sm text-gray-600">
          {subscription?.subscription_phase === 'In Trial' && (
            <>
              <span className="text-green-600">Free trial ends in {subscription.trial_days_remaining} days</span>
            </>
          )}
          {subscription?.subscription_phase === 'Active' && (
            <>
              <span>${subscription?.estimated_monthly_cost}/month for {subscription?.current_technicians} technicians</span>
            </>
          )}
        </p>
      </div>

      {/* Feature limits */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">Team Members</h3>
          <div className="text-2xl font-bold">{subscription?.current_users} / {subscription?.max_total_users}</div>
          <p className="text-xs text-gray-600 mt-1">{subscription?.current_technicians} technicians</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{
                width: `${(subscription?.current_users / subscription?.max_total_users) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">Photos/Service</h3>
          <div className="text-2xl font-bold">{subscription?.max_photos_per_service}</div>
          <p className="text-xs text-gray-600 mt-2">per service report</p>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">Photo Retention</h3>
          <div className="text-2xl font-bold">{subscription?.photo_retention_days} days</div>
          <p className="text-xs text-gray-600 mt-2">then auto-deleted</p>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">Features</h3>
          <ul className="text-xs mt-2 space-y-1">
            {subscription?.has_advanced_reports && <li>✓ Advanced Reports</li>}
            {subscription?.has_api_access && <li>✓ API Access</li>}
            {!subscription?.has_advanced_reports && <li className="text-gray-400">Basic Reports</li>}
          </ul>
        </div>
      </div>

      {/* Upgrade button */}
      {subscription?.subscription_phase === 'In Trial' && (
        <button className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold">
          Start Paid Subscription (${subscription?.estimated_monthly_cost}/month)
        </button>
      )}
    </div>
  );
}
```

---

## 4. Auto-Delete Scheduled Job

### 4.1 Enable pg_cron Extension

Run once in Supabase:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule daily cleanup at 2 AM UTC
SELECT cron.schedule(
  'cleanup_expired_photos',
  '0 2 * * *',
  'SELECT cleanup_expired_photos()'
);
```

Check status:

```sql
SELECT * FROM cron.job;
```

### 4.2 Manual Cleanup Function

If you can't use pg_cron, create an API endpoint:

**File:** `admin-portal/api/admin/cleanup-photos.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

// Only allow from trusted sources (Vercel cron or admin)
export default async function handler(req, res) {
  // Verify authorization
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase.rpc('cleanup_expired_photos');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Log results
  console.log('Photo cleanup:', data);

  return res.json({ deleted_count: data.reduce((a, b) => a + b.deleted_count, 0) });
}
```

Call this daily using Vercel Cron:

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/admin/cleanup-photos",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## 5. Billing Transition Workflow

### Timeline for Your Cousin

**Days 1-90: Free Trial**
- Plan: Free Trial
- Cost: $0
- Limit: 5 technicians, 2 photos/service, 90-day retention

**Day 85: Send Email Warning**
```
Subject: Your CAICOS trial ends in 5 days
Your free trial ends on [DATE]. Ready to go live?
- Move to Growth plan: $9.99/tech/month = $349.65/month for your 35 technicians
- Or stay on free trial with max 5 technicians
Reply to upgrade or schedule a call.
```

**Day 91: Trial Expires**
- Auto-downgrade to Free Plan
- Max 5 technicians only (lock others out)
- 30-day retention instead of 90-day
- New photos cannot be added until plan is chosen

**Upgrade to Growth Plan**
```sql
UPDATE caicos_company_subscriptions
SET plan_id = (SELECT id FROM caicos_billing_plans WHERE slug = 'growth'),
    status = 'active',
    trial_ends_at = NULL,
    monthly_cost = 9.99 * 35
WHERE company_id = 'COMPANY_ID';
```

---

## 6. Cost Calculations

### For Your Pilot Customer (35 Technicians)

**Free Trial (Days 1-90):**
- Cost: $0

**Growth Plan (After Day 90):**
- Price/tech: $9.99
- Technicians: 35
- Monthly cost: $9.99 × 35 = **$349.65**
- Features: Advanced reports, 90-day retention, team permissions

**Premium Plan (If needed later):**
- Price/tech: $19.99
- Technicians: 35
- Monthly cost: $19.99 × 35 = **$699.65**
- Features: Everything unlimited

---

## 7. Testing the Limits

### Test Photo Limit

```typescript
// In technician app test
import { supabase } from '@/lib/supabase';

async function testPhotoLimit() {
  const result = await supabase.rpc('check_photo_limit', {
    p_company_id: 'test-company-id',
    p_service_job_id: 'test-job-id',
    p_new_photo_count: 1,
  });

  console.log(result);
  // Expected output:
  // {
  //   can_upload: true,
  //   current_count: 1,
  //   max_allowed: 2,  // for free trial
  //   message: "OK"
  // }
}
```

### Test User Limit

```typescript
async function testUserLimit() {
  const result = await supabase.rpc('check_technician_limit', {
    p_company_id: 'test-company-id',
  });

  console.log(result);
  // Expected output:
  // {
  //   can_add_user: false,
  //   current_count: 10,
  //   max_allowed: 10,  // for free trial
  //   plan_name: "Free Trial",
  //   message: "User limit reached for Free Trial plan (10 max)"
  // }
}
```

---

## 8. Implementation Checklist

- [ ] Run `BILLING-PLANS-SCHEMA.sql` in Supabase
- [ ] Verify plans and features inserted correctly:
  ```sql
  SELECT bp.name, pf.max_technicians, pf.max_photos_per_service
  FROM caicos_billing_plans bp
  JOIN caicos_plan_features pf ON bp.id = pf.plan_id;
  ```
- [ ] Create subscription for your cousin (free trial)
- [ ] Implement `checkCanUploadPhoto()` in technician app
- [ ] Implement `checkCanCreateJob()` in technician app
- [ ] Implement `checkCanAddTechnician()` in admin portal
- [ ] Add subscription dashboard to admin portal
- [ ] Enable pg_cron for auto-delete (or create Vercel cron endpoint)
- [ ] Test each limit with sample data
- [ ] Deploy to production
- [ ] Start free trial with cousin

---

## 9. Troubleshooting

### Photos aren't being auto-deleted

Check if pg_cron is working:

```sql
SELECT * FROM cron.job;
```

If empty, enable it:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('cleanup_expired_photos', '0 2 * * *', 'SELECT cleanup_expired_photos()');
```

### Limit checks always return false

Verify subscription exists:

```sql
SELECT * FROM caicos_company_subscriptions WHERE company_id = 'xxx';
```

Verify plan features:

```sql
SELECT * FROM caicos_plan_features WHERE plan_id = 'xxx';
```

### Photos aren't showing in retention count

Photos are counted by `created_at` timestamp. Make sure all photos have valid timestamps.

---

## 10. Next Steps

1. **This week:** Deploy billing schema and create your cousin's subscription
2. **Next week:** Implement photo limit checks in technician app
3. **Week 3:** Implement technician limit checks in admin portal
4. **Week 4:** Deploy and test with cousin's team
5. **Day 85:** Send trial expiration warning
6. **Day 91:** Upgrade to paid plan

---

**Questions?** Reference this doc during implementation. Good luck with the launch! 🚀

*Last updated: 2026-03-01*
