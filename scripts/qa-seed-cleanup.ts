#!/usr/bin/env tsx
/**
 * QA Seed/Cleanup Script
 * 
 * Idempotently seeds or cleans QA test data for the company:
 * 45173a02-9f30-4a07-89bb-16923bd043b5
 * 
 * CRITICAL: All operations are strictly scoped to this QA company ID.
 * Never touches production data from other companies.
 * 
 * Usage:
 *   tsx scripts/qa-seed-cleanup.ts seed
 *   tsx scripts/qa-seed-cleanup.ts cleanup
 * 
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   QA_TECH_PASSWORD (for seed only)
 */

import { createClient } from '@supabase/supabase-js';

const QA_COMPANY_ID = '45173a02-9f30-4a07-89bb-16923bd043b5';
const QA_ADMIN_ID = '5257cbb7-0481-4278-b57f-18bc651e20bd';
const QA_TECH_ID = '8bc9982d-6814-4d4c-9665-cac788be942e';

// Additional test technicians we'll create
const QA_TECHS = [
  { email: 'qa-tech2@cadenzaops.com', name: 'QA Tech 2' },
  { email: 'qa-tech3@cadenzaops.com', name: 'QA Tech 3' },
];

interface Auth {
  url: string;
  key: string;
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Missing required environment variables:');
    if (!url) console.error('  - SUPABASE_URL');
    if (!key) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    throw new Error('Missing required Supabase credentials. Cannot proceed.');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function validateSeedEnvironment() {
  const missing: string[] = [];
  
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.QA_TECH_PASSWORD) missing.push('QA_TECH_PASSWORD');
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables for seed:');
    missing.forEach(v => console.error(`  - ${v}`));
    throw new Error('Cannot seed without required environment variables.');
  }
}

