import {
  GENERIC_TECHNICIAN_NAME,
  LAST_SERVICE_FIELDS,
  LastServiceSchemaPendingError,
  buildLastServiceResponse,
  fetchLastService,
  loadSharedFlag,
  pickLastService,
  technicianDisplayName,
  toLastService,
  type LastServiceJobRow,
  type LastServiceReportRow,
} from '../last-service';
import {
  LAST_SERVICE_FIELDS as TECH_FIELDS,
  lastServiceFacts,
  pickLastServicePair as techPick,
  safeTechnicianName,
  shouldShowLastService,
  toLastService as techToLastService,
} from '../../../../technician-app/lib/lastServiceCore';
import { createFakeSupabase } from '@/test-utils/fake-supabase';
import { LS, makeLastServiceDb } from '@/test-utils/last-service-fixtures';
import type { SupabaseClient } from '@supabase/supabase-js';

const asClient = (c: unknown) => c as SupabaseClient;

const job = (id: string, scheduled_date: string, extra: Partial<LastServiceJobRow> = {}): LastServiceJobRow => ({
  id,
  scheduled_date,
  status: 'completed',
  is_deleted: false,
  ...extra,
});
const rep = (job_id: string, extra: Partial<LastServiceReportRow> = {}): LastServiceReportRow => ({
  job_id,
  technician_id: 't1',
  created_at: '2026-11-01T10:00:00Z',
  is_deleted: false,
  ...extra,
});

describe('pickLastService (AC-2 / AC-3)', () => {
  it('newest completed visit wins by scheduled_date', () => {
    const result = pickLastService(
      [job('a', '2026-11-03'), job('b', '2026-11-10'), job('c', '2026-11-07')],
      [rep('a'), rep('b', { cleaned_filter: true }), rep('c')],
    );
    expect(result?.job_id).toBe('b');
    expect(result?.cleaned_filter).toBe(true);
  });

  it('same-day visits: latest report created_at wins', () => {
    const result = pickLastService(
      [job('a', '2026-11-10'), job('b', '2026-11-10')],
      [rep('a', { created_at: '2026-11-10T09:00:00Z' }), rep('b', { created_at: '2026-11-10T16:00:00Z' })],
    );
    expect(result?.job_id).toBe('b');
  });

  it('excludes the current job even when it is the newest and has a report', () => {
    const result = pickLastService(
      [job('prev', '2026-11-03'), job('cur', '2026-11-10')],
      [rep('prev'), rep('cur', { cleaned_filter: true })],
      { currentJobId: 'cur' },
    );
    expect(result?.job_id).toBe('prev');
  });

  it('returns null when the only report belongs to the current job', () => {
    expect(pickLastService([job('cur', '2026-11-10')], [rep('cur')], { currentJobId: 'cur' })).toBeNull();
  });

  it('ignores soft-deleted jobs and reports and non-completed jobs', () => {
    const result = pickLastService(
      [
        job('deleted-job', '2026-11-12', { is_deleted: true }),
        job('pending', '2026-11-11', { status: 'in_progress' }),
        job('deleted-report', '2026-11-10'),
        job('ok', '2026-11-01'),
      ],
      [rep('deleted-job'), rep('pending'), rep('deleted-report', { is_deleted: true }), rep('ok')],
    );
    expect(result?.job_id).toBe('ok');
  });

  it('returns null with no prior completed visit', () => {
    expect(pickLastService([], [])).toBeNull();
    expect(pickLastService([job('a', '2026-11-01')], [])).toBeNull();
  });

  it('resolves the technician name and never exposes an email', () => {
    const jobs = [job('a', '2026-11-01')];
    const reports = [rep('a', { technician_id: 't1' })];
    expect(pickLastService(jobs, reports, { technicianNames: { t1: 'Tech A' } })?.technician_name).toBe('Tech A');
    expect(pickLastService(jobs, reports, { technicianNames: { t1: 'a@example.invalid' } })?.technician_name).toBe(
      GENERIC_TECHNICIAN_NAME,
    );
    expect(pickLastService(jobs, reports)?.technician_name).toBe(GENERIC_TECHNICIAN_NAME);
  });
});

describe('payload allow-list', () => {
  const dirtyReport = {
    ...rep('a', { cleaned_filter: true, backwashed: false, salt_level: '3050.5' }),
    notes: 'private',
    follow_up_notes: 'private',
    transcript: 'private',
    customer_email: 'x@example.invalid',
    photos: ['p'],
    service_event_types: ['filter_cleaning', 'chemical_reading', 'o_ring_replacement'],
  } as LastServiceReportRow;

  it('contains exactly the allow-listed keys and only relevant event types', () => {
    const out = toLastService(job('a', '2026-11-01'), dirtyReport, 'Tech A');
    expect(Object.keys(out).sort()).toEqual([...LAST_SERVICE_FIELDS].sort());
    expect(out.service_event_types).toEqual(['filter_cleaning']);
    expect(out.salt_level).toBe(3050.5);
    expect(JSON.stringify(out)).not.toMatch(/private|example\.invalid/);
  });

  it('normalizes missing values', () => {
    const out = toLastService(job('a', '2026-11-01'), rep('a', { salt_level: null, cleaned_filter: null }), '  ');
    expect(out).toMatchObject({ cleaned_filter: false, backwashed: false, salt_level: null });
    expect(out.technician_name).toBe(GENERIC_TECHNICIAN_NAME);
  });

  it('technicianDisplayName trims names and rejects emails', () => {
    expect(technicianDisplayName(' Tech A ')).toBe('Tech A');
    expect(technicianDisplayName('tech@example.invalid')).toBe(GENERIC_TECHNICIAN_NAME);
    expect(technicianDisplayName(null)).toBe(GENERIC_TECHNICIAN_NAME);
  });

  it('non-shared => null', () => {
    const summary = toLastService(job('a', '2026-11-01'), rep('a', { cleaned_filter: true }), 'Tech A');
    expect(buildLastServiceResponse(false, summary)).toEqual({ is_shared: false, last_service: null });
    expect(buildLastServiceResponse(true, summary)).toEqual({ is_shared: true, last_service: summary });
    expect(buildLastServiceResponse(true, null)).toEqual({ is_shared: true, last_service: null });
  });
});

