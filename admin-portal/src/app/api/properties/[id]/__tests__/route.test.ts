/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { PUT } from '../route';
import { createFakeSupabase, type FakeDb } from '@/test-utils/fake-supabase';
import { LS, makeLastServiceDb } from '@/test-utils/last-service-fixtures';

jest.mock('@/lib/supabase-server', () => ({ createAuthenticatedRouteClient: jest.fn() }));

import { createAuthenticatedRouteClient } from '@/lib/supabase-server';

const mockAuth = createAuthenticatedRouteClient as jest.Mock;

function signIn(userId: string | null): FakeDb {
  const db = makeLastServiceDb();
  mockAuth.mockResolvedValue({
    supabase: userId ? createFakeSupabase(db) : {},
    user: userId ? { id: userId } : null,
  });
  return db;
}

function put(id: string, body: unknown) {
  return PUT(new NextRequest(`http://localhost/api/properties/${id}`, { method: 'PUT', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });
}

const base = { customer_name: 'QA Billing Renamed', address: '2 Test Pool Lane' };
const flag = (db: FakeDb, id: string) => db.cadenza_properties.find((p) => p.id === id)?.is_shared;

describe('PUT /api/properties/[id] is_shared (KAN-155, AC-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('401 when unauthenticated', async () => {
    signIn(null);
    expect((await put(LS.plainProp, { ...base, is_shared: true })).status).toBe(401);
  });

  it('office can mark a property shared and unmark it again', async () => {
    const db = signIn(LS.officeA);
    const on = await put(LS.plainProp, { ...base, is_shared: true });
    expect(on.status).toBe(200);
    expect((await on.json()).is_shared).toBe(true);
    expect(flag(db, LS.plainProp)).toBe(true);

    const off = await put(LS.plainProp, { ...base, is_shared: false });
    expect(off.status).toBe(200);
    expect(flag(db, LS.plainProp)).toBe(false);
  });

  it('technician cannot change is_shared (403, flag untouched)', async () => {
    const db = signIn(LS.techA);
    expect((await put(LS.plainProp, { ...base, is_shared: true })).status).toBe(403);
    expect(flag(db, LS.plainProp)).toBe(false);
  });

  it('is_shared must be a boolean', async () => {
    const db = signIn(LS.officeA);
    expect((await put(LS.plainProp, { ...base, is_shared: 1 })).status).toBe(400);
    expect(flag(db, LS.plainProp)).toBe(false);
  });

  it('omitting is_shared does not reset an existing flag', async () => {
    const db = signIn(LS.officeA);
    expect((await put(LS.sharedProp, base)).status).toBe(200);
    expect(flag(db, LS.sharedProp)).toBe(true);
  });

  it('does not touch another company\'s property (404, flag and name unchanged)', async () => {
    const db = signIn(LS.officeA);
    const res = await put(LS.foreignProp, { ...base, is_shared: false });
    expect(res.status).toBe(404);
    expect(flag(db, LS.foreignProp)).toBe(true);
    expect(db.cadenza_properties.find((p) => p.id === LS.foreignProp)?.customer_name).toBe('QA Billing Foreign');
  });
});
