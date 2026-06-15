#!/bin/bash

# Setup Stripe products and prices for Cadenza
# Run this with: bash scripts/setup-stripe-products.sh
# Make sure you have STRIPE_SECRET_KEY in your .env file

set -e

echo "🚀 Setting up Stripe products for Cadenza..."
echo ""

# Load environment variables
source .env

if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "❌ Error: STRIPE_SECRET_KEY not found in .env file"
  exit 1
fi

echo "📦 Creating Necessary Plan (Monthly)..."
NECESSARY_PRODUCT_ID=$(curl -s https://api.stripe.com/v1/products \
  -u "$STRIPE_SECRET_KEY:" \
  -d name="Necessary Plan" \
  -d description="Essential features for managing your pool service business" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

NECESSARY_MONTHLY_PRICE_ID=$(curl -s https://api.stripe.com/v1/prices \
  -u "$STRIPE_SECRET_KEY:" \
  -d product="$NECESSARY_PRODUCT_ID" \
  -d currency=usd \
  -d unit_amount=999 \
  -d "recurring[interval]"=month \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "✅ Necessary Monthly: $NECESSARY_MONTHLY_PRICE_ID"

echo ""
echo "📦 Creating Necessary Plan (Yearly)..."
NECESSARY_YEARLY_PRICE_ID=$(curl -s https://api.stripe.com/v1/prices \
  -u "$STRIPE_SECRET_KEY:" \
  -d product="$NECESSARY_PRODUCT_ID" \
  -d currency=usd \
  -d unit_amount=9999 \
  -d "recurring[interval]"=year \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "✅ Necessary Yearly: $NECESSARY_YEARLY_PRICE_ID"

echo ""
echo "📦 Creating Premium Plan (Monthly)..."
PREMIUM_PRODUCT_ID=$(curl -s https://api.stripe.com/v1/products \
  -u "$STRIPE_SECRET_KEY:" \
  -d name="Premium Plan" \
  -d description="Unlimited features with priority support" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

PREMIUM_MONTHLY_PRICE_ID=$(curl -s https://api.stripe.com/v1/prices \
  -u "$STRIPE_SECRET_KEY:" \
  -d product="$PREMIUM_PRODUCT_ID" \
  -d currency=usd \
  -d unit_amount=1999 \
  -d "recurring[interval]"=month \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "✅ Premium Monthly: $PREMIUM_MONTHLY_PRICE_ID"

echo ""
echo "📦 Creating Premium Plan (Yearly)..."
PREMIUM_YEARLY_PRICE_ID=$(curl -s https://api.stripe.com/v1/prices \
  -u "$STRIPE_SECRET_KEY:" \
  -d product="$PREMIUM_PRODUCT_ID" \
  -d currency=usd \
  -d unit_amount=19999 \
  -d "recurring[interval]"=year \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "✅ Premium Yearly: $PREMIUM_YEARLY_PRICE_ID"

echo ""
echo "📝 Stripe Price IDs created:"
echo "-----------------------------------"
echo "NECESSARY_MONTHLY: $NECESSARY_MONTHLY_PRICE_ID"
echo "NECESSARY_YEARLY: $NECESSARY_YEARLY_PRICE_ID"
echo "PREMIUM_MONTHLY: $PREMIUM_MONTHLY_PRICE_ID"
echo "PREMIUM_YEARLY: $PREMIUM_YEARLY_PRICE_ID"
echo ""
echo "🔄 Now updating database..."

# Update database with new price IDs
psql $DATABASE_URL <<EOF
UPDATE billing_plans
SET provider_price_map = jsonb_set(provider_price_map, '{stripe}', '"$NECESSARY_MONTHLY_PRICE_ID"')
WHERE id = 'plan_necessary_month';

UPDATE billing_plans
SET provider_price_map = jsonb_set(provider_price_map, '{stripe}', '"$NECESSARY_YEARLY_PRICE_ID"')
WHERE id = 'plan_necessary_year';

UPDATE billing_plans
SET provider_price_map = jsonb_set(provider_price_map, '{stripe}', '"$PREMIUM_MONTHLY_PRICE_ID"')
WHERE id = 'plan_premium_month';

UPDATE billing_plans
SET provider_price_map = jsonb_set(provider_price_map, '{stripe}', '"$PREMIUM_YEARLY_PRICE_ID"')
WHERE id = 'plan_premium_year';
EOF

echo "✅ Database updated successfully!"
echo ""
echo "🎉 Setup complete! Your Stripe products are ready."
