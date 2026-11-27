/**
 * @jest-environment node
 */

type Row = Record<string, unknown>;

const mockState: {
  tables: Record<string, Row[]>;
  /** When set, writes containing these columns fail like a pre-migration schema. */
  missingColumns: string[];
  idSeq: number;
} = { tables: {}, missingColumns: [], idSeq: 0 };

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private mode: 'select' | 'insert' | 'update' = 'select';
  private payload: Row = {};
  private filters: Array<(r: Row) => boolean> = [];
  private columns = '';
  private orderCol: string | null = null;
  private ascending = true;
  private max = Infinity;
  private returning = false;

  constructor(private table: string) {}

  select(cols = '') {
    if (this.mode === 'select') this.columns = cols;
    else this.returning = true;
    return this;
  }
  insert(p: Row) {
    this.mode = 'insert';
    this.payload = p;
    return this;
  }
  update(p: Row) {
    this.mode = 'update';
    this.payload = p;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.ascending = opts?.ascending ?? true;
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    return Promise.resolve(this.run(true));
  }
  maybeSingle() {
    return Promise.resolve(this.run(true));
  }
  then<T1, T2>(
    onfulfilled?: ((v: { data: unknown; error: unknown }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ) {
    return Promise.resolve(this.run(false)).then(onfulfilled, onrejected);
  }

  private run(single: boolean): { data: unknown; error: unknown } {
    const rows = (mockState.tables[this.table] ??= []);
    const writeKeys = Object.keys(this.payload);
    const selectKeys = this.columns.split(',').map((c) => c.trim());
    const bad = (keys: string[]) => keys.some((k) => mockState.missingColumns.includes(k));
    // Only the delivery log table is "pre-migration"; other tables keep all their columns.
    if (
      this.table === 'customer_report_deliveries' &&
      ((this.mode !== 'select' && bad(writeKeys)) || (this.mode === 'select' && bad(selectKeys)))
    ) {
      return { data: null, error: { code: '42703', message: 'column does not exist' } };
    }

    if (this.mode === 'insert') {
      const row = { id: `row-${++mockState.idSeq}`, created_at: new Date().toISOString(), ...this.payload };
      rows.push(row);
      return { data: single ? { id: row.id } : [row], error: null };
    }
    if (this.mode === 'update') {
      const hit = rows.filter((r) => this.filters.every((f) => f(r)));
      hit.forEach((r) => Object.assign(r, this.payload));
      return { data: single ? hit[0] ?? null : hit, error: null };
    }
    let out = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.orderCol) {
      const col = this.orderCol;
      out = [...out].sort((a, b) =>
        String(a[col]) < String(b[col]) ? (this.ascending ? -1 : 1) : this.ascending ? 1 : -1,
      );
    }
    out = out.slice(0, this.max);
    return { data: single ? out[0] ?? null : out, error: null };
  }
}

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (table: string) => new FakeQuery(table) },
}));
jest.mock('../mailer', () => ({ sendCustomerReportEmail: jest.fn() }));

import { sendCustomerReportEmail } from '../mailer';
import { processCustomerReportForJob, processPendingCustomerReports } from '../process';
import { MAX_AUTO_ATTEMPTS } from '../delivery-log';

const mailer = sendCustomerReportEmail as jest.Mock;

const COMPANY = 'company-1';
const OTHER_COMPANY = 'company-2';
const JOB = 'job-1';
const PROPERTY = 'property-1';

function seedJob(overrides: Row = {}, property: Row = {}) {
  mockState.tables.cadenza_service_jobs = [
    {
      id: JOB,
      company_id: COMPANY,
      property_id: PROPERTY,
      status: 'completed',
      scheduled_date: '2026-11-27',
      has_paid_extras: false,
      send_paid_extra_report: false,
      is_deleted: false,
      updated_at: '2026-11-27T10:00:00.000Z',
      property: {
        customer_name: 'QA Pool Customer',
        customer_email: 'customer@example.com',
        address: '100 Test Pool Lane',
        ...property,
      },
      technician: { full_name: 'QA Technician' },
      company: { name: 'QA Pool Co' },
      ...overrides,
    },
  ];
  mockState.tables.cadenza_service_reports = [
    { job_id: JOB, service_event_types: ['filter_change'], created_at: '2026-11-27T09:00:00.000Z' },
  ];
  mockState.tables.cadenza_customer_report_settings = [];
}

