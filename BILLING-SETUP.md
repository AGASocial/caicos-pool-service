# Cadenza Billing & Subscription Setup Guide

## Overview

This guide documents the complete billing and subscription flow implementation for Cadenza, including signup, plan selection, payment via Stripe Checkout, and subscription management.

## Pricing Model

- **Free Plan**: $0/month, limited features (5 photos/service, 5,000 properties, 365-day retention)
- **Standard Plan**: $14.99 per technician per month (10 photos/service, unlimited properties, 1,825-day retention)

Formula: `monthly_charge = plan.amount_cents × subscription.quantity`

## Architecture

### Database Tables

- `cadenza_billing_plans` - Plan definitions with features and pricing
- `cadenza_billing_subscriptions` - User subscriptions with quantity (seats) and status
- `cadenza_billing_invoices` - Payment history
- `cadenza_billing_payment_methods` - Stored payment methods
- `cadenza_billing_webhook_events` - Webhook audit log

### Key Features

1. **Onboarding Flow** (`/onboarding`)
   - New users select a plan after signup
   - Specify technician count (seats)
   - Free plan: immediate access
   - Paid plans: redirect to Stripe Checkout

2. **Stripe Checkout** (`POST /api/billing/checkout`)
   - Creates Stripe Checkout session
   - Returns URL for redirect
   - Handles payment collection
   - Webhook processes `checkout.session.completed`

3. **Stripe Customer Portal** (`POST /api/billing/portal`)
   - Manages payment methods
   - View invoices
   - Update billing details
   - Accessed from billing page

4. **Seat Management** (`/api/billing/seats`)
   - Tracks active technicians vs. paid seats
   - Enforces limits when inviting technicians
   - Displays warnings when approaching limits

5. **Billing Page** (`/billing`)
   - Current plan and features
   - Next payment date and amount
   - Manage payment methods (Customer Portal)
   - Upgrade/downgrade plans
   - Cancel subscription

## Environment Variables

Required in `.env.local`:

```bash
# Stripe
NEXT_PUBLIC_PAYMENT_GATEWAY=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Stripe Setup (Test Mode)

### 1. Create Products and Prices

Run the setup script:

```bash
cd admin-portal
npm install
node scripts/setup-stripe-products.js
```

This creates:
- Free Plan (Product + Price at $0)
- Standard Plan (Product + Price at $14.99)

The script automatically updates `cadenza_billing_plans.provider_price_map` in the database.

### 2. Configure Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 3. Test with Stripe CLI (Local Development)

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy webhook secret from output to .env.local

# In another terminal
stripe trigger checkout.session.completed
stripe trigger invoice.paid
```

## User Flow

### New Company Signup

1. User visits `/auth/register`
2. Enters company name, email, password
3. Email verification (optional, can be disabled)
4. Redirected to `/onboarding`
5. Selects plan and technician count
6. For Free: immediately to dashboard
7. For Standard: redirected to Stripe Checkout
8. After payment: webhook creates subscription
9. Redirected to `/onboarding/success`
10. Lands in `/dashboard` with active subscription

### Invite Team Member

1. Owner/admin goes to `/team`
2. Creates invite code for role (technician/admin)
3. System checks seat limits (for technicians)
4. If over limit: shows error and upgrade prompt
5. If ok: generates invite link
6. New user registers with invite code
7. Automatically joins company with assigned role

### Manage Subscription

1. User goes to `/billing`
2. Views current plan, seats, next payment
3. Click "Manage Payment Methods" → Stripe Customer Portal
4. Can update card, view invoices
5. Return to portal via link
6. Can upgrade/downgrade from `/billing/plans`
7. Can cancel (keeps active until period end)

## Webhook Processing

When Stripe sends webhooks:

1. Webhook verifies signature
2. Normalizes event data
3. Checks for duplicates (idempotency)
4. Processes based on type:
   - `checkout.session.completed`: Creates subscription with quantity from metadata
   - `customer.subscription.updated`: Updates status, period dates
   - `invoice.paid`: Records payment
5. Updates database atomically
6. Returns 200 (Stripe retries on errors)

## Seat Management

The system enforces seat limits:

- **Free Plan**: No enforcement (unlimited technicians)
- **Standard Plan**: Active technicians must not exceed `quantity`