describe('fetchLastService (same company only)', () => {
  const run = (propertyId: string, currentJobId?: string, companyId: string = LS.companyA) =>
    fetchLastService(asClient(createFakeSupabase(makeLastServiceDb())), companyId, propertyId, currentJobId);

  it('AC-2: returns the previous completed visit with allow-listed fields and technician name', async () => {
    const out = await run(LS.sharedProp, LS.jobCurrent);
    expect(out).toEqual({
      job_id: LS.jobPrev,
      scheduled_date: '2026-11-10',
      technician_name: 'Tech A',
      cleaned_filter: true,
      backwashed: true,
      salt_level: 3100,
      service_event_types: ['filter_cleaning', 'salt_addition'],
    });
    expect(JSON.stringify(out)).not.toMatch(/private|example\.invalid/);
  });

  it('skips deleted / in-progress jobs without a job id too', async () => {
    expect((await run(LS.sharedProp))?.job_id).toBe(LS.jobPrev);
  });

  it('AC-3: null when the only completed report is the current job', async () => {
    expect(await run(LS.emptySharedProp, LS.jobOnlyCurrent)).toBeNull();
  });

  it('never reads another company\'s visits', async () => {
    expect(await run(LS.foreignProp, undefined, LS.companyA)).toBeNull();
    expect((await run(LS.foreignProp, undefined, LS.companyB))?.job_id).toBe(LS.jobForeign);
  });

  it('loadSharedFlag is company scoped: foreign property is null, others report the flag', async () => {
    const client = asClient(createFakeSupabase(makeLastServiceDb()));
    expect(await loadSharedFlag(client, LS.companyA, LS.foreignProp)).toBeNull();
    expect(await loadSharedFlag(client, LS.companyA, LS.sharedProp)).toBe(true);
    expect(await loadSharedFlag(client, LS.companyA, LS.plainProp)).toBe(false);
  });

  it('fails clearly (SCHEMA_PENDING) when the is_shared column is missing', async () => {
    const client = asClient(createFakeSupabase(makeLastServiceDb(), { missingColumns: ['is_shared'] }));
    await expect(loadSharedFlag(client, LS.companyA, LS.sharedProp)).rejects.toBeInstanceOf(
      LastServiceSchemaPendingError,
    );
  });
});

describe('technician-app mirror stays in sync', () => {
  it('uses the same payload allow-list', () => {
    expect([...TECH_FIELDS]).toEqual([...LAST_SERVICE_FIELDS]);
  });

  it('picks the same visit and builds the same payload as the admin helper', () => {
    const db = makeLastServiceDb();
    const jobs = db.cadenza_service_jobs.filter((j) => j.property_id === LS.sharedProp) as unknown as LastServiceJobRow[];
    const reports = db.cadenza_service_reports as unknown as LastServiceReportRow[];
    const adminPick = pickLastService(jobs, reports, { currentJobId: LS.jobCurrent, technicianNames: { [LS.techA]: 'Tech A' } });
    const pair = techPick(jobs, reports, LS.jobCurrent);
    expect(pair).not.toBeNull();
    expect(techToLastService(pair!.job, pair!.report, 'Tech A')).toEqual(adminPick);
  });

  it('shows the card only for shared properties with a prior visit; names never expose email', () => {
    const summary = techToLastService(job('a', '2026-11-01'), rep('a'), 'Tech A');
    expect(shouldShowLastService(true, summary)).toBe(true);
    expect(shouldShowLastService(false, summary)).toBe(false);
    expect(shouldShowLastService(true, null)).toBe(false);
    expect(safeTechnicianName('a@example.invalid')).toBeNull();
    expect(safeTechnicianName(' Tech A ')).toBe('Tech A');
  });

  it('lastServiceFacts treats a filter_cleaning event as a cleaned filter', () => {
    const summary = techToLastService(
      job('a', '2026-11-01'),
      rep('a', { cleaned_filter: false, salt_level: 2900, service_event_types: ['filter_cleaning'] }),
      'Tech A',
    );
    expect(lastServiceFacts(summary)).toEqual({ cleanedFilter: true, backwashed: false, saltLevel: 2900 });
  });
});
