# Photo Retention Strategy - Option 1 vs Option 2

**Document Date:** 2026-02-28
**Purpose:** Analyze two photo retention strategies for CAICOS
**Decision:** Business model choice for scaling

---

## Option 1: Quality Tiering + External Storage

### Strategy Overview
- **Months 0-3:** Store photos at full quality (5MB) in Supabase
- **Month 4+:** Automatically compress to 1-2MB and move to Google Drive/Apple iCloud
- **User Experience:** High-quality recent photos, compressed historical photos available in cloud

### Cost Breakdown (Pilot Customer - 35 techs, 36GB/month added)

#### Storage Costs

| Month | Supabase (Fresh) | Google Drive Cost | Total | Running Total |
|-------|-----------------|------------------|-------|---------------|
| Month 1 | 36 GB: $41 | $0 | $41 | $41 |
| Month 2 | 36 GB: $41 | $0 | $41 | $82 |
| Month 3 | 36 GB: $41 | $0 | $41 | $123 |
| Month 4 | 36 GB: $41 | 108 GB: $0-5 | $41-46 | $169-174 |
| Month 5 | 36 GB: $41 | 144 GB: $0-7 | $41-48 | $210-222 |
| Month 6 | 36 GB: $41 | 180 GB: $0-10 | $41-51 | $251-273 |

**Supabase Storage:** Only stores 36GB (current month) = stable at $41/month
**Google Drive:**
- Free tier: 15 GB (then $1.99/month for 100GB, $9.99/month for 2TB)
- If using storage: 180 GB would need $9.99/month plan

**Total 6-month cost:** $251-273 (vs $453 without cleanup)

### Implementation Complexity: 🔴 HIGH (16-24 hours)

#### What You Need to Build

1. **Automated Compression Pipeline** (4-6 hours)
   - Supabase scheduled job (or cron)
   - Find photos >90 days old
   - Download from Supabase
   - Compress 5MB → 1-2MB
   - Upload to Google Drive/iCloud
   - Delete from Supabase
   - Log transaction

2. **Google Drive Integration** (6-8 hours)
   - Google Cloud Console setup
   - OAuth service account creation
   - Google Drive API integration
   - Folder structure management
   - Error handling & retry logic
   - Rate limiting (Google Drive has 10,000 writes/day limit)

3. **Apple iCloud Integration** (Alternative - 8-10 hours)
   - CloudKit framework setup (iOS specific)
   - Authentication
   - Upload/download logic
   - Sync handling

4. **Admin Portal Feature** (3-4 hours)
   - UI to browse compressed photos in cloud storage
   - Link to open in Google Drive/iCloud
   - Download from cloud storage
   - Delete old photos management

5. **Testing & Error Handling** (2-4 hours)
   - Handle API failures gracefully
   - Retry logic
   - Notification if compression fails
   - Test with real data

#### Hidden Costs
- 🔴 **Development time:** 16-24 hours
- 🔴 **Ongoing maintenance:** API changes, quota management
- 🔴 **Customer support:** "Where are my old photos?" issues
- 🔴 **Complexity:** Two storage systems to maintain
- 🔴 **Data consistency risks:** Photos could fail to move

#### Pros
✅ Recent photos at full quality (5MB)
✅ Unlimited retention (cheap cloud storage)
✅ Customers keep photos forever
✅ Professional feature (cloud backup)
✅ Can charge premium for this feature

#### Cons
❌ Very complex to build (16-24 hours)
❌ Maintains two storage systems
❌ Google Drive/iCloud API complexities
❌ Higher support burden
❌ More things that can break
❌ Customer experience is split (some in Supabase, some in cloud)
❌ Compression happens automatically (might surprise users)

---

## Option 2: Compress Day 1 + Tiered Retention Pricing

### Strategy Overview
- **Day 1:** Compress all photos to 1-2MB before storing
- **Included:** 3 months of photo retention (included in $9.99/month)
- **Extra:** $4.99/month for 6-month retention, $9.99/month for unlimited
- **User Experience:** Consistent, compressed quality, simple retention tiers

### Cost Breakdown (Pilot Customer - 35 techs, 36GB/month)

#### With Compression (5MB → 1-2MB)
Photos per month shrink from 36GB → 7-14GB

