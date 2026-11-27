/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AUTO_ACTOR,
  buildDeliveryRecord,
  isMissingColumnError,
  loadLatestDelivery,
  normalizeReason,
  saveDelivery,
  toLegacyRecord,
} from '../delivery-log';

const base = {
  companyId: 'company-1',
  jobId: 'job-1',
  propertyId: 'property-1',
  recipient: 'customer@example.com',
  attemptCount: 1,
  now: new Date('2026-11-27T12:00:00.000Z'),
};

describe('buildDeliveryRecord (AC-1, AC-2, AC-3)', () => {
  it('records an automatic attempt with no user (system actor)', () => {
    const record = buildDeliveryRecord({ ...base, status: 'sent' });
    expect(record).toMatchObject({
      company_id: 'company-1',
      job_id: 'job-1',
      property_id: 'property-1',
      recipient: 'customer@example.com',
      status: 'sent',
      trigger_source: 'auto',
      triggered_by: null,
      attempt_count: 1,
      updated_at: '2026-11-27T12:00:00.000Z',
    });
  });

  it.each(['sent', 'failed', 'queued', 'skipped'] as const)('supports status %s', (status) => {
    expect(buildDeliveryRecord({ ...base, status }).status).toBe(status);
  });

  it('records the acting user for manual / retry attempts', () => {
    const retry = buildDeliveryRecord({
      ...base,
      status: 'queued',
      actor: { source: 'retry', userId: 'user-9' },
      attemptCount: 2,
    });
    expect(retry.trigger_source).toBe('retry');
    expect(retry.triggered_by).toBe('user-9');
    expect(retry.attempt_count).toBe(2);

    const manual = buildDeliveryRecord({
      ...base,
      status: 'sent',
      actor: { source: 'manual', userId: 'user-3' },
    });
    expect(manual.triggered_by).toBe('user-3');
  });

  it('never attaches a user to an automatic attempt', () => {
    const record = buildDeliveryRecord({
      ...base,
      status: 'sent',
      actor: { source: 'auto', userId: 'should-be-ignored' },
    });
    expect(record.triggered_by).toBeNull();
  });

  it('keeps error details for failed and skipped, clears them for sent and pending', () => {
    expect(buildDeliveryRecord({ ...base, status: 'failed', reason: 'mailbox full' }).reason).toBe(
      'mailbox full',
    );
    expect(
      buildDeliveryRecord({ ...base, status: 'skipped', reason: 'no_customer_email' }).reason,
    ).toBe('no_customer_email');
    expect(buildDeliveryRecord({ ...base, status: 'sent', reason: 'stale error' }).reason).toBeNull();
    expect(buildDeliveryRecord({ ...base, status: 'queued', reason: 'stale error' }).reason).toBeNull();
  });

  it('truncates very long error details and clamps attempt count to at least 1', () => {
    const record = buildDeliveryRecord({
      ...base,
      status: 'failed',
      reason: 'x'.repeat(2000),
      attemptCount: 0,
    });
    expect(record.reason!.length).toBeLessThanOrEqual(500);
    expect(record.attempt_count).toBe(1);
  });

  it('normalizeReason trims and returns null for blank input', () => {
    expect(normalizeReason('  boom  ')).toBe('boom');
    expect(normalizeReason('   ')).toBeNull();
    expect(normalizeReason(undefined)).toBeNull();
  });

  it('toLegacyRecord keeps only pre-migration columns', () => {
    const legacy = toLegacyRecord(buildDeliveryRecord({ ...base, status: 'sent' }));
    expect(Object.keys(legacy).sort()).toEqual(
      ['company_id', 'job_id', 'provider_message_id', 'reason', 'recipient', 'status'].sort(),
    );
  });

  it('AUTO_ACTOR is the system actor', () => {
    expect(AUTO_ACTOR).toEqual({ source: 'auto', userId: null });
  });
});

describe('isMissingColumnError', () => {
  it('detects PostgREST / Postgres missing-column errors', () => {
    expect(isMissingColumnError({ code: 'PGRST204' })).toBe(true);
    expect(isMissingColumnError({ code: '42703' })).toBe(true);
    expect(isMissingColumnError({ message: 'column "property_id" does not exist' })).toBe(true);
    expect(isMissingColumnError({ message: 'permission denied' })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});

type Call = { op: string; payload?: unknown; args?: unknown[] };

function fakeClient(opts: { failNewColumns?: boolean } = {}) {
  const calls: Call[] = [];
  const hasNewColumns = (payload: unknown) =>
    Boolean(payload && typeof payload === 'object' && 'property_id' in (payload as object));
  const client = {
    from: () => {
      const q: Record<string, unknown> = {};
      let mode = 'select';
      let payload: unknown;
      const result = () => {
        if ((mode === 'insert' || mode === 'update') && opts.failNewColumns && hasNewColumns(payload)) {
          return { data: null, error: { code: 'PGRST204', message: 'missing column' } };
        }
        return { data: { id: 'new-id' }, error: null };
      };
      q.insert = (p: unknown) => {
        mode = 'insert';
        payload = p;
        calls.push({ op: 'insert', payload: p });
        return q;
      };
      q.update = (p: unknown) => {
        mode = 'update';
        payload = p;
        calls.push({ op: 'update', payload: p });
        return q;
      };
      q.select = (cols?: string) => {
        if (mode === 'select') calls.push({ op: 'select', args: [cols] });
        return q;
      };
      q.eq = () => q;
      q.order = () => q;
      q.limit = () => q;
      q.single = async () => result();
      q.maybeSingle = async () => {
        const cols = String((calls[calls.length - 1]?.args ?? [])[0] ?? '');
        if (opts.failNewColumns && cols.includes('attempt_count')) {
          return { data: null, error: { code: '42703', message: 'column attempt_count does not exist' } };
        }
        return {
          data: cols.includes('attempt_count')
            ? { id: 'row-1', status: 'failed', attempt_count: 2 }
            : { id: 'row-1', status: 'failed' },
          error: null,
        };
      };
      q.then = (resolve: (v: unknown) => void) => resolve(result());
      return q;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('saveDelivery', () => {
  const record = buildDeliveryRecord({ ...base, status: 'sent' });

  it('inserts a new row and returns its id', async () => {
    const { client, calls } = fakeClient();
    await expect(saveDelivery(client, record)).resolves.toBe('new-id');
    expect(calls[0].op).toBe('insert');
  });

  it('updates the existing row in place without touching company_id / job_id', async () => {
    const { client, calls } = fakeClient();
    await expect(saveDelivery(client, record, 'row-1')).resolves.toBe('row-1');
    expect(calls[0].op).toBe('update');
    expect(calls[0].payload).not.toHaveProperty('company_id');
    expect(calls[0].payload).not.toHaveProperty('job_id');
    expect(calls[0].payload).toHaveProperty('triggered_by');
  });

  it('falls back to legacy columns when the migration is not applied', async () => {
    const { client, calls } = fakeClient({ failNewColumns: true });
    await expect(saveDelivery(client, record)).resolves.toBe('new-id');
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(2);
    expect(calls[1].payload).not.toHaveProperty('property_id');
    expect(calls[1].payload).toHaveProperty('status', 'sent');
  });

  it('loadLatestDelivery falls back to id,status when attempt_count is missing', async () => {
    const { client } = fakeClient({ failNewColumns: true });
    const latest = await loadLatestDelivery(client, 'job-1');
    expect(latest).toEqual({ id: 'row-1', status: 'failed', attempt_count: 1 });
  });
});
