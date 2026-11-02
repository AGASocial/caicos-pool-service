/**
 * Cleanup for billing E2E QA tenants. STRICTLY scoped:
 *  - users whose email matches qa-billing-*@cadenzaops.com (optionally a narrower prefix)
 *  - companies named "QA Billing *" whose every member is such a user
 * Never touches any other user or company. Errors are logged, not thrown.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const EMAIL_RE = /^qa-billing-[a-z0-9-]+@cadenzaops\.com$/i;
const COMPANY_PREFIX = 'QA Billing ';
/** Demo tenant (scripts/demo-seed.ts) — never touched by any QA cleanup. */
export const PROTECTED_COMPANY_IDS = new Set([
  'de300000-ca1c-4c05-8000-0000000000d0', // Demo Caicos (demo)
]);

export async function cleanupBillingQaUsers(
  admin: SupabaseClient,
  opts: { emailPrefix?: string } = {}
): Promise<{ users: number; companies: number }> {
  const prefix = (opts.emailPrefix ?? 'qa-billing-').toLowerCase();
  if (!prefix.startsWith('qa-billing-')) throw new Error('Refusing cleanup: prefix must start with qa-billing-');

  const users: { id: string; email: string }[] = [];
  for (let page = 1; page < 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { console.warn('listUsers failed:', error.message); break; }
    for (const u of data.users) {
      const email = (u.email ?? '').toLowerCase();
      if (EMAIL_RE.test(email) && email.startsWith(prefix)) users.push({ id: u.id, email });
    }
    if (data.users.length < 1000) break;
  }
  if (!users.length) return { users: 0, companies: 0 };
  const { data: allProfiles } = await admin.from('cadenza_profiles').select('id, company_id').in('id', users.map((u) => u.id));
  // Never touch users that belong to a protected (demo) company
  const protectedUsers = new Set((allProfiles ?? []).filter((p) => PROTECTED_COMPANY_IDS.has(p.company_id as string)).map((p) => p.id as string));
  users.splice(0, users.length, ...users.filter((u) => !protectedUsers.has(u.id)));
  if (!users.length) return { users: 0, companies: 0 };
  const ids = users.map((u) => u.id);
  const profiles = (allProfiles ?? []).filter((p) => ids.includes(p.id as string));
  const companyIds = [...new Set(profiles.map((p) => p.company_id as string).filter(Boolean))].filter((c) => !PROTECTED_COMPANY_IDS.has(c));

  // Only companies that are clearly QA billing tenants and contain only QA billing users
  const safeCompanies: string[] = [];
  for (const cid of companyIds) {
    const { data: company } = await admin.from('cadenza_companies').select('name').eq('id', cid).maybeSingle();
    if (!company?.name?.startsWith(COMPANY_PREFIX)) continue;
    const { data: members } = await admin.from('cadenza_profiles').select('id').eq('company_id', cid);
    if ((members ?? []).every((m) => ids.includes(m.id as string))) safeCompanies.push(cid);
  }

  const del = async (table: string, col: string, vals: string[]) => {
    if (!vals.length) return;
    const { error } = await admin.from(table).delete().in(col, vals);
    if (error) console.warn(`cleanup ${table}: ${error.message}`);
  };

  await del('cadenza_billing_invoices', 'user_id', ids);
  await del('cadenza_billing_payment_methods', 'user_id', ids);
  await del('cadenza_billing_subscriptions', 'user_id', ids);
  await del('cadenza_invite_codes', 'company_id', safeCompanies);

  for (const u of users) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) console.warn(`deleteUser ${u.email}: ${error.message}`);
  }
  await del('cadenza_profiles', 'id', ids); // in case there is no cascade
  await del('cadenza_cant_service_reasons', 'company_id', safeCompanies);
  await del('cadenza_companies', 'id', safeCompanies);

  console.log(`🧹 billing QA cleanup: ${users.length} user(s), ${safeCompanies.length} company(ies)`);
  return { users: users.length, companies: safeCompanies.length };
}
