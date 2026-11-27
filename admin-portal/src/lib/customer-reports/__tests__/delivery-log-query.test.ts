/**
 * @jest-environment node
 */
import {
  applyDeliveryLogFilters,
  dateRangeBounds,
  dbStatusesForGroup,
  formatActor,
  isRetryable,
  isUnsentStatus,
  mapDeliveryRow,
  parseDeliveryLogQuery,
  parseStatusGroup,
  sanitizeSearchTerm,
  toApiStatus,
  type DeliveryFilterChain,
  type DeliveryLogQuery,
} from '../delivery-log-query';

const COMPANY = 'c0000000-0000-4000-8000-000000000001';
const PROPERTY = 'a0000000-0000-4000-8000-000000000002';
const JOB = 'b0000000-0000-4000-8000-000000000003';

describe('status groups (AC-4)', () => {
  it('maps unsent to pending (queued) + failed', () => {
    expect(dbStatusesForGroup('unsent')).toEqual(['queued', 'failed']);
  });
  it('maps single groups and all', () => {
    expect(dbStatusesForGroup('pending')).toEqual(['queued']);
    expect(dbStatusesForGroup('sent')).toEqual(['sent']);
    expect(dbStatusesForGroup('failed')).toEqual(['failed']);
    expect(dbStatusesForGroup('skipped')).toEqual(['skipped']);
    expect(dbStatusesForGroup('all')).toBeNull();
  });
  it('falls back to all for unknown or missing values', () => {
    expect(parseStatusGroup('UNSENT')).toBe('unsent');
    expect(parseStatusGroup('bogus')).toBe('all');
    expect(parseStatusGroup(null)).toBe('all');
  });
  it('shows queued as pending and flags unsent statuses', () => {
    expect(toApiStatus('queued')).toBe('pending');
    expect(toApiStatus('sent')).toBe('sent');
    expect(isUnsentStatus('queued')).toBe(true);
    expect(isUnsentStatus('failed')).toBe(true);
    expect(isUnsentStatus('sent')).toBe(false);
    expect(isUnsentStatus('skipped')).toBe(false);
  });
});

describe('parseDeliveryLogQuery (AC-5)', () => {
  const parse = (qs: string) => parseDeliveryLogQuery(new URLSearchParams(qs));

  it('applies defaults', () => {
    const r = parse('');
    expect(r).toEqual({
      ok: true,
      query: {
        group: 'all',
        q: null,
        propertyId: null,
        jobId: null,
        dateFrom: null,
        dateTo: null,
        page: 1,
        limit: 25,
      },
    });
  });

  it('parses filters and clamps pagination', () => {
    const r = parse(
      `status=unsent&q=Pool+Lane&property_id=${PROPERTY}&job_id=${JOB}&date_from=2026-11-01&date_to=2026-11-30&page=3&limit=500`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.query).toMatchObject({
        group: 'unsent',
        q: 'Pool Lane',
        propertyId: PROPERTY,
        jobId: JOB,
        dateFrom: '2026-11-01',
        dateTo: '2026-11-30',
        page: 3,
        limit: 100,
      });
    }
    const low = parse('page=-4&limit=0');
    expect(low.ok && low.query.page).toBe(1);
    expect(low.ok && low.query.limit).toBe(1);
  });

  it('rejects malformed ids and dates', () => {
    expect(parse('property_id=not-a-uuid')).toEqual({ ok: false, error: 'property_id must be a UUID' });
    expect(parse('job_id=1;drop')).toEqual({ ok: false, error: 'job_id must be a UUID' });
    expect(parse('date_from=11/01/2026')).toEqual({ ok: false, error: 'date_from must be YYYY-MM-DD' });
    expect(parse('date_to=2026-13-45').ok).toBe(false);
    expect(parse('date_from=2026-12-01&date_to=2026-11-01').ok).toBe(false);
  });

  it('sanitizes search text so it cannot break the filter string', () => {
    expect(sanitizeSearchTerm('a,b)(c*%_"\'d')).toBe('a b c d');
    expect(sanitizeSearchTerm('   ')).toBeNull();
    expect(sanitizeSearchTerm('x'.repeat(200))!.length).toBe(80);
    expect(sanitizeSearchTerm('jane@example.com')).toBe('jane@example.com');
  });
});

type Call = [string, ...unknown[]];

function recorder() {
  const calls: Call[] = [];
  const chain: DeliveryFilterChain = {
    eq: (...a) => (calls.push(['eq', ...a]), chain),
    in: (...a) => (calls.push(['in', ...a]), chain),
    gte: (...a) => (calls.push(['gte', ...a]), chain),
    lt: (...a) => (calls.push(['lt', ...a]), chain),
    or: (...a) => (calls.push(['or', ...a]), chain),
  };
  return { chain, calls };
}

const emptyQuery: DeliveryLogQuery = {
  group: 'all',
  q: null,
  propertyId: null,
  jobId: null,
  dateFrom: null,
  dateTo: null,
  page: 1,
  limit: 25,
};

