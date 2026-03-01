# CAICOS Platform - Cost Analysis & Pilot Strategy

**Document Created:** 2026-02-28
**Author:** AGA Social (byagasocial@gmail.com)
**Purpose:** Financial planning for CAICOS SaaS platform launch
**Status:** Pilot Phase Planning

---

## Executive Summary

- **Pilot Customer:** Cousin's pool service business
- **Pricing Model:** $9.99/technician/month
- **Expected Monthly Revenue:** $349.65 (35 technicians)
- **Expected Monthly Costs:** $56-66
- **Monthly Profit:** $283-294 (81% margin)
- **Status:** ✅ Sustainable for pilot phase

---

## Customer Profile (Pilot)

| Metric | Value |
|--------|-------|
| **Routes** | 35 |
| **Total Pools** | 900 |
| **Technicians** | ~35 (1 per route) |
| **Service Frequency** | Weekly |
| **Photos per Service** | 1-2 |

---

## Monthly Photo Volume Calculation

### Conservative Estimate (1 photo per pool per week)
- 900 pools × 1 photo/week = 900 photos/week
- 900 photos/week × 4 weeks = **3,600 photos/month**
- 3,600 photos × 5MB average = **18 GB/month**

### Realistic Estimate (2 photos per pool per week)
- 900 pools × 2 photos/week = 1,800 photos/week
- 1,800 photos/week × 4 weeks = **7,200 photos/month**
- 7,200 photos × 5MB average = **36 GB/month**

---

## Monthly Cost Breakdown

### Supabase (Database, Auth, Storage)

| Component | Conservative | Realistic | Notes |
|-----------|--------------|-----------|-------|
| Pro Base Plan | $25 | $25 | Includes 8GB storage |
| Database Storage Overages | $2.50 | $7.00 | (18GB or 36GB - 8GB) × $0.25/GB |
| File Storage | $3 | $5 | Photo storage bucket |
| Data Egress | $5 | $8 | Downloads, report viewing |
| Realtime (optional) | $0 | $0 | Not essential for MVP |
| **Supabase Subtotal** | **$35.50** | **$45** | |

### Vercel (Admin Portal Hosting)

| Component | Cost | Notes |
|-----------|------|-------|
| Pro Plan | $20 | Includes 1TB bandwidth |
| Serverless Functions | $1 | Build minutes, API calls |
| **Vercel Subtotal** | **$21** | |

### Expo (Mobile App Hosting)

| Component | Cost | Notes |
|-----------|------|-------|
| Managed Hosting | Free | Expo provides free hosting |
| EAS Builds | $0 | Not needed for MVP |
| **Expo Subtotal** | **$0** | |

### **TOTAL INFRASTRUCTURE COSTS**

| Scenario | Monthly Cost | Annual Cost |
|----------|-------------|------------|
| Conservative (1 photo/pool) | **$56.50** | **$678** |
| Realistic (2 photos/pool) | **$66** | **$792** |

---

## Revenue Model

### Pricing Structure
- **$9.99 per technician per month**
- Paid monthly
- Per-technician metric scales with business growth

### Pilot Customer Revenue

| Metric | Amount |
|--------|--------|
| Technicians | 35 |
| Price per technician | $9.99 |
| **Monthly Revenue** | **$349.65** |
| **Annual Revenue (first year)** | **$4,195.80** |

---

## Profitability Analysis (Pilot Phase)

### Monthly Profit (Direct)

| Scenario | Revenue | Costs | Profit | Margin |
|----------|---------|-------|--------|--------|
| Conservative | $349.65 | $56.50 | $293.15 | 83.8% |
| Realistic | $349.65 | $66.00 | $283.65 | 81.0% |

✅ **Pilot is cash-positive from day 1**

---

## What This Profit Covers

### ✅ What's Included
- ✅ All server & database infrastructure
- ✅ All cloud storage & bandwidth
- ✅ Supabase authentication system
- ✅ Real-time capabilities (included)
- ✅ File uploads & management
- ✅ Basic buffer for unexpected costs

### ❌ What It DOESN'T Cover
- Your development time (bug fixes, support, features)
- Your salary as founder
- Tax obligations
- Marketing/customer acquisition
- Legal/incorporation costs
- Customer support dedicated hours
- Future feature development

**Bottom Line:** This covers the *product*, not your *labor*.

---

## Pilot Strategy & Positioning

### Proposed Offer to Your Cousin

> **"I'm launching CAICOS and want to use your business as our official first pilot customer. Here's the deal:**
>
> **Pricing:** $9.99/technician/month (70% discount vs. market rate)
>
> **Duration:** 3 months (January-March 2026)
>
> **What you get:**
> - Full access to the platform
> - Direct support & bug fixes
> - Feature requests get priority
> - Weekly feedback sessions
>
> **What I get:**
> - Real-world testing with 35 technicians
> - Detailed feedback & suggestions
> - Permission to use as case study
> - Testimonial & reference
>
> **After 3 months:** Platform moves to $19.99/tech (market rate) or we negotiate based on results."

### Why This Works

| Benefit | Value |
|---------|-------|
| No customer acquisition cost (CAC) | $3,500+ savings |
| Real production data (900 pools) | Priceless |
| Case study for future customers | $5,000-10,000 value |
| Product feedback loops | Critical for MVP |
| Reference customer | Enables future sales |
| Early revenue validation | Proof of concept |

---

## Scaling Analysis

### What Happens as You Grow?

| Customers | Total Pools | Total Techs | Monthly Revenue | Monthly Cost | Profit |
|-----------|------------|-----------|-----------------|-------------|--------|
| 1 pilot | 900 | 35 | $349.65 | $66 | $283.65 |
| 2nd customer | 1,800 | 70 | $699.30 | $100 | $599.30 |
| 5th customer | 4,500 | 175 | $1,748.25 | $200 | $1,548.25 |
| 10th customer | 9,000 | 350 | $3,496.50 | $400 | $3,096.50 |
| 20th customer | 18,000 | 700 | $6,993 | $800 | $6,193 |

