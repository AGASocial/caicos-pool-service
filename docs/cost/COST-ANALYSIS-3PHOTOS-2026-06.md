# CADENZA — Economics with 3 Photos per Job (Updated)

**Updated:** 2026-06-15
**Author:** AGA Social (byagasocial@gmail.com)
**Purpose:** Recompute unit economics for a 3-photo-per-job workflow using *current* (June 2026) Supabase/Vercel pricing and the compression actually shipped in the technician app.
**Supersedes the cost assumptions in** `COST-ANALYSIS-PILOT.md` **and** `COST-SCALING-PHOTOS.md` **(those used outdated Supabase allowances).**

---

## What the code actually does (verified)

| Item | Finding | Source |
|------|---------|--------|
| **Compression** | `quality: 0.4` on capture (camera + library). Compresses a ~5 MB phone photo to roughly **1–2 MB**. | `technician-app/app/(app)/job/[id].tsx` (lines 534, 553); `cant-service.tsx` |
| **Where photos are stored** | Supabase **Storage**, bucket **`report-photos`**. Uploaded as `image/jpeg`; served via **signed URLs**. Metadata in table `cadenza_report_photos`. | `job/[id].tsx` upload/`getSignedUrls`; migration `20260226000000_report_photos_bucket.sql` |
| **90-day retention / auto-delete** | **Designed but NOT deployed.** No `cleanup_expired_photos` function or `pg_cron` job exists in the migrations. Photos currently accumulate indefinitely. | grep of `supabase/migrations` — only compression + delete *policies* exist, no scheduled cleanup |
| **"Slow load when 3 months old"** | This was **Option 1** (move old photos to Google Drive / cold storage → slower load). It was **NOT chosen.** The decision was **Option 2**: compress on day 1 + simply auto-delete after 90 days. So there is no cold-storage/slow-load tier in the plan. | `docs/cost/PHOTO-RETENTION-STRATEGY.md` — "Recommendation: OPTION 2" |

**Bottom line on retention:** compression is live; the 90-day delete still needs to be built. Good news — with current Supabase allowances, costs stay tiny even if you never build it (see below).

---

## Current pricing (verified June 2026)

| Provider | Base | Included | Overage |
|----------|------|----------|---------|
| **Supabase Pro** | $25/mo | **100 GB** file storage, **250 GB** egress | File storage **$0.021/GB**, egress **$0.09/GB** uncached (**$0.03** cached) |
| **Vercel Pro** | $20/mo | 1 TB bandwidth, 1,000 GB-hr functions | Bandwidth $0.15/GB (absorbed by $20 credit first) |
| **Expo** | $0 | — | — |

> The old docs assumed Supabase included only **8 GB** storage and charged **$0.25/GB** overage. The real numbers are **100 GB included** and **$0.021/GB** — about **12× cheaper** per GB and a far larger free allowance. This is why every cost figure below is lower than the originals.

---

## Assumptions for this model

- Pilot customer: **35 technicians, 900 pools, weekly service**
- Jobs/month = 900 pools × 4.33 weeks ≈ **3,900 jobs/month**
- **3 photos per job** → **11,700 photos/month** per customer
- Photo size after `quality: 0.4`: central estimate **1.5 MB** (range 1–2 MB)
- New storage added/month/customer ≈ **17 GB** (at 1.5 MB)
- With **90-day retention**, steady-state storage ≈ 3 months = **~51 GB/customer**

---

## Pilot economics (1 customer, 3 photos/job) — photo-size sensitivity

With 90-day retention, steady-state storage stays **under the 100 GB free allowance at every photo size**, so Supabase has **no overage**.

