# Cadenza — Business Context

**Purpose:** Single briefing for business questions, ideas, strategy, and product decisions.  
**Audience:** Founders, stakeholders, and AI agents brainstorming before diving into technical specs.  
**Last updated:** June 2026

> **How to use:** Read this file first for business context. Follow links to deeper docs only when you need detail on a specific topic.

---

## 1. What Cadenza Is

**Cadenza** is a multi-tenant SaaS platform for pool service companies. It replaces fragmented WhatsApp + Excel workflows with a coordinated system:

| Surface | Who uses it | Core job |
|---------|-------------|----------|
| **Technician mobile app** | Field technicians | Complete daily route, capture proof-of-service photos, flag issues |
| **Admin web portal** | Owners, ops managers (e.g. Luisa) | Monitor completion, verify weekly payroll, manage routes/properties/team |

**Tagline:** "Service Management, Synchronized"  
**Brand essence:** Modern, reliable, efficient, professional

**Builder:** AGA Social — pilot customer is the founder's cousin's pool service business in Florida.

---

## 2. Ideal Customer Profile (ICP)

Pool service companies that:

- Run **recurring weekly routes** (same technician, same pools, predictable schedule)
- Have **10–50+ technicians** each servicing 15–25 pools/day
- Currently rely on **WhatsApp photos + manual Excel** for completion proof and payroll
- Need **ops visibility** without asking technicians to adopt complex software
- Pay technicians based on **verified completion**, not honor system

**Not the ICP (Phase 2+):** One-off residential pool cleaning, route optimization at scale, customer self-service portals, QuickBooks-heavy billing integrations.

---

## 3. Pilot Customer Snapshot

| Metric | Value |
|--------|-------|
| Location | Florida |
| Routes | 35 |
| Total pools | ~900 |
| Technicians | ~35 (≈1 per route) |
| Service frequency | Weekly per pool |
| Photos per visit | 1–2 |
| Pools per tech per day | 18–22 |
| Pools per tech per week | 60–86 |

**Named roles from discovery:**
- **Gabriella** — business owner perspective, product feedback
- **Luisa** — operations/admin; runs Friday payroll verification (~2 hrs/week in Excel)
- **Nicolás, Luis** — example technicians; heavy WhatsApp photo workflow

---

## 4. How the Business Works Today (As-Is)

```
Technician takes pool photos in WhatsApp group
        ↓
Messages include pool/house #, photos, optional issue notes
        ↓
Gabriella/Luisa collect photos through the week
        ↓
Every FRIDAY: Luisa downloads timestamps → Excel
        ↓
Verifies EVERY assigned pool was serviced (photo proof required)
        ↓
Approves payroll → pays technicians (e.g. Nicolás ~$2,200/week)
```

### Current pain points

- Manual timestamp extraction and Excel work (~2 hours/week)
- Wrong pool numbers in messages cause reconciliation errors
- No single source of truth across WhatsApp groups
- **92.5%** of messages include issues requiring follow-up — but no structured queue
- Extra/bonus work ("extras") tracked ad hoc, not in a system
- Technicians are **not willing to change habits easily** — "no a los piscineros no se les puede pedir mucho"

### Non-negotiable business rules

1. **Photo proof with timestamp** is the legal/commercial basis for paying technicians
2. **Friday weekly verification** gates payroll — not daily auto-approval
3. **All assigned pools** for the week must be accounted for before payment
4. **Issue escalation** is core ops work, not an afterthought

---

## 5. How the Product Is Designed to Work (To-Be)

```
One-time: Admin sets up routes → assigns pools → assigns technician
        ↓
Daily: Technician opens app → sees same route/house list
        ↓
Per pool: Photo (GPS + timestamp) + issue category + optional comment → MARK COMPLETE
        ↓
Daily: Admin dashboard shows completion % and flagged issues
        ↓
Weekly (Friday): Admin runs Weekly Completion Report per technician
        ↓
Verify X of Y pools → Approve for Payroll → Export PDF
```

### Simplified technician workflow (intentional)

The product was **simplified** to mirror WhatsApp behavior:

- House-number list (not time-based schedule)
- Photo + category + comment (chemical readings optional, not required)
- Same route every day — progress shown as "X of 22 completed"

See [IMPLEMENTATION-ROADMAP.md](./IMPLEMENTATION-ROADMAP.md) for screen flows.

---

## 6. Business Model & Unit Economics

### Pricing (planned)

