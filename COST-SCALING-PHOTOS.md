# CAICOS Cost Scaling - Photo Volume Analysis

**Purpose:** Show how infrastructure costs increase as photo volume scales
**Scenario:** Starting with pilot customer (35 routes, 900 pools)
**Photo Average:** 5MB per photo

---

## 📸 Cost Scaling by Photo Volume

### Scenario A: Pilot Customer Growing (More Photos, Same Customer)

**Assumption:** 35 technicians remain, but frequency increases

| Photo Frequency | Photos/Month | Storage/Month | Supabase Cost | Vercel | Total Cost | Revenue (35 techs @ $9.99) | Profit | Margin |
|-----------------|------------|---------------|---------------|--------|-----------|------------------------|--------|--------|
| **1x/week** (current) | 3,600 | 18 GB | $35.50 | $21 | **$56.50** | $349.65 | $293.15 | 83.8% |
| **2x/week** | 7,200 | 36 GB | $45 | $21 | **$66** | $349.65 | $283.65 | 81% |
| **Daily** | 25,200 | 126 GB | $75.50 | $21 | **$96.50** | $349.65 | $253.15 | 72.4% |
| **2x daily** | 50,400 | 252 GB | $155.50 | $25 | **$180.50** | $349.65 | $169.15 | 48.4% |

**Key Insight:** Even at 2x daily service, costs only reach $180/month (margin still 48%)

---

### Scenario B: Multiple Customers (More Routes = More Photos)

**Assumption:** Each customer like your cousin (35 techs, 900 pools, 1 photo/week)

| Customers | Routes | Pools | Photos/Month | Storage | Supabase | Vercel | Total Cost | Revenue | Profit |
|-----------|--------|-------|-------------|---------|----------|--------|-----------|---------|--------|
| **1** | 35 | 900 | 3,600 | 18 GB | $35.50 | $21 | **$56.50** | $349.65 | $293.15 |
| **2** | 70 | 1,800 | 7,200 | 36 GB | $45 | $21 | **$66** | $699.30 | $633.30 |
| **3** | 105 | 2,700 | 10,800 | 54 GB | $59.50 | $21 | **$80.50** | $1,048.95 | $968.45 |
| **5** | 175 | 4,500 | 18,000 | 90 GB | $97.50 | $21 | **$118.50** | $1,748.25 | $1,629.75 |
| **10** | 350 | 9,000 | 36,000 | 180 GB | $170 | $25 | **$195** | $3,496.50 | $3,301.50 |
| **20** | 700 | 18,000 | 72,000 | 360 GB | $313.50 | $30 | **$343.50** | $6,993 | $6,649.50 |
| **50** | 1,750 | 45,000 | 180,000 | 900 GB | $700 | $50 | **$750** | $17,482.50 | $16,732.50 |

---

## 💰 Cost Breakdown by Scale

### Cost per Technician (Monthly)

| Customers | Total Techs | Cost/Tech | Trend |
|-----------|-----------|-----------|-------|
| 1 | 35 | $1.61 | High |
| 2 | 70 | $0.94 | ✅ 42% decrease |
| 5 | 175 | $0.68 | ✅ 58% decrease |
| 10 | 350 | $0.56 | ✅ 65% decrease |
| 20 | 700 | $0.49 | ✅ 70% decrease |
| 50 | 1,750 | $0.43 | ✅ 73% decrease |

**SaaS Magic:** Cost per unit drops dramatically as you scale 🚀

---

## 📊 Photo Storage Costs Detail

### Just Storage Costs (Supabase Storage Overages)

| Photos/Month | Storage | Cost Breakdown | Total Storage Cost |
|------------|---------|------------------|------------------|
| 3,600 | 18 GB | $25 base + $2.50 overage | **$27.50** |
| 7,200 | 36 GB | $25 base + $7 overage | **$32** |
| 10,800 | 54 GB | $25 base + $11.50 overage | **$36.50** |
| 18,000 | 90 GB | $25 base + $20.50 overage | **$45.50** |
| 36,000 | 180 GB | $25 base + $43 overage | **$68** |
| 72,000 | 360 GB | $25 base + $88 overage | **$113** |
| 180,000 | 900 GB | $25 base + $222.50 overage | **$247.50** |

---

## ⚠️ Cost Limits & Thresholds

### When Does Cost Become a Problem?

| Situation | Monthly Cost | Status | Recommendation |
|-----------|------------|--------|-----------------|
| **1 customer (pilot)** | $56.50 | ✅ Healthy | Keep going |
| **3-5 customers** | $80-120 | ✅ Healthy | Good growth |
| **10 customers** | $195 | ✅ Healthy | Revenue covers 18x cost |
| **20+ customers** | $343+ | ⚠️ Watch | Consider optimization |
| **50+ customers** | $750 | 🔴 Time to optimize | Migrate to cheaper storage |

