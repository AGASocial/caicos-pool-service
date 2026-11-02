#!/usr/bin/env tsx
/**
 * Sweep leftover billing E2E tenants (qa-billing-*@cadenzaops.com, "QA Billing *" companies).
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... tsx scripts/qa-billing-cleanup.ts
 */
import { createClient } from '@supabase/supabase-js';
import { cleanupBillingQaUsers } from '../admin-portal/e2e/helpers/billing-qa-cleanup';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
cleanupBillingQaUsers(createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }))
  .then(() => process.exit(0))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