const deliveries = () => mockState.tables.customer_report_deliveries ?? [];

describe('delivery log recording in processCustomerReportForJob', () => {
  const original = process.env.CUSTOMER_AUTO_REPORTS_ENABLED;

  beforeEach(() => {
    mockState.tables = {};
    mockState.missingColumns = [];
    mockState.idSeq = 0;
    process.env.CUSTOMER_AUTO_REPORTS_ENABLED = 'true';
    mailer.mockReset();
    mailer.mockResolvedValue({ ok: true, messageId: 'msg-1' });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    seedJob();
  });

  afterAll(() => {
    if (original === undefined) delete process.env.CUSTOMER_AUTO_REPORTS_ENABLED;
    else process.env.CUSTOMER_AUTO_REPORTS_ENABLED = original;
  });

  it('AC-1: records an automatic sent attempt with recipient, job, property and system actor', async () => {
    const result = await processCustomerReportForJob(JOB);

    expect(result.status).toBe('sent');
    expect(deliveries()).toHaveLength(1);
    expect(deliveries()[0]).toMatchObject({
      company_id: COMPANY,
      job_id: JOB,
      property_id: PROPERTY,
      recipient: 'customer@example.com',
      status: 'sent',
      reason: null,
      provider_message_id: 'msg-1',
      trigger_source: 'auto',
      triggered_by: null,
      attempt_count: 1,
    });
    expect(deliveries()[0].updated_at).toEqual(expect.any(String));
  });

  it('AC-1: writes a pending row before the email is sent, then updates the same row', async () => {
    let statusDuringSend: unknown;
    mailer.mockImplementation(async () => {
      statusDuringSend = deliveries()[0]?.status;
      return { ok: true, messageId: 'msg-2' };
    });

    await processCustomerReportForJob(JOB);

    expect(statusDuringSend).toBe('queued');
    expect(deliveries()).toHaveLength(1);
    expect(deliveries()[0].status).toBe('sent');
  });

  it('AC-1/AC-3: records a failed attempt with error details', async () => {
    mailer.mockResolvedValue({ ok: false, error: 'mailbox unavailable' });

    const result = await processCustomerReportForJob(JOB);

    expect(result).toMatchObject({ status: 'failed', reason: 'mailbox unavailable' });
    expect(deliveries()[0]).toMatchObject({
      status: 'failed',
      reason: 'mailbox unavailable',
      trigger_source: 'auto',
      attempt_count: 1,
    });
  });

  it('AC-3: a provider that throws is recorded as failed, not left pending', async () => {
    mailer.mockRejectedValue(new Error('network down'));

    const result = await processCustomerReportForJob(JOB);

    expect(result.status).toBe('failed');
    expect(deliveries()[0]).toMatchObject({ status: 'failed', reason: 'network down' });
  });

  it('AC-1: records a skipped attempt when the customer has no email', async () => {
    seedJob({}, { customer_email: null });

    const result = await processCustomerReportForJob(JOB);

    expect(result).toMatchObject({ status: 'skipped', reason: 'no_customer_email' });
    expect(deliveries()[0]).toMatchObject({
      status: 'skipped',
      reason: 'no_customer_email',
      recipient: null,
      property_id: PROPERTY,
    });
    expect(mailer).not.toHaveBeenCalled();
  });

  it('AC-1: records skipped / auto_send_disabled when the kill switch is off', async () => {
    delete process.env.CUSTOMER_AUTO_REPORTS_ENABLED;

    await processCustomerReportForJob(JOB);

    expect(deliveries()[0]).toMatchObject({ status: 'skipped', reason: 'auto_send_disabled' });
    expect(mailer).not.toHaveBeenCalled();
  });

  it('AC-2: a manual retry records the acting user and updates the existing row in place', async () => {
    mailer.mockResolvedValueOnce({ ok: false, error: 'temporary failure' });
    await processCustomerReportForJob(JOB);
    expect(deliveries()[0]).toMatchObject({ status: 'failed', trigger_source: 'auto' });
    const firstId = deliveries()[0].id;

    mailer.mockResolvedValueOnce({ ok: true, messageId: 'msg-3' });
    const result = await processCustomerReportForJob(JOB, {
      actor: { source: 'retry', userId: 'user-42' },
      companyId: COMPANY,
    });

    expect(result.status).toBe('sent');
    expect(deliveries()).toHaveLength(1);
    expect(deliveries()[0]).toMatchObject({
      id: firstId,
      status: 'sent',
      reason: null,
      trigger_source: 'retry',
      triggered_by: 'user-42',
      attempt_count: 2,
    });
  });

  it('AC-8: automatic processing stops after the retry cap; manual retry still works', async () => {
    mockState.tables.customer_report_deliveries = [
      {
        id: 'row-existing',
        company_id: COMPANY,
        job_id: JOB,
        status: 'failed',
        reason: 'still failing',
        attempt_count: MAX_AUTO_ATTEMPTS,
        trigger_source: 'auto',
        created_at: '2026-11-27T08:00:00.000Z',
      },
    ];

    const auto = await processCustomerReportForJob(JOB);
    expect(auto).toMatchObject({ status: 'failed', reason: 'auto_retry_limit' });
    expect(mailer).not.toHaveBeenCalled();

    const manual = await processCustomerReportForJob(JOB, {
      actor: { source: 'retry', userId: 'user-42' },
    });
    expect(manual.status).toBe('sent');
    expect(deliveries()[0]).toMatchObject({ attempt_count: MAX_AUTO_ATTEMPTS + 1, triggered_by: 'user-42' });
  });

  it('AC-8: the cron scan leaves capped failures for manual retry', async () => {
    mockState.tables.customer_report_deliveries = [
      {
        id: 'row-existing',
        company_id: COMPANY,
        job_id: JOB,
        status: 'failed',
        attempt_count: MAX_AUTO_ATTEMPTS,
        trigger_source: 'auto',
        created_at: '2026-11-27T08:00:00.000Z',
      },
    ];

    const out = await processPendingCustomerReports(10);

    expect(out.processed).toBe(0);
    expect(mailer).not.toHaveBeenCalled();
  });

  it('AC-6: refuses to process a job that belongs to another company', async () => {
    const result = await processCustomerReportForJob(JOB, {
      companyId: OTHER_COMPANY,
      actor: { source: 'retry', userId: 'user-42' },
    });

    expect(result).toMatchObject({ status: 'skipped', reason: 'job_not_found' });
    expect(mailer).not.toHaveBeenCalled();
    expect(deliveries()).toHaveLength(0);
  });

  it('does not re-send once a delivery is sent (idempotent)', async () => {
    await processCustomerReportForJob(JOB);
    mailer.mockClear();

    const again = await processCustomerReportForJob(JOB, {
      actor: { source: 'retry', userId: 'user-42' },
    });

    expect(again.status).toBe('already_processed');
    expect(mailer).not.toHaveBeenCalled();
    expect(deliveries()).toHaveLength(1);
  });

  it('keeps sending and logging with legacy columns when the migration is not applied (rollout safety)', async () => {
    mockState.missingColumns = ['property_id', 'trigger_source', 'triggered_by', 'attempt_count', 'updated_at'];

    const result = await processCustomerReportForJob(JOB);

    expect(result.status).toBe('sent');
    expect(deliveries()).toHaveLength(1);
    expect(deliveries()[0]).toMatchObject({ status: 'sent', recipient: 'customer@example.com' });
    expect(deliveries()[0]).not.toHaveProperty('property_id');
  });
});