---

## 🚀 Optimization Opportunities at Different Scales

### At 1 Customer (Current Pilot)
- **Status:** No optimization needed yet
- **Potential savings:** 0% (stay on Supabase)
- **Reason:** Migration costs exceed savings

### At 5 Customers ($118.50/month)
- **Status:** Still healthy but start planning
- **Optimization option:** Compress photos to 1-2MB
- **Potential savings:** $20-30/month (25% reduction)
- **New cost:** $88-98/month

### At 20 Customers ($343.50/month)
- **Status:** Time to optimize
- **Optimization option:** Migrate to Neon + Backblaze B2
- **Potential savings:** $150-180/month (44% reduction)
- **New cost:** $163-193/month
- **ROI:** Migration cost recovered in 2 months

### At 50+ Customers ($750+/month)
- **Status:** Definitely optimize
- **Optimization options:**
  - Cloudflare R2 for storage (zero egress)
  - Neon for database
  - Archive old photos to cold storage
- **Potential savings:** $300-400/month (40-50%)
- **New cost:** $350-450/month

---

## 📈 Profitability at Different Scales

### Profit Margin by Customer Count

| Customers | Monthly Revenue | Monthly Cost | Profit | Margin |
|-----------|-----------------|------------|--------|--------|
| 1 | $349.65 | $56.50 | $293.15 | **83.8%** |
| 5 | $1,748.25 | $118.50 | $1,629.75 | **93.2%** |
| 10 | $3,496.50 | $195 | $3,301.50 | **94.4%** |
| 20 | $6,993 | $343.50 | $6,649.50 | **95.1%** |
| 50 | $17,482.50 | $750 | $16,732.50 | **95.7%** |

**Key:** Margins improve as you scale! Infrastructure becomes tiny relative to revenue.

---

## 🎯 When to Take Action

### Green Light (Keep Current Setup)
- ✅ 1-5 customers
- ✅ Cost < $120/month
- ✅ Revenue > $350/month
- ✅ No optimization needed

### Yellow Light (Plan for Optimization)
- 🟡 6-15 customers
- 🟡 Cost $120-250/month
- 🟡 Revenue $700-1,500/month
- 🟡 Start research on migrations

### Red Light (Must Optimize)
- 🔴 20+ customers
- 🔴 Cost > $250/month
- 🔴 Revenue > $2,000/month
- 🔴 Migrate to cheaper alternatives (Neon + Backblaze)

---

## 💡 Photo Compression Impact

### If You Reduce Photos from 5MB → 1-2MB

| Scenario | Current | Compressed | Savings |
|----------|---------|-----------|---------|
| 1 customer (3,600 photos) | 18 GB | 3.6-7.2 GB | 60-80% |
| 5 customers (18,000 photos) | 90 GB | 18-36 GB | 60-80% |
| 10 customers (36,000 photos) | 180 GB | 36-72 GB | 60-80% |

**Example:** At 5 customers, compressing photos saves $25-35/month!

---

## 🔄 The Cost vs Revenue Curve

```
Revenue (blue) vs Cost (red) - As you scale

$20K  |                                    ✓ Revenue
      |                          ✓
      |                      ✓
$15K  |                  ✓
      |              ✓
      |          ✓
$10K  |      ✓
      |  ✓
      |✓─────────────────────── Cost
$5K   |...
      |
$0    |___________________________
       1  5  10  20  30  40  50
           Number of Customers
```

**Observation:** Gap widens exponentially (exponential profit growth)

---

## ✅ Decision Matrix

### "Should I optimize now?"

| Question | Answer | Action |
|----------|--------|--------|
| Do I have 1 customer? | Yes | **No optimization** |
| Do I have 5+ customers? | Yes | **Consider compression** |
| Do I have 20+ customers? | Yes | **Must migrate to Neon + Backblaze** |
| Is my margin < 80%? | Yes | **Optimize immediately** |
| Am I losing money? | Yes | **Emergency migration needed** |

---

## 🎁 Bonus: Cost Calculator

**Quick mental math:**
- **1 customer = ~$57/month**
- **Add $10/month per new customer** (rough approximation at this scale)
- **Revenue = $350/customer at $9.99/tech**

**Example:**
- 5 customers = ~$57 + (4 × $10) = $97/month
- Revenue = $350 × 5 = $1,750/month
- Margin = 95%+ 🚀

---

**Bottom Line:** Your cost structure is incredibly healthy. You can grow to 20+ customers before needing to optimize. Focus on sales, not costs right now!

*Last updated: 2026-02-28*