Checked when:
- Creating invite codes for technicians
- Can display warning on team page
- Blocked with error message and upgrade prompt

Query seat status:

```bash
GET /api/billing/seats
Response:
{
  "subscribed": 5,
  "active": 3,
  "available": 2,
  "isOverLimit": false
}
```

## Plan Limits Enforcement

Feature limits from `cadenza_billing_plans.features`:

- `max_photos_per_service` - Enforced during report creation
- `max_properties` - Checked when creating properties
- `photo_retention_days` - Applied during storage cleanup cron

See `admin-portal/src/lib/subscription/limits.ts` for implementation.

## Testing

### Test Cards (Stripe Test Mode)

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`
- Any future expiry, any CVC

### Test Scenarios

1. **Free Plan Signup**
   - Register → Select Free → Dashboard
   - Verify no payment required
   - Confirm subscription status = active, plan_id = plan_free

2. **Paid Plan Checkout**
   - Register → Select Standard (2 seats)
   - Enter test card
   - Complete payment
   - Verify webhook creates subscription with quantity=2
   - Check database: status=active, current_period_end set

3. **Seat Limit**
   - Paid subscription with quantity=1
   - Invite 1 technician (succeeds)
   - Invite 2nd technician (fails with error)
   - Upgrade to 2 seats
   - Invite succeeds

4. **Customer Portal**
   - Go to /billing
   - Click "Manage Payment Methods"
   - Add/remove cards in Stripe portal
   - Verify return to billing page

5. **Webhook Handling**
   - Use `stripe trigger` commands
   - Check logs in Vercel/local
   - Verify database updates

## API Routes

### Billing

- `GET /api/billing/plans` - List all active plans
- `GET /api/billing/subscriptions` - Get user's subscription
- `POST /api/billing/subscriptions` - Create subscription (legacy, use checkout)
- `PATCH /api/billing/subscriptions` - Update subscription (quantity, plan)
- `DELETE /api/billing/subscriptions` - Cancel subscription
- `GET /api/billing/invoices` - List user's invoices
- `GET /api/billing/seats` - Get seat information
- `POST /api/billing/checkout` - Create Stripe Checkout session
- `POST /api/billing/portal` - Create Customer Portal session

### Webhooks

- `POST /api/webhooks/stripe` - Stripe webhook receiver
- Verifies signature with `STRIPE_WEBHOOK_SECRET`
- Processes events and updates database
- Returns 200 on success, 40x/50x on error

## Migration Notes

If upgrading from incomplete billing:

1. Run migrations:
   ```bash
   cd /workspace
   supabase db push
   ```

2. Update Stripe price IDs:
   ```bash
   cd admin-portal
   node scripts/setup-stripe-products.js
   ```

3. Configure webhook endpoint in Stripe Dashboard

4. Set environment variables

5. Test signup flow end-to-end

## Troubleshooting

### Webhook not receiving events

- Check Stripe Dashboard → Developers → Webhooks → Events log
- Verify endpoint URL is correct and publicly accessible
- Check `STRIPE_WEBHOOK_SECRET` matches dashboard
- Use `stripe listen` for local development

### Subscription not created after checkout

- Check Stripe logs for webhook delivery
- Verify `checkout.session.completed` event is enabled
- Check `/api/webhooks/stripe` logs for errors
- Ensure metadata (user_id, plan_id, quantity) is set

### Seat limit not enforced

- Verify subscription has correct quantity
- Check seat calculation logic in `/api/billing/seats`
- Ensure technician count matches active profiles with role='technician'

### Customer Portal not opening

- Verify `STRIPE_SECRET_KEY` is set
- Check user has valid Stripe customer ID
- Ensure provider is 'stripe' (not 'payu')
- Check browser console for redirect errors

## Additional Resources

- Stripe Docs: https://stripe.com/docs/billing/subscriptions/overview
- Stripe Checkout: https://stripe.com/docs/payments/checkout
- Customer Portal: https://stripe.com/docs/billing/subscriptions/integrating-customer-portal
- Webhooks: https://stripe.com/docs/webhooks
- Test Cards: https://stripe.com/docs/testing

## Support

For issues or questions:
1. Check Vercel logs for API errors
2. Check Stripe Dashboard for payment/webhook issues  
3. Review database for subscription state
4. Enable debug logging in webhook handler