describe('applyDeliveryLogFilters (AC-4, AC-5, AC-6)', () => {
  it('always scopes by company_id', () => {
    const { chain, calls } = recorder();
    applyDeliveryLogFilters(chain, COMPANY, emptyQuery);
    expect(calls).toEqual([['eq', 'company_id', COMPANY]]);
  });

  it('unsent filter selects pending + failed only', () => {
    const { chain, calls } = recorder();
    applyDeliveryLogFilters(chain, COMPANY, { ...emptyQuery, group: 'unsent' });
    expect(calls).toContainEqual(['in', 'status', ['queued', 'failed']]);
  });

  it('filters by property and job', () => {
    const { chain, calls } = recorder();
    applyDeliveryLogFilters(chain, COMPANY, { ...emptyQuery, propertyId: PROPERTY, jobId: JOB });
    expect(calls).toContainEqual(['eq', 'property_id', PROPERTY]);
    expect(calls).toContainEqual(['eq', 'job_id', JOB]);
  });

  it('applies an inclusive date range on created_at', () => {
    const { chain, calls } = recorder();
    applyDeliveryLogFilters(chain, COMPANY, {
      ...emptyQuery,
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
    });
    expect(calls).toContainEqual(['gte', 'created_at', '2026-11-01T00:00:00.000Z']);
    expect(calls).toContainEqual(['lt', 'created_at', '2026-12-01T00:00:00.000Z']);
  });

  it('searches recipient and matching property ids', () => {
    const { chain, calls } = recorder();
    applyDeliveryLogFilters(chain, COMPANY, { ...emptyQuery, q: 'pool lane' }, [PROPERTY, 'bad,id']);
    expect(calls).toContainEqual([
      'or',
      `recipient.ilike.%pool lane%,property_id.in.(${PROPERTY})`,
    ]);
  });

  it('searches recipient only when no property matched', () => {
    const { chain, calls } = recorder();
    applyDeliveryLogFilters(chain, COMPANY, { ...emptyQuery, q: 'jane@example.com' }, []);
    expect(calls).toContainEqual(['or', 'recipient.ilike.%jane@example.com%']);
  });

  it('dateRangeBounds handles open ranges and month rollover', () => {
    expect(dateRangeBounds(null, null)).toEqual({ gte: null, lt: null });
    expect(dateRangeBounds(null, '2026-12-31').lt).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('row mapping', () => {
  const now = new Date('2026-11-27T12:00:00.000Z');

  it('formats the system actor for automatic attempts', () => {
    expect(formatActor({ trigger_source: 'auto', triggered_by: null, actor: null })).toEqual({
      type: 'system',
      user_id: null,
      name: null,
    });
    // Legacy rows have no trigger_source: treated as automatic.
    expect(formatActor({ triggered_by: null, actor: null }).type).toBe('system');
  });

  it('formats a user actor with the profile name (embedded as object or array)', () => {
    const asObject = formatActor({
      trigger_source: 'retry',
      triggered_by: 'u1',
      actor: { full_name: 'Office Admin' },
    });
    expect(asObject).toEqual({ type: 'user', user_id: 'u1', name: 'Office Admin' });
    const asArray = formatActor({
      trigger_source: 'manual',
      triggered_by: 'u1',
      actor: [{ full_name: 'Office Admin' }],
    });
    expect(asArray.name).toBe('Office Admin');
  });

  it('retry rules: failed always, pending only when not mid-send, sent/skipped never', () => {
    expect(isRetryable('failed', now.toISOString(), now)).toBe(true);
    expect(isRetryable('queued', '2026-11-27T11:59:30.000Z', now)).toBe(false);
    expect(isRetryable('queued', '2026-11-27T11:00:00.000Z', now)).toBe(true);
    expect(isRetryable('sent', null, now)).toBe(false);
    expect(isRetryable('skipped', null, now)).toBe(false);
  });

  it('maps a joined row to a log entry', () => {
    const entry = mapDeliveryRow(
      {
        id: 'd1',
        job_id: JOB,
        property_id: PROPERTY,
        recipient: 'customer@example.com',
        status: 'queued',
        reason: null,
        attempt_count: 2,
        trigger_source: 'auto',
        triggered_by: null,
        created_at: '2026-11-27T10:00:00.000Z',
        updated_at: '2026-11-27T10:05:00.000Z',
        job: { id: JOB, scheduled_date: '2026-11-27', status: 'completed' },
        property: { id: PROPERTY, customer_name: 'QA Pool Customer', address: '100 Test Pool Lane', city: 'Austin' },
      },
      now,
    );
    expect(entry).toMatchObject({
      id: 'd1',
      status: 'pending',
      attempt_count: 2,
      can_retry: true,
      actor: { type: 'system' },
      job: { id: JOB, scheduled_date: '2026-11-27' },
      property: { id: PROPERTY, customer_name: 'QA Pool Customer' },
    });
  });

  it('tolerates legacy rows without property or new columns', () => {
    const entry = mapDeliveryRow(
      {
        id: 'd2',
        job_id: JOB,
        recipient: null,
        status: 'skipped',
        reason: 'no_customer_email',
        created_at: '2026-11-27T10:00:00.000Z',
      },
      now,
    );
    expect(entry.property).toBeNull();
    expect(entry.attempt_count).toBe(1);
    expect(entry.updated_at).toBe('2026-11-27T10:00:00.000Z');
    expect(entry.can_retry).toBe(false);
  });
});