| Tier | Price | Notes |
|------|-------|-------|
| Free Trial | $0 | 90-day pilot for cousin's company |
| Growth | **$9.99 / technician / month** | Primary pilot pricing |
| Premium | $19.99 / technician / month | Higher limits / features |

**Billing metric:** Per technician (scales with fleet size, not per pool).

### Pilot economics (35 technicians @ $9.99)

| | Conservative | Realistic |
|--|-------------|-----------|
| Monthly revenue | $349.65 | $349.65 |
| Infrastructure cost | ~$56.50 | ~$66 |
| Monthly profit | ~$293 | ~$284 |
| Margin | ~84% | ~81% |

**Cost drivers:** Photo storage volume (1–2 photos/pool/week → 18–36 GB/month at ~5 MB/photo).  
See [COST-ANALYSIS-PILOT.md](../cost/COST-ANALYSIS-PILOT.md), [COST-SCALING-PHOTOS.md](../cost/COST-SCALING-PHOTOS.md).

### Photo retention (open business choice)

Long-term storage cost depends on retention policy:

- **Option A:** Compress older photos + tiered storage (complex, lower ongoing cost)
- **Option B:** Auto-delete after N months (simpler, may conflict with payroll audit needs)

See [PHOTO-RETENTION-STRATEGY.md](../cost/PHOTO-RETENTION-STRATEGY.md).

---

## 7. MVP Scope — Business View

### In scope (what the pilot needs to succeed)

| Capability | Why it matters |
|------------|----------------|
| Route-based daily job list | Matches how techs already think (my houses today) |
| Photo + GPS + timestamp | Replaces WhatsApp proof for payroll |
| Issue categories | 92%+ of visits have issues — must be structured |
| Weekly completion report + payroll approval | Core Friday workflow for Luisa |
| Routes / properties / team management | One-time setup + maintenance |
| Multi-tenant isolation | SaaS-ready for more customers later |

### Explicitly out of scope (Phase 2 backlog)