| Month | Supabase (3-month retention) | Cost | Running Total |
|-------|------------------------------|------|--------------|
| Month 1 | 7-14 GB | $25-27 | $27 |
| Month 2 | 14-28 GB | $28-32 | $55-59 |
| Month 3 | 21-42 GB (all 3 months stored) | $32-40 | $87-99 |
| Month 4 | 7-14 GB (newest only, old deleted) | $25-27 | $112-126 |
| Month 5 | 7-14 GB | $25-27 | $137-153 |
| Month 6 | 7-14 GB | $25-27 | $162-180 |

**6-month cost:** $162-180 (vs $453 without any strategy)

### Implementation Complexity: 🟢 LOW (2-3 hours)

#### What You Need to Build

1. **Photo Compression** (1-2 hours)
   - Modify expo-image-picker quality setting (0.3-0.5)
   - OR add server-side compression after upload
   - Test image quality is acceptable

2. **Auto-Delete Policy** (1 hour)
   - Supabase scheduled job
   - Delete photos older than 90 days
   - Log deleted photos count
   - Error handling

3. **Optional: Pricing Tiers UI** (1-2 hours)
   - Show current retention plan
   - Option to upgrade retention
   - Display when retention expires
   - Warnings at 14 days before expiration

#### Hidden Costs
- 🟢 **Development time:** 2-3 hours only
- 🟢 **Ongoing maintenance:** Simple (one storage system)
- 🟢 **Customer support:** Clear, simple model
- 🟢 **Reliability:** Single point of truth (Supabase)

#### Pros
✅ Very simple to implement (2-3 hours)
✅ Single storage system (Supabase)
✅ Lower cost ($162-180/6 months vs $453)
✅ Clear pricing model
✅ Easy to understand for customers
✅ Can upsell retention upgrades
✅ Compression happens transparently
✅ Consistent photo quality
✅ Scalable (no API limits like Google Drive)

#### Cons
❌ Photos are compressed from day 1 (not full quality)
❌ Limited retention unless they pay extra
❌ Customers might want to keep photos forever "for free"
❌ Requires explaining compression trade-off

---

## 💰 Cost Comparison (6 Months, Pilot Customer)

### Scenario A: No Cleanup (Worst Case)
- **Cost:** $453
- **Storage:** 216 GB cumulative
- **Issue:** Costs keep growing indefinitely

### Scenario B: Option 1 (Quality Tiering)
- **Cost:** $251-273 (including Google Drive subscription)
- **Storage:** 36 GB hot + 180 GB in cloud
- **Complexity:** High (16-24 hours to build)
- **Savings:** $180 (40% vs no cleanup)

### Scenario C: Option 2 (Compress + Tier Pricing) ✅ RECOMMENDED
- **Cost:** $162-180
- **Storage:** 7-14 GB (stable)
- **Complexity:** Low (2-3 hours)
- **Savings:** $273 (60% vs no cleanup)

---

## 📊 Pricing Models for Each Option

### Option 1 Pricing Model

```
Base Plan: $9.99/tech/month
├─ 3 months high-quality photos (Supabase)
├─ Automatic compression after 3 months
├─ Unlimited historical storage (in cloud)
└─ Access to all photos (Supabase + cloud)

Premium Plan: $14.99/tech/month (future)
├─ 6 months high-quality photos
└─ Everything else from base
```

**Pros:** Premium "unlimited" feeling, professional
**Cons:** Complex to explain, hard to upsell

### Option 2 Pricing Model ✅ CLEANER

```
Base Plan: $9.99/tech/month
├─ 3 months photo retention
├─ Compressed photo quality
└─ All features included

Retention Add-ons:
├─ 6-month retention: +$4.99/tech/month
└─ Unlimited retention: +$9.99/tech/month
```