async function seedQAData() {
  // Validate environment before proceeding
  validateSeedEnvironment();
  
  const supabase = getSupabaseAdmin();
  console.log('🌱 Starting QA seed...');

  // Verify company exists
  const { data: company, error: companyError } = await supabase
    .from('cadenza_companies')
    .select('id, name, subscription_tier')
    .eq('id', QA_COMPANY_ID)
    .single();

  if (companyError || !company) {
    throw new Error(`QA company not found: ${QA_COMPANY_ID}`);
  }

  console.log(`✓ Company: ${company.name} (${company.subscription_tier})`);

  // Ensure Pro subscription exists for QA admin (for plan gating tests)
  console.log('📋 Checking subscription...');
  const { data: existingSub } = await supabase
    .from('cadenza_billing_subscriptions')
    .select('id')
    .eq('user_id', QA_ADMIN_ID)
    .eq('status', 'active')
    .single();

  if (!existingSub) {
    console.log('  Creating Pro subscription for QA admin...');
    const { error: subError } = await supabase
      .from('cadenza_billing_subscriptions')
      .insert({
        user_id: QA_ADMIN_ID,
        plan_id: 'plan_pro_month',
        status: 'active',
        provider: 'test',
        provider_subscription_id: 'qa-sub-' + Date.now(),
        provider_customer_id: 'qa-cust-' + Date.now(),
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

    if (subError) {
      console.warn('  Warning: Could not create subscription:', subError.message);
    } else {
      console.log('  ✓ Subscription created');
    }
  } else {
    console.log('  ✓ Subscription exists');
  }

  // Create additional test technicians
  console.log('👥 Creating additional test technicians...');
  for (const tech of QA_TECHS) {
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser?.users?.some((u) => u.email === tech.email);

    if (!userExists) {
      console.log(`  Creating ${tech.email}...`);
      const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
        email: tech.email,
        password: process.env.QA_TECH_PASSWORD!,
        email_confirm: true,
        user_metadata: {
          company_id: QA_COMPANY_ID,
          role: 'technician',
          full_name: tech.name,
        },
      });

      if (authError) {
        console.warn(`  Warning: Could not create ${tech.email}:`, authError.message);
      } else {
        console.log(`  ✓ Created ${tech.email} (${newUser.user?.id})`);
      }
    } else {
      console.log(`  ✓ ${tech.email} exists`);
    }
  }

  // Seed properties
  console.log('🏠 Seeding properties...');
  const properties = [
    {
      customer_name: 'QA Customer 1',
      customer_email: 'qa-customer1@example.com',
      customer_phone: '+1-555-0101',
      address: '123 Test St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      lat: 30.2672,
      lng: -97.7431,
      pool_type: 'residential',
      pool_surface: 'plaster',
      notes: 'QA test property 1',
    },
    {
      customer_name: 'QA Customer 2',
      customer_email: 'qa-customer2@example.com',
      customer_phone: '+1-555-0102',
      address: '456 Demo Ave',
      city: 'Austin',
      state: 'TX',
      zip: '78702',
      lat: 30.2831,
      lng: -97.7375,
      pool_type: 'residential',
      pool_surface: 'pebble',
      notes: 'QA test property 2',
    },
    {
      customer_name: 'QA Customer 3',
      customer_email: 'qa-customer3@example.com',
      customer_phone: '+1-555-0103',
      address: '789 Sample Blvd',
      city: 'Austin',
      state: 'TX',
      zip: '78703',
      lat: 30.2964,
      lng: -97.7575,
      pool_type: 'commercial',
      pool_surface: 'tile',
      notes: 'QA test property 3',
    },
  ];

  const propertyIds: string[] = [];
  for (const prop of properties) {
    const { data: existing } = await supabase
      .from('cadenza_properties')
      .select('id')
      .eq('company_id', QA_COMPANY_ID)
      .eq('address', prop.address)
      .single();

    if (existing) {
      console.log(`  ✓ Property exists: ${prop.address}`);
      propertyIds.push(existing.id);
    } else {
      const { data: newProp, error } = await supabase
        .from('cadenza_properties')
        .insert({ ...prop, company_id: QA_COMPANY_ID })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create property: ${error.message}`);
      }
      console.log(`  ✓ Created: ${prop.address}`);
      propertyIds.push(newProp.id);
    }
  }

  // Create route
  console.log('🚗 Creating route...');
  const { data: existingRoute } = await supabase
    .from('cadenza_routes')
    .select('id')
    .eq('company_id', QA_COMPANY_ID)
    .eq('technician_id', QA_TECH_ID)
    .eq('name', 'QA Test Route')
    .single();

  let routeId: string;
  if (existingRoute) {
    routeId = existingRoute.id;
    console.log('  ✓ Route exists');
  } else {
    const { data: newRoute, error } = await supabase
      .from('cadenza_routes')
      .insert({
        company_id: QA_COMPANY_ID,
        technician_id: QA_TECH_ID,
        name: 'QA Test Route',
        day_of_week: new Date().getDay(), // Today
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create route: ${error.message}`);
    }
    routeId = newRoute.id;
    console.log('  ✓ Route created');
  }

  // Create route stops
  console.log('📍 Creating route stops...');
  const today = new Date();
  const todayDayOfWeek = today.getDay();

  for (let i = 0; i < propertyIds.length; i++) {
    const propertyId = propertyIds[i];
    const { data: existingStop } = await supabase
      .from('cadenza_route_stops')
      .select('id')
      .eq('route_id', routeId)
      .eq('property_id', propertyId)
      .single();

    if (!existingStop) {
      const { error } = await supabase.from('cadenza_route_stops').insert({
        route_id: routeId,
        property_id: propertyId,
        stop_order: i + 1,
        day_of_week: todayDayOfWeek,
        service_frequency: 'weekly',
      });

      if (error) {
        console.warn(`  Warning: Could not create stop for property ${i + 1}:`, error.message);
      } else {
        console.log(`  ✓ Stop ${i + 1} created`);
      }
    } else {
      console.log(`  ✓ Stop ${i + 1} exists`);
    }
  }

  // Create TODAY's jobs (in America/Chicago time)
  console.log('📅 Creating jobs for today...');
  const chicagoDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

  for (let i = 0; i < propertyIds.length; i++) {
    const propertyId = propertyIds[i];
    const { data: existingJob } = await supabase
      .from('cadenza_service_jobs')
      .select('id')
      .eq('company_id', QA_COMPANY_ID)
      .eq('property_id', propertyId)
      .eq('scheduled_date', chicagoDate)
      .eq('job_source', 'route')
      .single();

    if (!existingJob) {
      const { error } = await supabase.from('cadenza_service_jobs').insert({
        company_id: QA_COMPANY_ID,
        property_id: propertyId,
        technician_id: QA_TECH_ID,
        route_id: routeId,
        scheduled_date: chicagoDate,
        status: 'pending',
        job_source: 'route',
        route_order: i + 1,
      });

      if (error) {
        console.warn(`  Warning: Could not create job ${i + 1}:`, error.message);
      } else {
        console.log(`  ✓ Job ${i + 1} created for ${chicagoDate}`);
      }
    } else {
      console.log(`  ✓ Job ${i + 1} exists for ${chicagoDate}`);
    }
  }

  console.log('✅ QA seed complete!\n');
}

