/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { createFakeSupabase, type FakeDb } from '@/test-utils/fake-supabase';
import { LS, makeLastServiceDb } from '@/test-utils/last-service-fixtures';

jest.mock('@/lib/supabase-server', () => ({ createAuthenticatedRouteClient: jest.fn() }));

import { createAuthenticatedRouteClient } from '@/lib/supabase-server';

const mockAuth = createAuthenticatedRouteClient as jest.Mock;

function signIn(userId: string | null, opts: Parameters<typeof createFakeSupabase>[1] = {}) {
  const db: FakeDb = makeLastServiceDb();
  mockAuth.mockResolvedValue({
    supabase: userId ? createFakeSupabase(db, opts) : {},
    user: userId ? { id: userId } : null,
  });
  return db;
}

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/properties', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

const base = { customer_name: 'QA Billing New', address: '1 Test Pool Lane' };

describe('/api/properties is_shared (KAN-155)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('GET: 401 when unauthenticated', async () => {
    signIn(null);
    expect((await GET(new NextRequest('http://localhost/api/properties'))).status).toBe(401);
  });

  it('GET: includes is_shared and stays inside the caller\'s company', async () => {
    signIn(LS.officeA);
    const res = await GET(new NextRequest('http://localhost/api/properties?active_only=false'));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    const byName = Object.fromEntries(data.map((p: { customer_name: string; is_shared: boolean }) => [p.customer_name, p.is_shared]));
    expect(byName['QA Billing Shared']).toBe(true);
    expect(byName['QA Billing Plain']).toBe(false);
  });

  it('GET: keeps working before the migration (is_shared column missing)', async () => {
    signIn(LS.officeA, { missingColumns: ['is_shared'] });
    const res = await GET(new NextRequest('http://localhost/api/properties?active_only=false'));
    expect(res.status).toBe(200);
    // Without the fallback retry the missing column would surface as a 500.
    expect((await res.json()).data.length).toBeGreaterThan(0);
  });

  it('POST: 401 when unauthenticated', async () => {
    signIn(null);
    expect((await post({ ...base, is_shared: true })).status).toBe(401);
  });

  it('POST: office role can create a shared property in its own company', async () => {
    const db = signIn(LS.officeA);
    const res = await post({ ...base, is_shared: true });
    expect(res.status).toBe(200);
    expect((await res.json()).is_shared).toBe(true);
    const created = db.cadenza_properties.find((p) => p.customer_name === 'QA Billing New');
    expect(created).toMatchObject({ company_id: LS.companyA, is_shared: true });
  });

  it('POST: technician cannot set is_shared (403) and nothing is written', async () => {
    const db = signIn(LS.techA);
    const before = db.cadenza_properties.length;
    expect((await post({ ...base, is_shared: true })).status).toBe(403);
    expect(db.cadenza_properties.length).toBe(before);
  });

  it('POST: is_shared must be a boolean', async () => {
    signIn(LS.officeA);
    expect((await post({ ...base, is_shared: 'yes' })).status).toBe(400);
  });

  it('POST: omitting is_shared leaves the column to its database default', async () => {
    const db = signIn(LS.officeA);
    expect((await post(base)).status).toBe(200);
    const created = db.cadenza_properties.find((p) => p.customer_name === 'QA Billing New');
    expect(created).not.toHaveProperty('is_shared');
  });
});