**Pros:** Simple, clear, easy to upsell
**Cons:** Requires upselling (but that's revenue!)

---

## 🎯 Recommendation: OPTION 2

### Why Option 2 is Better

1. **Time to Market:** 2-3 hours vs 16-24 hours
   - Get to pilot launch faster
   - Validate business model sooner

2. **Maintenance:** One storage system
   - Less infrastructure to manage
   - Fewer things to break
   - Simpler support tickets

3. **Cost:** 60% savings vs no cleanup
   - $180 for 6 months vs $453
   - Sustainable long-term
   - Grows slowly with customers

4. **Revenue:** Built-in upselling
   - Base: $9.99/tech
   - Optional: +$4.99 for 6-month retention
   - Optional: +$9.99 for unlimited
   - Real revenue generator as you scale

5. **Customer Experience:** Crystal clear
   - "You get 3 months of photos"
   - "Pay $4.99 more for longer"
   - Easy to understand
   - No surprise deletions

### Implementation Plan (Option 2)

**Week 1:**
- [ ] Set up photo compression (reduce quality setting in expo-image-picker)
- [ ] Test image quality is acceptable
- [ ] Add Supabase scheduled job for auto-delete >90 days

**Week 2:**
- [ ] Implement retention counter in admin portal
- [ ] Show "photos expire on [DATE]" in UI
- [ ] Add warning at 14 days before expiration

**Week 3:**
- [ ] Launch with pilot customer
- [ ] Get feedback on photo quality
- [ ] Track how often customers want longer retention

**After Pilot:**
- [ ] Offer retention upgrades if demanded
- [ ] Add 6-month and unlimited options to pricing page
- [ ] Measure revenue from retention add-ons

---

## 🚀 Option 2 Implementation Code (Outline)

### 1. Photo Compression (Existing Code - Minor Change)

```typescript
// In job/[id].tsx - ALREADY IMPLEMENTED
const result = await ImagePicker.launchCameraAsync({
  quality: 0.7, // ← Change to 0.3-0.5 for compression
  allowsEditing: false,
});
```

**Change:** quality: 0.7 → quality: 0.5 (or 0.3 for more compression)
**Time:** 5 minutes

### 2. Auto-Delete Scheduled Job (Supabase SQL)

```sql
-- Create scheduled job in Supabase
-- Run daily at 2 AM UTC

SELECT
  id,
  bucket_id,
  name,
  created_at
FROM storage.objects
WHERE bucket_id = 'report-photos'
AND created_at < now() - interval '90 days'

-- Delete these files (manual or via function)
-- Log count of deleted files
```

**Time:** 1-2 hours to set up properly with error handling

### 3. Show Expiration in Admin Portal

```typescript
// Show in report detail or jobs list
const expirationDate = new Date(reportDate);
expirationDate.setDate(expirationDate.getDate() + 90);

return (
  <div>
    <p>Photos expire: {expirationDate.toLocaleDateString()}</p>
    {daysUntilExpiry < 14 && (
      <Warning>
        These photos will be deleted in {daysUntilExpiry} days.
        Upgrade retention to keep them longer.
      </Warning>
    )}
  </div>
);
```

**Time:** 30 minutes

**Total Implementation Time:** 2-3 hours

---

## 📈 Upselling Strategy (Revenue Model)

### Retention Tiers by Use Case

| Use Case | Plan | Cost | Best For |
|----------|------|------|----------|
| **Quick reference** | 3 months (free) | Included | Small pools |
| **Legal compliance** | 6 months | +$4.99/tech | Contractors (regulations) |
| **Complete archive** | Unlimited | +$9.99/tech | Large companies, litigation |

### Example: Customer with 50 Technicians

**Base Plan:** 50 × $9.99 = $499.50/month
**If 20% upgrade to 6-month:** 10 × $4.99 = $49.90 extra
**If 5% upgrade to unlimited:** 2.5 × $9.99 = $24.97 extra

**Total Monthly:** $574.37 (15% increase from retention add-ons!)

---

## ✅ Decision Summary

| Factor | Option 1 | Option 2 |
|--------|----------|----------|
| **Build Time** | 16-24 hours 🔴 | 2-3 hours 🟢 |
| **6-Month Cost** | $251-273 | $162-180 |
| **Maintenance** | High 🔴 | Low 🟢 |
| **Upselling** | Weak | Strong 🟢 |
| **Customer Experience** | Complex | Simple 🟢 |
| **Scalability** | Moderate | Excellent 🟢 |
| **Recommended** | ❌ | ✅ YES |

---

## 🎯 My Strong Recommendation

**Go with Option 2 for the pilot.**

**Reasoning:**
1. You need to launch the pilot ASAP with your cousin
2. 2-3 hours to implement vs 16-24 hours is huge
3. 60% cost savings is excellent ($273 saved in 6 months)
4. Built-in upselling for future revenue
5. Can always migrate to Option 1 later if customers demand it

**Timing:**
- Implement compression + auto-delete this week
- Launch pilot with cousin by end of week
- Get feedback on photo quality
- Scale to more customers
- Add retention upselling in Q2 2026

**Example Pitch to Cousin:**
> "CAICOS includes 3 months of photo storage. Photos are automatically archived after 90 days but remain accessible through your dashboard. If you need longer retention (6 months or unlimited), we can add that for $4.99-9.99 per technician per month."

---

**Last Updated:** 2026-02-28
**Recommendation:** Option 2 - Simple, Fast, Revenue-Generating