**Key Insight:** Infrastructure costs scale slowly while revenue scales linearly. This is the SaaS advantage.

---

## Cost Optimization Opportunities

### If Photos Are Truly 5MB (Uncompressed)

**Current State:**
- Photos at full resolution: 5MB each
- Monthly storage: 18-36 GB
- Storage cost: $56-66/month

**Optimization Path:**

#### Option 1: Smart Compression (Immediate)
- Reduce to 1-2MB per photo (60-80% compression)
- Tools: expo-image-picker quality: 0.3-0.5
- Result: 9-18 GB/month
- Cost savings: **$15-20/month** ✅

#### Option 2: Archive Old Photos (3-month policy)
- Auto-delete photos after 90 days
- Move to cold storage (AWS S3 Glacier)
- Result: Only keep 3 months of photos hot
- Cost savings: **$20-30/month** ✅

#### Option 3: Format Optimization (Long-term)
- Convert JPEG → WebP (30% smaller)
- Resize to 2000x2000px max
- Result: 1-2 MB per photo
- Cost savings: **$20-25/month** ✅

### Optimized Scenario (Best Case)
- With compression: **$30-40/month**
- With archival: **$20-30/month**
- **Potential savings: $25-35/month** 💰

---

## Financial Projections - Year 1

### Conservative Scenario (2 new customers per quarter)

| Quarter | Customers | Techs | Revenue | Costs | Profit |
|---------|-----------|-------|---------|-------|--------|
| Q1 2026 | 1 | 35 | $1,049 | $200 | $849 |
| Q2 2026 | 2 | 70 | $2,098 | $350 | $1,748 |
| Q3 2026 | 3 | 105 | $3,147 | $450 | $2,697 |
| Q4 2026 | 4 | 140 | $4,196 | $550 | $3,646 |
| **Year 1** | **4 avg** | **87.5** | **$10,490** | **$1,550** | **$8,940** |

---

## Key Assumptions & Risks

### Assumptions Made
1. ✅ 1 photo per pool per week (conservative)
2. ✅ Photos at 5MB average (uncompressed)
3. ✅ Weekly service model (typical for pool industry)
4. ✅ No data overages beyond what's listed
5. ✅ Supabase Pro plan sufficient (no Enterprise needed)
6. ✅ Vercel Pro sufficient for admin portal

### Risk Factors

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Photos larger than 5MB | Cost could increase | Implement compression |
| Higher service frequency | More photos | Archive/delete old photos |
| Bandwidth spikes | Egress costs increase | Implement CDN/caching |
| Premium features needed | Supabase costs | Stay on Pro plan |
| More customers sooner | Infrastructure cost rise | But revenue rises faster |

---

## Decision Checklist for Pilot

- [ ] Confirm 35 technicians × $9.99/month with cousin
- [ ] Get written agreement for 3-month pilot period
- [ ] Set expectation: will move to $19.99/month after pilot
- [ ] Establish weekly feedback cadence
- [ ] Document feature requests & bugs
- [ ] Collect testimonial/reference permission
- [ ] Set up analytics to track usage (optional)
- [ ] Create photo compression plan (see optimization section)

---

## Next Steps

1. **This Week:**
   - [ ] Review this document with cousin
   - [ ] Get agreement on $9.99/month for 3 months
   - [ ] Set expectations on feature completeness

2. **Before Launch:**
   - [ ] Implement photo compression (reduce from 5MB to 1-2MB)
   - [ ] Add critical missing features:
     - Issue category buttons
     - Chemical added fields
     - Photo validation
   - [ ] Test with 2-3 technicians from her team

3. **Post-Launch (Months 1-3):**
   - [ ] Weekly check-ins with cousin
   - [ ] Track all bugs & feature requests
   - [ ] Monitor infrastructure costs
   - [ ] Gather testimonial material
   - [ ] Document lessons learned

4. **After Pilot (Month 4+):**
   - [ ] Transition to $19.99/month (with advance notice)
   - [ ] Use case study to acquire customer #2
   - [ ] Refine pricing based on feedback

---

## Financial Dashboard (Monthly)

| Metric | Value |
|--------|-------|
| **Monthly Revenue (Pilot)** | $349.65 |
| **Monthly Infrastructure Cost** | $56-66 |
| **Monthly Profit** | $283-294 |
| **Profit Margin** | 81% |
| **Customers** | 1 |
| **Total Technicians** | 35 |
| **Total Pools Managed** | 900 |
| **Photos per Month** | 3,600-7,200 |
| **Storage Used** | 18-36 GB |
| **Cost per Pool/Month** | $0.063-0.073 |
| **Cost per Technician/Month** | $1.61-1.89 |

---

## Conclusion

✅ **$9.99/technician works for a pilot because:**
1. It covers all infrastructure costs (56-66/month)
2. Leaves $280+ profit buffer for your support time
3. Is low enough to be a no-brainer for your cousin
4. Is time-bound (3 months), creating urgency
5. Provides real-world validation of the business model
6. Generates case study material for future customers

⚠️ **It does NOT work long-term because:**
1. Doesn't cover your salary or team
2. Doesn't fund marketing/customer acquisition
3. Doesn't allocate for development time
4. No buffer for taxes or operating expenses

🎯 **Recommendation:** Use pilot phase to validate, then move to $19.99-29.99/month for all customers (still 1/3-1/5 of market rate).

---

**Questions?** Keep this document handy for reference as you scale CAICOS.

*Last updated: 2026-02-28*