| Photo size | New GB/mo | Steady storage (90d) | Storage overage | Supabase | Vercel | **Total cost** | Revenue (35×$9.99) | **Profit** | Margin |
|-----------|-----------|----------------------|-----------------|----------|--------|---------------|--------------------|-----------|--------|
| 1.0 MB | 11.4 | 34 GB | $0 | $25 | $20 | **$45** | $349.65 | **$304.65** | 87% |
| 1.5 MB | 17.1 | 51 GB | $0 | $25 | $20 | **$45** | $349.65 | **$304.65** | 87% |
| 2.0 MB | 22.9 | 69 GB | $0 | $25 | $20 | **$45** | $349.65 | **$304.65** | 87% |

**Even at 2 MB photos and 3 per job, the pilot costs ~$45/month and clears ~$305 profit (87% margin).**

### What if you never build the 90-day delete? (storage accumulates)

At 1.5 MB / 17 GB per month, a single pilot customer:

| Month | Cumulative storage | Over 100 GB? | Storage overage | Total cost |
|-------|--------------------|--------------|-----------------|------------|
| 3 | 51 GB | no | $0 | $45 |
| 6 | 103 GB | +3 GB | $0.06 | ~$45 |
| 12 | 206 GB | +106 GB | $2.22 | ~$47 |

So even with **zero cleanup**, year-one pilot storage cost stays under ~$2.50/month. Retention matters for multi-customer scale and tidiness, not survival.

---

## Scaling (3 photos/job, 1.5 MB, 90-day retention)

Each customer ≈ 35 techs / 900 pools / 51 GB steady storage.

| Customers | Techs | Photos/mo | Steady storage | Storage overage | Egress (est.) | Supabase | Vercel | **Total cost** | Revenue | **Profit** | Margin |
|-----------|-------|-----------|----------------|-----------------|---------------|----------|--------|---------------|---------|-----------|--------|
| 1 | 35 | 11.7k | 51 GB | $0 | $0 | $25 | $20 | **$45** | $349.65 | **$305** | 87% |
| 2 | 70 | 23.4k | 103 GB | $0.06 | $0 | $25 | $20 | **$45** | $699.30 | **$654** | 94% |
| 3 | 105 | 35.1k | 154 GB | $1.14 | $0 | $26 | $20 | **$46** | $1,048.95 | **$1,003** | 96% |
| 5 | 175 | 58.5k | 257 GB | $3.30 | ~$1 | $29 | $20 | **$49** | $1,748.25 | **$1,699** | 97% |
| 10 | 350 | 117k | 514 GB | $8.69 | ~$10–24 | $44–58 | $20 | **$64–78** | $3,496.50 | **~$3,420** | 98% |
| 20 | 700 | 234k | 1,028 GB | $19.49 | ~$25–70 | $69–115 | $20 | **$90–135** | $6,993 | **~$6,870** | 98% |

**Notes on the table:**
- **Storage** is a hard number (100 GB free, then $0.021/GB) — reliable.
- **Egress** is the only real variable. It depends on how often photos are viewed. Supabase includes **250 GB/month** free, so it's **$0 through ~5 customers**. Past ~10 customers it becomes the main driver; Supabase's CDN caches signed URLs at the cheaper **$0.03/GB** rate, which keeps it toward the low end of the ranges above.

---

## Summary

1. **Charging $9.99/tech with 3 photos/job is very comfortable.** Pilot infra ≈ **$45/month** vs **$349.65 revenue → ~87% margin.** Photo size barely matters at this scale.
2. **The 5 MB → 1–2 MB compression (quality 0.4) is already shipped.** That's what keeps storage small.
3. **The 90-day auto-delete is not built yet** — but with today's Supabase allowances you don't need it to stay cheap at pilot scale. Build it before you pass ~3–5 customers to keep storage and egress flat.
4. **There is no "slow-load for old photos" mechanism**, and the plan never called for one — that was the rejected Option 1. Old photos are simply deleted (once the cleanup job exists), not moved to slow storage.
5. **At $19.99/tech (post-pilot rate), margins exceed 90%+ across all scales.** Infrastructure is a rounding error against revenue; your real "cost" is your time, not servers.

---

*Pricing verified June 2026. Re-check Supabase/Vercel rates before quoting to investors.*
