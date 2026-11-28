/** Shared fixture for KAN-153 open-issue tests (generic labels only). */
import type { FakeDb } from './fake-supabase';

/** Local-noon ISO timestamp `n` calendar days ago, so daysOpen() === n in any time zone. */
export function daysAgoIso(n: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, 12, 0, 0).toISOString();
}

export const IDS = {
  officeA: 'office-a',
  officeB: 'office-b',
  techLate: 'tech-late',
  techOrigin: 'tech-origin',
  techUnassigned: 'tech-unassigned',
  jobOrigin: 'job-origin',
  jobLate: 'job-late',
  jobOtherProperty: 'job-other-property',
  jobVoiceOnly: 'job-voice-only',
  jobCompanyB: 'job-company-b',
  prop1: 'prop-1',
  prop2: 'prop-2',
  propB: 'prop-b',
} as const;

export function makeOpenIssueDb(): FakeDb {
  const job = (id: string, company: string, property: string, tech: string | null, extra = {}) => ({
    id,
    company_id: company,
    property_id: property,
    technician_id: tech,
    is_deleted: false,
    status: 'pending',
    scheduled_date: '2026-11-20',
    scheduled_time: null,
    route_id: null,
    job_source: 'route',
    ...extra,
  });

  return {
    cadenza_profiles: [
      { id: IDS.officeA, company_id: 'co-a', role: 'admin', full_name: 'Office A' },
      { id: IDS.techLate, company_id: 'co-a', role: 'technician', full_name: 'Tech Late' },
      { id: IDS.techOrigin, company_id: 'co-a', role: 'technician', full_name: 'Tech Origin' },
      { id: IDS.techUnassigned, company_id: 'co-a', role: 'technician', full_name: 'Tech Unassigned' },
      { id: IDS.officeB, company_id: 'co-b', role: 'owner', full_name: 'Office B' },
    ],
    cadenza_properties: [
      { id: IDS.prop1, company_id: 'co-a', customer_name: 'QA Billing Property 1', address: '1 Test St' },
      { id: IDS.prop2, company_id: 'co-a', customer_name: 'QA Billing Property 2', address: '2 Test St' },
      { id: IDS.propB, company_id: 'co-b', customer_name: 'QA Billing Property B', address: '3 Test St' },
    ],
    cadenza_service_jobs: [
      job(IDS.jobOrigin, 'co-a', IDS.prop1, IDS.techOrigin, { status: 'completed', scheduled_date: '2026-11-10' }),
      job(IDS.jobLate, 'co-a', IDS.prop1, IDS.techLate, { scheduled_date: '2026-11-27' }),
      job(IDS.jobOtherProperty, 'co-a', IDS.prop2, IDS.techLate, { scheduled_date: '2026-11-27' }),
      job(IDS.jobVoiceOnly, 'co-a', IDS.prop2, IDS.techOrigin, { status: 'completed', scheduled_date: '2026-11-22' }),
      job(IDS.jobCompanyB, 'co-b', IDS.propB, null, { scheduled_date: '2026-11-27' }),
    ],
    cadenza_service_reports: [
      {
        id: 'report-open',
        company_id: 'co-a',
        job_id: IDS.jobOrigin,
        follow_up_status: 'open',
        follow_up_needed: true,
        issue_categories: ['motor'],
        follow_up_notes: 'Motor hums',
        is_deleted: false,
        created_at: daysAgoIso(10),
        last_reviewed_at: null,
      },
      {
        id: 'report-resolved',
        company_id: 'co-a',
        job_id: IDS.jobOrigin,
        follow_up_status: 'resolved',
        follow_up_needed: true,
        issue_categories: [],
        follow_up_notes: null,
        is_deleted: false,
        created_at: daysAgoIso(40),
        last_reviewed_at: null,
      },
      {
        id: 'report-company-b',
        company_id: 'co-b',
        job_id: IDS.jobCompanyB,
        follow_up_status: 'open',
        follow_up_needed: true,
        issue_categories: ['filter'],
        follow_up_notes: 'Other company',
        is_deleted: false,
        created_at: daysAgoIso(50),
        last_reviewed_at: null,
      },
    ],
    cadenza_job_voice_notes: [
      {
        id: 'note-open',
        company_id: 'co-a',
        job_id: IDS.jobOrigin,
        property_id: IDS.prop1,
        category: 'problem',
        status: 'done',
        urgency: 'high',
        follow_up_status: 'open',
        model_reason: 'Pump leaking',
        created_at: daysAgoIso(20),
        last_reviewed_at: null,
      },
      {
        id: 'note-voice-only',
        company_id: 'co-a',
        job_id: IDS.jobVoiceOnly,
        property_id: IDS.prop2,
        category: 'problem',
        status: 'done',
        urgency: 'medium',
        follow_up_status: 'open',
        model_reason: 'Cracked skimmer',
        created_at: daysAgoIso(5),
        last_reviewed_at: null,
      },
      {
        id: 'note-routine',
        company_id: 'co-a',
        job_id: IDS.jobOrigin,
        property_id: IDS.prop1,
        category: 'routine',
        status: 'done',
        urgency: null,
        follow_up_status: null,
        model_reason: 'All good',
        created_at: daysAgoIso(30),
        last_reviewed_at: null,
      },
      {
        id: 'note-company-b',
        company_id: 'co-b',
        job_id: IDS.jobCompanyB,
        property_id: IDS.propB,
        category: 'problem',
        status: 'done',
        urgency: 'low',
        follow_up_status: 'open',
        model_reason: 'Other company note',
        created_at: daysAgoIso(60),
        last_reviewed_at: null,
      },
    ],
    cadenza_job_follow_up_actions: [],
  };
}