async function cleanupQAData() {
  const supabase = getSupabaseAdmin();
  console.log('🧹 Starting QA cleanup...');

  // Delete in reverse dependency order
  console.log('  Deleting report photos...');
  const { error: photosErr } = await supabase
    .from('cadenza_report_photos')
    .delete()
    .eq('company_id', QA_COMPANY_ID);
  if (photosErr) console.warn('    Warning:', photosErr.message);

  console.log('  Deleting service reports...');
  const { error: reportsErr } = await supabase
    .from('cadenza_service_reports')
    .delete()
    .eq('company_id', QA_COMPANY_ID);
  if (reportsErr) console.warn('    Warning:', reportsErr.message);

  console.log('  Deleting service jobs...');
  const { error: jobsErr } = await supabase
    .from('cadenza_service_jobs')
    .delete()
    .eq('company_id', QA_COMPANY_ID);
  if (jobsErr) console.warn('    Warning:', jobsErr.message);

  console.log('  Deleting route stop schedules...');
  const { data: stops } = await supabase
    .from('cadenza_route_stops')
    .select('id')
    .in(
      'route_id',
      supabase.from('cadenza_routes').select('id').eq('company_id', QA_COMPANY_ID)
    );

  if (stops && stops.length > 0) {
    const stopIds = stops.map((s: any) => s.id);
    const { error: schedErr } = await supabase
      .from('cadenza_route_stop_schedules')
      .delete()
      .in('route_stop_id', stopIds);
    if (schedErr) console.warn('    Warning:', schedErr.message);
  }

  console.log('  Deleting route stops...');
  const { error: stopsErr } = await supabase
    .from('cadenza_route_stops')
    .delete()
    .in(
      'route_id',
      supabase.from('cadenza_routes').select('id').eq('company_id', QA_COMPANY_ID)
    );
  if (stopsErr) console.warn('    Warning:', stopsErr.message);

  console.log('  Deleting routes...');
  const { error: routesErr } = await supabase
    .from('cadenza_routes')
    .delete()
    .eq('company_id', QA_COMPANY_ID);
  if (routesErr) console.warn('    Warning:', routesErr.message);

  console.log('  Deleting properties...');
  const { error: propsErr } = await supabase
    .from('cadenza_properties')
    .delete()
    .eq('company_id', QA_COMPANY_ID);
  if (propsErr) console.warn('    Warning:', propsErr.message);

  console.log('  Deleting subscriptions...');
  const { error: subsErr } = await supabase
    .from('cadenza_billing_subscriptions')
    .delete()
    .eq('user_id', QA_ADMIN_ID);
  if (subsErr) console.warn('    Warning:', subsErr.message);

  // Delete additional test tech users (but not the main QA admin/tech)
  console.log('  Deleting additional test users...');
  for (const tech of QA_TECHS) {
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find((u) => u.email === tech.email);
    if (user) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        console.warn(`    Warning: Could not delete ${tech.email}:`, error.message);
      } else {
        console.log(`    ✓ Deleted ${tech.email}`);
      }
    }
  }

  console.log('✅ QA cleanup complete!\n');
}

async function main() {
  const command = process.argv[2];

  if (!command || !['seed', 'cleanup'].includes(command)) {
    console.error('Usage: tsx scripts/qa-seed-cleanup.ts <seed|cleanup>');
    process.exit(1);
  }

  try {
    if (command === 'seed') {
      await seedQAData();
    } else {
      await cleanupQAData();
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
