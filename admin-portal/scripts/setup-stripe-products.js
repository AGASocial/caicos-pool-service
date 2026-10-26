#!/usr/bin/env node

/**
 * Setup Stripe products and update database
 * Run: node scripts/setup-stripe-products.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ Error: STRIPE_SECRET_KEY not found in .env file');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Supabase credentials not found in .env file');
  process.exit(1);
}

async function createStripeProduct(name, description) {
  const response = await fetch('https://api.stripe.com/v1/products', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      name,
      description,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to create product: ${data.error?.message}`);
  }
  return data.id;
}

async function createStripePrice(productId, amount, interval) {
  const response = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      product: productId,
      currency: 'usd',
      unit_amount: amount.toString(),
      'recurring[interval]': interval,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to create price: ${data.error?.message}`);
  }
  return data.id;
}

async function main() {
  console.log('🚀 Setting up Stripe products for Cadenza...\n');

  try {
    // Create Free Plan (optional, for completeness)
    console.log('📦 Creating Free Plan...');
    const freeProductId = await createStripeProduct(
      'Free Plan',
      'Limited features for small teams'
    );
    const freePriceId = await createStripePrice(freeProductId, 0, 'month');
    console.log(`✅ Free: ${freePriceId}\n`);

    // Create Standard Plan (formerly Necessary) at $14.99 per technician per month
    console.log('📦 Creating Standard Plan ($14.99/tech/month)...');
    const standardProductId = await createStripeProduct(
      'Standard Plan',
      'Essential features with per-technician pricing'
    );
    const standardMonthlyPriceId = await createStripePrice(standardProductId, 1499, 'month');
    console.log(`✅ Standard Monthly: ${standardMonthlyPriceId}\n`);

    // Create Pro Plan at $24.99 per technician per month
    console.log('📦 Creating Pro Plan ($24.99/tech/month)...');
    const proProductId = await createStripeProduct(
      'Pro Plan',
      'Advanced features with video, extended retention, and data export'
    );
    const proMonthlyPriceId = await createStripePrice(proProductId, 2499, 'month');
    console.log(`✅ Pro Monthly: ${proMonthlyPriceId}\n`);

    // Update database
    console.log('🔄 Updating database...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const updates = [
      { id: 'plan_free', priceId: freePriceId },
      { id: 'plan_necessary_month', priceId: standardMonthlyPriceId },
      { id: 'plan_pro_month', priceId: proMonthlyPriceId },
    ];

    for (const { id, priceId } of updates) {
      const { data: plan, error: fetchError } = await supabase
        .from('cadenza_billing_plans')
        .select('provider_price_map')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error(`❌ Error fetching plan ${id}:`, fetchError.message);
        continue;
      }

      if (!plan) {
        console.warn(`⚠️  Plan ${id} not found in database, skipping...`);
        continue;
      }

      const updatedMap = { ...plan.provider_price_map, stripe: priceId };

      const { error: updateError } = await supabase
        .from('cadenza_billing_plans')
        .update({ provider_price_map: updatedMap })
        .eq('id', id);

      if (updateError) {
        console.error(`❌ Error updating plan ${id}:`, updateError.message);
      } else {
        console.log(`✅ Updated ${id}`);
      }
    }

    console.log('\n🎉 Setup complete! Your Stripe products are ready.');
    console.log('\n📝 Stripe Price IDs:');
    console.log('-----------------------------------');
    console.log(`Free: ${freePriceId}`);
    console.log(`Standard Monthly ($14.99/tech): ${standardMonthlyPriceId}`);
    console.log(`Pro Monthly ($24.99/tech): ${proMonthlyPriceId}`);
    console.log('\n💡 Important: These are per-unit prices for subscription quantities.');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
