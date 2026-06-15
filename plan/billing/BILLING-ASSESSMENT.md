# Billing & Plans Assessment — June 2026

## Pricing model (locked)

| Tier | ID | Price | Billing unit |
|------|-----|-------|----------------|
| **Free** | `plan_free` | $0 | — |
| **Standard** | `plan_necessary_month` | **$14.99 / technician / month** | `amount_cents × quantity` |

### Feature limits

| Limit | Free | Standard ($14.99/tech/mo) |
|-------|------|---------------------------|
| Photos per service | 5 | 10 |
| Customers (properties) | 5,000 | Unlimited |
| Admins | 10 | 10 |
| Photo retention | 1 year (365 days) | 5 years (1,825 days) |

Stripe price (test): `price_1TilGTE3O31AtXXLolNt2YKj` on product `prod_UiBdKitgbOMRCy`.

---

## Tables

| Table | Role | Charge-related columns |
|-------|------|------------------------|
| `cadenza_billing_plans` | Catalog | `amount_cents` (per technician), `features`, `active`, `provider_price_map` |
| `cadenza_billing_subscriptions` | User subscription | `plan_id`, `quantity`, `status`, `current_period_end`, `provider_subscription_id` |
| `cadenza_billing_invoices` | Payment history | `amount_cents` (actual charge) |
| `cadenza_billing_payment_methods` | Cards on file | — |
| `cadenza_billing_webhook_events` | Audit / idempotency | — |

**Formula:** `monthly_charge = plan.amount_cents × subscription.quantity`

---

## Issues found (browser + API + DB audit)

### Critical (fixed in US-D-007 / US-B-017 / US-F-007)

1. **No `quantity` on subscriptions** — Stripe charged correctly; DB/UI could not read seat count.
2. **Next payment UI** used team technician count instead of subscription `quantity`.
3. **Expired subscriptions** stayed `status = active` in DB; only UI masked as Free.
4. **Multiple active subscription rows** per user — create always INSERTed.
5. **Webhook upserts** used `onConflict` without unique indexes → invoices never synced.
6. **`active` column** on plans used in code but missing from base migration.

### High (addressed in US-B-017)

7. **`handleInvoicePaid`** overwrote billing periods from `paidAt` instead of Stripe subscription periods.
8. **Webhook returned HTTP 200 on failure** — Stripe did not retry.
9. **Webhook user lookup** failed without payment-method row (metadata not used).
10. **Stripe normalizer** omitted `userId`, `planId`, `quantity` from subscription events.
11. **Plans route unit test** expected wrong response shape.

### Medium (backlog / follow-up)

12. PayU checkout ignores quantity.
13. Invoice list has no Stripe backfill when DB empty.
14. Yearly plans deactivated but toggle still shown.
15. Feature key inconsistency (`admin_users` vs `admin_users_included`, `storage_gb` vs `max_storage_mb`).
16. E2E billing mocks still reference Premium at $29.

---

## Plan stories

| Story | Domain | Title |
|-------|--------|-------|
| **US-D-007** | database | Billing schema hardening (quantity, active, unique indexes) |
| **US-B-017** | backend | Subscription lifecycle, webhooks, and quantity persistence |
| **US-F-007** | frontend | Billing UI — next payment, plans page, API response alignment |

Execute via: *"Execute the plan backlog"* or Master Agent with `plan-orchestrator` skill.

---

## Verification checklist

- [ ] `GET /api/billing/subscriptions` returns `quantity` and respects expired periods
- [ ] Billing dashboard next payment = `amount_cents × quantity`
- [ ] New Standard checkout at 2 technicians charges **$29.98** in Stripe
- [ ] `cadenza_billing_invoices` populates after `stripe listen` + webhook
- [ ] Only one effective paid subscription per user
- [ ] `npm run build` passes in `admin-portal/`
