import { cleanupBillingQaUsers, PROTECTED_COMPANY_IDS } from '../../../e2e/helpers/billing-qa-cleanup';
import type { SupabaseClient } from '@supabase/supabase-js';

const DEMO = 'de300000-ca1c-4c05-8000-0000000000d0';

function mockAdmin(profiles: { id: string; company_id: string }[]) {
  const deletes: { table: string; vals: string[] }[] = [];
  const deletedUsers: string[] = [];
  const from = (table: string) => ({
    select: () => ({
      in: (_c: string, ids: string[]) => Promise.resolve({ data: profiles.filter((p) => ids.includes(p.id)) }),
      eq: (_c: string, v: string) => ({
        maybeSingle: () => Promise.resolve({ data: { name: v === DEMO ? 'Demo Caicos (demo)' : 'QA Billing X' } }),
        then: (res: (x: unknown) => void) => res({ data: profiles.filter((p) => p.company_id === v) }),
      }),
    }),
    delete: () => ({ in: (_c: string, vals: string[]) => { deletes.push({ table, vals }); return Promise.resolve({ error: null }); } }),
  });
  const admin = {
    from,
    auth: { admin: {
      listUsers: () => Promise.resolve({ data: { users: [
        { id: 'u-demo', email: 'qa-billing-demo@cadenzaops.com' },
        { id: 'u-qa', email: 'qa-billing-1@cadenzaops.com' },
      ] }, error: null }),
      deleteUser: (id: string) => { deletedUsers.push(id); return Promise.resolve({ error: null }); },
    } },
  } as unknown as SupabaseClient;
  return { admin, deletes, deletedUsers };
}

describe('billing QA cleanup never touches the demo company', () => {
  it('protects the demo company id', () => {
    expect(PROTECTED_COMPANY_IDS.has(DEMO)).toBe(true);
  });

  it('skips users and companies in the demo tenant', async () => {
    const { admin, deletes, deletedUsers } = mockAdmin([
      { id: 'u-demo', company_id: DEMO },
      { id: 'u-qa', company_id: 'c-qa' },
    ]);
    const res = await cleanupBillingQaUsers(admin);
    expect(deletedUsers).toEqual(['u-qa']);
    expect(res.users).toBe(1);
    for (const d of deletes) expect(d.vals).not.toContain(DEMO);
    for (const d of deletes) expect(d.vals).not.toContain('u-demo');
  });
});
