# Cousin Pilot — 6-Month Free Plan Economics

**Updated:** 2026-06-15
**Author:** AGA Social (byagasocial@gmail.com)
**Scenario:** Give cousin a **6-month free plan**, **30 technicians from day one**, **3 photos/job average.**
**Pricing model going forward:** **$14.99 per technician/month**, with **up to 10 admin users free** (admins don't count toward billing).

---

## Pricing model (confirmed)

| Item | Charge |
|------|--------|
| Per technician | **$14.99/month** |
| Admin users (up to 10) | **$0 — free** |
| Cousin, months 1–6 | **$0 (free plan)** |
| Cousin, month 7+ (30 techs) | **30 × $14.99 = $449.70/month** |

---

## Verified pricing (June 2026)

| Provider | Base | Included | Overage |
|----------|------|----------|---------|
| **Supabase Pro** | $25/mo | 100 GB file storage, 250 GB egress, 8 GB database disk | File storage **$0.0213/GB**, egress **$0.09/GB** (cached $0.03), DB disk $0.125/GB |
| **Vercel Pro** | $20/mo | **1 TB** data transfer | $0.15/GB over 1 TB |
| **Expo** | $0 | — | — |

**Photos live in Supabase Storage (`report-photos`), served via signed URLs — they bypass Vercel entirely.** So photo traffic only ever touches Supabase's 250 GB egress allowance, never Vercel's 1 TB.

---

## Workload assumptions

- **30 technicians**, each ~**30 pools/month** → **900 pools/month total**
- **3 photos per job** → **2,700 photos/month**
- Photo size after `quality: 0.4` compression ≈ **1.5 MB** (range 1–2 MB)
- ≈ **4.0 GB of new photos per month**
- Note: the **90-day auto-delete is not built yet**, so the table below assumes photos **accumulate** for all 6 months (worst case). With deletion live, storage plateaus even lower.

---

## Storage growth over 6 months (no deletion, worst case)

2,700 photos/month × 1.5 MB ≈ **4.0 GB added per month.**

| Month | Photos to date | Cumulative storage | vs 100 GB free | Storage overage |
|-------|----------------|--------------------|----------------|-----------------|
| 1 | 2,700 | 4.0 GB | 4% | $0 |
| 2 | 5,400 | 7.9 GB | 8% | $0 |
| 3 | 8,100 | 11.9 GB | 12% | $0 |
| 4 | 10,800 | 15.8 GB | 16% | $0 |
| 5 | 13,500 | 19.8 GB | 20% | $0 |
| 6 | 16,200 | 23.7 GB | 24% | $0 |

**After 6 full months you've used under a quarter of the free storage allowance. Storage overage = $0 the entire time.**

---

## Egress over 6 months

Egress = photo **views/downloads** (uploads are free). Assuming each photo is viewed ~2× (technician confirms + admin reviews), monthly egress runs roughly **8–12 GB/month**, climbing slightly as the library grows.

| Month | Est. monthly egress | vs 250 GB free | Egress overage |
|-------|---------------------|----------------|----------------|
| 1 | ~8 GB | 3% | $0 |
| 3 | ~10 GB | 4% | $0 |
| 6 | ~12–15 GB | ~5–6% | $0 |

**Egress never gets close to the 250 GB allowance. Egress overage = $0.**

Vercel-side traffic (the admin portal app itself) is a few GB/month — nowhere near the 1 TB cap, so **Vercel overage = $0** too.

---

## What it costs YOU during the 6 free months

Both Supabase and Vercel stay entirely within their base plans — no overages at this volume.

| Cost | Monthly | 6-month total |
|------|---------|---------------|
| Supabase Pro | $25 | $150 |
| Vercel Pro | $20 | $120 |
| **Total infrastructure** | **$45** | **$270** |
| Revenue from cousin (free) | $0 | $0 |
| **Net cost of the free pilot** | **–$45** | **–$270** |

**Important nuance:** that $45/month is your platform's **fixed base cost** — you pay it whether or not cousin is on it. Cousin's 30 techs add **~$0 in incremental overage**, so the free trial costs you almost nothing beyond what you're already spending to keep CADENZA running.

---

## What happens at month 7 (cousin converts to paid)

| | Amount |
|--|--------|
| Cousin's technicians | 30 |
| Price/tech | $14.99 |
| Admin users | free |
| **Monthly revenue** | **$449.70** |
| Your infrastructure cost | ~$45 |
| **Monthly profit** | **~$405 (≈90% margin)** |

---

## Summary

1. **The 6-month free gift to cousin costs you ~$270 total** — really just your existing base-plan spend, since 30 techs at this volume add no measurable overage.
2. **Storage after 6 months: ~24 GB** (under a quarter of free) — even with no auto-delete built.
3. **Egress stays around 10–15 GB/month** — a few percent of the free 250 GB. Vercel egress is effectively $0 because photos bypass it.
4. **No overage charges on either provider for the entire 6 months.**
5. **At month 7, 30 techs at $14.99 = $449.70/month**, ~90% margin against ~$45 infra cost.

---

*Pricing verified June 2026 (Supabase Pro, Vercel Pro). Build the 90-day photo-cleanup job before onboarding several more customers to keep storage and egress flat long-term.*