- Customer-facing portal
- Route optimization / Google Maps routing
- WhatsApp bot integration (blocked politically — can't add bot to groups)
- Gmail auto-parsing of service requests
- Advanced analytics / chemical trend dashboards
- QuickBooks / deep accounting integrations

---

## 8. Decisions Already Made

| Decision | Rationale |
|----------|-----------|
| **Per-tech pricing** ($9.99) | Aligns with how companies think about headcount |
| **Route model** (not ad-hoc daily jobs) | Matches real ops: same tech, same pools daily |
| **Simplified service form** | Technicians won't tolerate complexity; photo + category is minimum viable |
| **Friday payroll report** in admin spec | Direct response to Luisa's workflow |
| **Chemical readings optional** | Not every visit needs full chemistry panel |
| **Pilot = cousin's business** | Real data, real feedback, revenue from day 1 |
| **Florida / US market first** | Pilot customer context; Spanish default in admin app for this customer |

---

## 9. Open Questions (Good for Brainstorming)

| # | Question | Trade-offs |
|---|----------|------------|
| 1 | **App vs. WhatsApp** — Does the app *replace* WhatsApp or *supplement* it? | Adoption risk vs. automation gain |
| 2 | **WhatsApp integration** — Build direct ingestion despite group-bot block? | Technicians send to bot privately; ops complexity |
| 3 | **Photo retention period** — How long must photos be kept for payroll disputes? | Storage cost vs. audit trail |
| 4 | **Extra services billing** — Track separately for tech bonuses? | Payroll accuracy vs. form complexity |
| 5 | **Issue queue ownership** — Who resolves flagged issues (owner vs. ops vs. tech)? | Workflow design, notifications |
| 6 | **Premium tier value** — What justifies $19.99 vs $9.99? | Feature gating, limits, support |
| 7 | **Second customer** — When to onboard beyond pilot? | Support burden vs. product validation |
| 8 | **Per-pool pricing alternative** — Some competitors charge per stop? | May fit larger fleets differently |

---

## 10. Critical Gaps (Business ↔ Product)

These were identified in customer discovery and **partially** addressed in spec updates:

| Gap | Status |
|-----|--------|
| Weekly payroll verification | ✅ Added to admin spec (`/reports/weekly-completion`) |
| Route-based technician view | ✅ Added to mobile spec |
| Issue categories | ✅ Added to mobile spec |
| GPS + timestamp on photos | ✅ Documented as required |
| Extra services tracking | ⚠️ Identified, not fully specced |
| Service issue queue (admin) | ⚠️ Identified, not fully built |
| WhatsApp data ingestion | ❌ Deferred / blocked |
| Pool service history / compliance | ⚠️ Identified, partial |

Full gap analysis: [BUSINESS-LOGIC-ANALYSIS.md](./BUSINESS-LOGIC-ANALYSIS.md)  
Spec changelog: [SPEC-UPDATES-SUMMARY.md](./SPEC-UPDATES-SUMMARY.md)

---

## 11. Success Metrics (Business)

| Metric | Target |
|--------|--------|
| Technician adoption | 90%+ of assigned pools completed via app |
| Time to complete one stop | < 5 minutes (photo + category + submit) |
| Luisa's Friday workflow | Replaces manual Excel (goal: < 30 min) |
| Payroll dispute rate | Near zero — every paid pool has timestamped photo |
| Pilot retention | Cousin renews after free trial |
| Unit economics | Stay > 70% gross margin as photo volume grows |

Technical success metrics (uptime, RLS): [SOLUTION.md](../architecture/SOLUTION.md) §7.

---

## 12. Brand & Positioning (Summary)

- **Name:** Cadenza
- **Mission:** Empower pool service companies to coordinate technicians, manage operations, and deliver exceptional service through intelligent scheduling and real-time visibility
- **Visual identity:** Deep Teal `#0D7C8F`, Bright Cyan `#00D9FF`, Midnight Blue `#1A3A52`
- **Tone:** Professional, clear, ops-focused — not consumer/playful

Full guide: [BRAND-IDENTITY.md](../branding/BRAND-IDENTITY.md)

---

## 13. Example Business Questions This Doc Supports

Ask things like:

- *"What's the minimum feature set for the pilot to pay for itself?"*
- *"Should we charge per pool instead of per technician?"*
- *"How do we reduce Luisa's Friday workload?"*
- *"What happens if technicians refuse the app?"*
- *"Is $9.99 sustainable if they take 3 photos per pool?"*
- *"What should Premium tier include?"*
- *"What's our competitive story vs. staying on WhatsApp?"*

For each question, cross-check **§4 (as-is)**, **§5 (to-be)**, **§6 (economics)**, and **§9 (open questions)** before proposing ideas.

---

## 14. Deep-Dive References

| Topic | Document |
|-------|----------|
| Real workflow & gaps | [BUSINESS-LOGIC-ANALYSIS.md](./BUSINESS-LOGIC-ANALYSIS.md) |
| Target workflow & screens | [IMPLEMENTATION-ROADMAP.md](./IMPLEMENTATION-ROADMAP.md) |
| Spec changes from discovery | [SPEC-UPDATES-SUMMARY.md](./SPEC-UPDATES-SUMMARY.md) |
| Architecture & MVP scope | [SOLUTION.md](../architecture/SOLUTION.md) |
| Pilot P&L | [COST-ANALYSIS-PILOT.md](../cost/COST-ANALYSIS-PILOT.md) |
| Photo cost scaling | [COST-SCALING-PHOTOS.md](../cost/COST-SCALING-PHOTOS.md) |
| Photo retention options | [PHOTO-RETENTION-STRATEGY.md](../cost/PHOTO-RETENTION-STRATEGY.md) |
| Billing launch plan | [NEXT-ACTIONS-BILLING-LAUNCH.md](../cost/NEXT-ACTIONS-BILLING-LAUNCH.md) |
| Admin feature spec | [FEATURE-ADMIN-PORTAL.md](../specs/FEATURE-ADMIN-PORTAL.md) |
| Mobile feature spec | [FEATURE-TECHNICIAN-APP.md](../specs/FEATURE-TECHNICIAN-APP.md) |
| Brand guide | [BRAND-IDENTITY.md](../branding/BRAND-IDENTITY.md) |
| Full doc index | [README.md](../README.md) |

---

## 15. For AI Agents

**Business brainstorming or strategy requests:**
1. Read this file (`docs/business/BUSINESS-CONTEXT.md`)
2. Ground ideas in **pilot customer reality** (§3–§4), not generic SaaS patterns
3. Check **§8 decisions** — don't re-litigate settled choices unless user asks
4. Flag ideas that touch **§9 open questions** explicitly
5. Only dive into technical specs if the user wants implementation detail

**Implementation / coding requests:** Use [AGENTS.md](../../AGENTS.md) instead.
