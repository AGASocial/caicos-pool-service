/** Shared fixture for KAN-155 last-service tests (generic labels only, two companies). */
import type { FakeDb } from './fake-supabase';

export const LS = {
  companyA: '00000000-0000-4000-8000-0000000000a1',
  companyB: '00000000-0000-4000-8000-0000000000b1',
  officeA: '00000000-0000-4000-8000-00000000a001',
  techA: '00000000-0000-4000-8000-00000000a002',
  techB: '00000000-0000-4000-8000-00000000a003',
  officeB: '00000000-0000-4000-8000-00000000b001',
  sharedProp: '00000000-0000-4000-8000-0000000000c1',
  plainProp: '00000000-0000-4000-8000-0000000000c2',
  emptySharedProp: '00000000-0000-4000-8000-0000000000c3',
  foreignProp: '00000000-0000-4000-8000-0000000000c4',
  jobOld: '00000000-0000-4000-8000-0000000000d1',
  jobPrev: '00000000-0000-4000-8000-0000000000d2',
  jobCurrent: '00000000-0000-4000-8000-0000000000d3',
  jobDeleted: '00000000-0000-4000-8000-0000000000d4',
  jobPending: '00000000-0000-4000-8000-0000000000d5',
  jobPlain: '00000000-0000-4000-8000-0000000000d6',
  jobForeign: '00000000-0000-4000-8000-0000000000d7',
  jobOnlyCurrent: '00000000-0000-4000-8000-0000000000d8',
} as const;

const job = (id: string, company: string, property: string, extra: Record<string, unknown> = {}) => ({
  id,
  company_id: company,
  property_id: property,
  status: 'completed',
  is_deleted: false,
  scheduled_date: '2026-11-10',
  ...extra,
});

const report = (id: string, jobId: string, company: string, tech: string, extra: Record<string, unknown> = {}) => ({
  id,
  job_id: jobId,
  company_id: company,
  technician_id: tech,
  is_deleted: false,
  created_at: '2026-11-10T15:00:00Z',
  cleaned_filter: false,
  backwashed: false,
  salt_level: null,
  service_event_types: [],
  // Fields that must never appear in the last-service payload.
  notes: 'private notes',
  follow_up_notes: 'private follow-up',
  voice_transcript: 'private transcript',
  customer_email: 'customer@example.invalid',
  ...extra,
});

export function makeLastServiceDb(): FakeDb {
  return {
    cadenza_profiles: [
      { id: LS.officeA, company_id: LS.companyA, role: 'admin', full_name: 'Office A' },
      { id: LS.techA, company_id: LS.companyA, role: 'technician', full_name: 'Tech A' },
      { id: LS.techB, company_id: LS.companyA, role: 'technician', full_name: 'qa-billing-tech-b@example.invalid' },
      { id: LS.officeB, company_id: LS.companyB, role: 'owner', full_name: 'Office B' },
    ],
    cadenza_properties: [
      { id: LS.sharedProp, company_id: LS.companyA, customer_name: 'QA Billing Shared', is_shared: true },
      { id: LS.plainProp, company_id: LS.companyA, customer_name: 'QA Billing Plain', is_shared: false },
      { id: LS.emptySharedProp, company_id: LS.companyA, customer_name: 'QA Billing Empty', is_shared: true },
      { id: LS.foreignProp, company_id: LS.companyB, customer_name: 'QA Billing Foreign', is_shared: true },
    ],
    cadenza_service_jobs: [
      job(LS.jobOld, LS.companyA, LS.sharedProp, { scheduled_date: '2026-11-03' }),
      job(LS.jobPrev, LS.companyA, LS.sharedProp, { scheduled_date: '2026-11-10' }),
      job(LS.jobCurrent, LS.companyA, LS.sharedProp, { scheduled_date: '2026-11-17', status: 'pending' }),
      job(LS.jobDeleted, LS.companyA, LS.sharedProp, { scheduled_date: '2026-11-14', is_deleted: true }),
      job(LS.jobPending, LS.companyA, LS.sharedProp, { scheduled_date: '2026-11-15', status: 'in_progress' }),
      job(LS.jobPlain, LS.companyA, LS.plainProp, { scheduled_date: '2026-11-10' }),
      job(LS.jobForeign, LS.companyB, LS.foreignProp, { scheduled_date: '2026-11-12' }),
      job(LS.jobOnlyCurrent, LS.companyA, LS.emptySharedProp, { scheduled_date: '2026-11-17' }),
    ],
    cadenza_service_reports: [
      report('r-old', LS.jobOld, LS.companyA, LS.techB, { cleaned_filter: false, salt_level: 2500 }),
      report('r-prev', LS.jobPrev, LS.companyA, LS.techA, {
        cleaned_filter: true,
        backwashed: true,
        salt_level: 3100,
        service_event_types: ['filter_cleaning', 'salt_addition', 'chemical_reading'],
      }),
      report('r-deleted-job', LS.jobDeleted, LS.companyA, LS.techB, { cleaned_filter: true }),
      report('r-in-progress', LS.jobPending, LS.companyA, LS.techB, { cleaned_filter: true }),
      report('r-plain', LS.jobPlain, LS.companyA, LS.techA, { cleaned_filter: true }),
      report('r-foreign', LS.jobForeign, LS.companyB, LS.officeB, { cleaned_filter: true, salt_level: 999 }),
      report('r-only-current', LS.jobOnlyCurrent, LS.companyA, LS.techA, { cleaned_filter: true }),
    ],
  };
}
