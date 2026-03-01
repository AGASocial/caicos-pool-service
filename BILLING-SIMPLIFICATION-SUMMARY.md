# Billing Plans Simplification - What Changed

**Date:** 2026-03-01
**Change:** Removed separate admin/technician user limits, now using total user pool
**Impact:** Simpler to understand, easier to enforce, more flexible for customers

---

## The Simplification

### Before (Separated Limits)
```
Free Trial:
  - Max 5 admin users
  - Max 3 technician users
  - Total: 8 users max

Growth:
  - Max 100 technician users
  - Max 50 admin users (implied)
  - Total: 150 users max
```

**Problem:** Confusing for users (which roles count against the limit?), harder to enforce, creates edge cases.

---

### After (Unified Limit)
```
Free Trial:
  - Max 10 total users (any mix: admin, tech, manager, etc.)
  - They decide the breakdown

Growth:
  - Max 150 total users (any mix)

Premium:
  - Unlimited
```

**Benefits:**
- ✅ Simpler to explain: "Max 10 people during trial"
- ✅ Easier to code: Just count all users vs. max_total_users
- ✅ More flexible: Customer decides admin/tech split
- ✅ Less confusing: One number to understand

---

## Database Changes

### Table: caicos_plan_features
**Removed:**
```sql
max_technicians INTEGER NOT NULL
```

**Kept:**
```sql
max_total_users INTEGER NOT NULL  -- Now the single limit
```

### Function: check_technician_limit()

**Name stays the same** (for backward compatibility) but now:
- Counts ALL users (not just technicians)
- Compares against max_total_users
- Returns can_add_user instead of can_add_technician

**Before:**
```sql
SELECT COUNT(t.id) -- Only technicians
WHERE t.role = 'technician'
COMPARE AGAINST pf.max_technicians
```

**After:**
```sql
SELECT COUNT(u.id) -- All users
WHERE c.id = p_company_id
COMPARE AGAINST pf.max_total_users
```

---

## Practical Impact

### For Your Cousin's Pilot

**Free Trial (90 days):**
- Can add up to 10 people total
- Could be: 8 technicians + 2 office managers
- Or: 9 technicians + 1 owner
- Or: 10 technicians + 0 admins
- Total flexibility ✅

**After Trial (Growth Plan):**
- Can add up to 150 people total
- Same flexibility on the breakdown

---

## Code Changes Required

### In Implementation Guide

**Old function name:**
```typescript
checkCanAddTechnician() → checks max_technicians
```

**New function name:**
```typescript
checkCanAddUser() → checks max_total_users
```

**Note:** The RPC function name stays `check_technician_limit()` to avoid migration headaches, but it now checks total users.

---

## All Files Updated

✅ **BILLING-PLANS-SCHEMA.sql**
- Removed max_technicians from table definition
- Updated all three plan inserts (Free, Growth, Premium)
- Updated check_technician_limit() function to count all users
- Updated subscription_dashboard view to show max_total_users

✅ **BILLING-PLANS-IMPLEMENTATION.md**
- Updated all code examples to use simplified approach
- Changed function to checkCanAddUser()
- Updated dashboard display to show "Team Members" instead of "Technicians"
- Updated testing examples

✅ **NEXT-ACTIONS-BILLING-LAUNCH.md**
- Updated Phase 1 & 3 descriptions
- Changed Phase 1 limit to 10 total users
- Updated all implementation guidance

---

## Verify the Changes

After running the updated SQL, verify:

```sql
-- Check that max_technicians column is gone
SELECT column_name FROM information_schema.columns
WHERE table_name = 'caicos_plan_features';
-- Should NOT include max_technicians

-- Check that plans have correct limits
SELECT name, price_per_tech FROM caicos_billing_plans
ORDER BY display_order;
-- Free Trial (0), Growth (9.99), Premium (19.99)

-- Check that features have max_total_users
SELECT bp.name, pf.max_total_users
FROM caicos_billing_plans bp
JOIN caicos_plan_features pf ON bp.id = pf.plan_id;
-- Free: 10, Growth: 150, Premium: 999999
```

---

## Q&A

**Q: What if customer has 12 users but wants Growth plan?**
A: They can upgrade immediately. No need to remove users first.

**Q: Can we make admins "not count" against the limit?**
A: Not with this simplified model. If you want that later, we can add a separate column for it, but it adds complexity. For MVP, the simple approach works fine.

**Q: What about future add-ons (more users)?**
A: Can easily add it as a line item: "Growth Base (max 150) + Extra Users Pack (add 50 more) = $49/month"

**Q: Does the change affect pricing?**
A: No. Still $9.99/tech/month. We just count total users instead of tech users.

---

## Why This Is Better for Your Pilot

Your cousin has **35 technicians** and various office staff. With the old model:
- She couldn't test with more than 5 techs during free trial
- Had to count admin separately
- Confusing during onboarding

With the new model:
- She can test with 10 people total from day 1
- Could be her top 10 techs, or 8 techs + 2 managers
- Simple rule: "up to 10 people"
- When she upgrades: "up to 150 people"

Much better! ✅

---

## Ready to Deploy

All files are updated and consistent. You can:

1. Run BILLING-PLANS-SCHEMA.sql in Supabase
2. Follow NEXT-ACTIONS-BILLING-LAUNCH.md
3. Use code examples from BILLING-PLANS-IMPLEMENTATION.md

The simplification is complete and production-ready.

---

*Last updated: 2026-03-01*
