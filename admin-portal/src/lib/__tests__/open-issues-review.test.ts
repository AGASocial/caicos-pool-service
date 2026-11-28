/**
 * @jest-environment node
 */
import {
  evaluateReviewAccess,
  mapReviewRpcError,
  parseReviewBody,
  reviewOpenIssue,
  type ReviewAccessInput,
  type ReviewJob,
} from '../open-issues-review';
import { createFakeSupabase } from '@/test-utils/fake-supabase';
import { IDS, makeOpenIssueDb } from '@/test-utils/open-issues-fixtures';
import type { SupabaseClient } from '@supabase/supabase-js';

jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }));

const job = (over: Partial<ReviewJob> = {}): ReviewJob => ({
  id: 'job-late',
  company_id: 'co-a',
  property_id: 'prop-1',
  technician_id: 'tech-late',
  is_deleted: false,
  ...over,
});

function access(over: Partial<ReviewAccessInput> = {}) {
  return evaluateReviewAccess({
    userId: 'tech-late',
    role: 'technician',
    companyId: 'co-a',
    reviewJobId: 'job-late',
    reviewJob: job(),
    issue: { company_id: 'co-a', job_id: 'job-origin', open: true },
    originJob: job({ id: 'job-origin', technician_id: 'tech-origin' }),
    ...over,
  });
}

describe('evaluateReviewAccess (AC-5 — mirrors the review_open_issue RPC)', () => {
  it('allows the technician assigned to the later job, even for another technician\'s issue', () => {
    expect(access()).toEqual({ allowed: true });
  });

  it('allows office roles for any job in their company', () => {
    for (const role of ['owner', 'admin', 'operations']) {
      expect(access({ userId: 'someone', role })).toEqual({ allowed: true });
    }
  });

  it('rejects a technician who is not assigned to the review job', () => {
    expect(access({ userId: 'tech-unassigned' })).toMatchObject({ allowed: false, status: 403 });
  });

  it('rejects an issue at a different property', () => {
    expect(access({ originJob: job({ id: 'job-origin', property_id: 'prop-2' }) })).toMatchObject({
      allowed: false,
      status: 403,
    });
  });

  it('rejects an issue or review job from a different company', () => {
    expect(access({ issue: { company_id: 'co-b', job_id: 'job-origin', open: true } })).toMatchObject({
      allowed: false,
      status: 404,
    });
    expect(access({ reviewJob: job({ company_id: 'co-b' }) })).toMatchObject({ allowed: false, status: 404 });
    expect(access({ originJob: job({ id: 'job-origin', company_id: 'co-b' }) })).toMatchObject({
      allowed: false,
      status: 403,
    });
  });

  it('rejects when the issue is not open, missing, or recorded on the review job itself', () => {
    expect(access({ issue: { company_id: 'co-a', job_id: 'job-origin', open: false } })).toMatchObject({
      allowed: false,
      status: 409,
    });
    expect(access({ issue: null })).toMatchObject({ allowed: false, status: 404 });
    expect(access({ issue: { company_id: 'co-a', job_id: 'job-late', open: true } })).toMatchObject({
      allowed: false,
      status: 400,
    });
  });

  it('rejects deleted or missing jobs and property-less jobs', () => {
    expect(access({ reviewJob: job({ is_deleted: true }) })).toMatchObject({ allowed: false, status: 404 });
    expect(access({ reviewJob: null })).toMatchObject({ allowed: false, status: 404 });
    expect(access({ originJob: null })).toMatchObject({ allowed: false, status: 403 });
    expect(
      access({ reviewJob: job({ property_id: null }), originJob: job({ id: 'job-origin', property_id: null }) }),
    ).toMatchObject({ allowed: false, status: 403 });
  });
});

describe('parseReviewBody', () => {
  const ok = { source: 'service_report', id: 'r1', review_job_id: 'j1', resolved: true };

  it('accepts a valid body and trims the note', () => {
    expect(parseReviewBody({ ...ok, note: '  checked  ' })).toEqual({
      ok: true,
      input: { ...ok, note: 'checked' },
    });
  });

  it.each([
    [null],
    [{ ...ok, source: 'other' }],
    [{ ...ok, id: '' }],
    [{ ...ok, review_job_id: undefined }],
    [{ ...ok, resolved: 'yes' }],
  ])('rejects invalid body %#', (body) => {
    expect(parseReviewBody(body).ok).toBe(false);
  });
});

describe('mapReviewRpcError', () => {
  it.each([
    [{ message: 'review_open_issue: not_authenticated' }, 401],
    [{ message: 'review_open_issue: forbidden' }, 403],
    [{ message: 'review_open_issue: review_job_not_found' }, 404],
    [{ message: 'review_open_issue: issue_not_open' }, 409],
    [{ message: 'review_open_issue: same_job' }, 400],
    [{ message: 'review_open_issue: invalid_source' }, 400],
    [{ code: 'PGRST202', message: 'Could not find the function' }, 503],
    [{ code: '42883', message: 'function does not exist' }, 503],
    [{ message: 'boom' }, 500],
  ])('maps %j to %i', (error, status) => {
    expect(mapReviewRpcError(error).status).toBe(status);
  });
});

describe('reviewOpenIssue (AC-2)', () => {
  const caller = { userId: IDS.techLate, role: 'technician', companyId: 'co-a' };

  function setup(rpc: jest.Mock = jest.fn(async () => ({ data: { ok: true }, error: null }))) {
    const db = makeOpenIssueDb();
    const client = createFakeSupabase(db, { rpc }) as unknown as SupabaseClient;
    return { client, rpc, db };
  }

  it('Yes: calls the RPC with resolved = true for a report', async () => {
    const { client, rpc } = setup();
    const res = await reviewOpenIssue(client, caller, {
      source: 'service_report',
      id: 'report-open',
      review_job_id: IDS.jobLate,
      resolved: true,
    });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('review_open_issue', {
      p_source: 'service_report',
      p_id: 'report-open',
      p_review_job_id: IDS.jobLate,
      p_resolved: true,
      p_note: null,
    });
  });

  it('No: calls the RPC with resolved = false and passes the note for a voice note', async () => {
    const { client, rpc } = setup();
    const res = await reviewOpenIssue(client, caller, {
      source: 'voice_note',
      id: 'note-open',
      review_job_id: IDS.jobLate,
      resolved: false,
      note: 'still leaking',
    });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'review_open_issue',
      expect.objectContaining({ p_resolved: false, p_note: 'still leaking', p_source: 'voice_note' }),
    );
  });

  it('does not call the RPC when access is denied (other property, unassigned, other company)', async () => {
    const { client, rpc } = setup();
    const base = { source: 'service_report' as const, id: 'report-open', resolved: true };

    // other property: the review job is at property 2
    expect(
      (await reviewOpenIssue(client, caller, { ...base, review_job_id: IDS.jobOtherProperty })).status,
    ).toBe(403);
    // unassigned technician
    expect(
      (
        await reviewOpenIssue(
          client,
          { userId: IDS.techUnassigned, role: 'technician', companyId: 'co-a' },
          { ...base, review_job_id: IDS.jobLate },
        )
      ).status,
    ).toBe(403);
    // other company's issue
    expect(
      (
        await reviewOpenIssue(
          client,
          { userId: IDS.officeB, role: 'owner', companyId: 'co-b' },
          { ...base, id: 'report-open', review_job_id: IDS.jobCompanyB },
        )
      ).status,
    ).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('office may review any issue in its company', async () => {
    const { client, rpc } = setup();
    const res = await reviewOpenIssue(
      client,
      { userId: IDS.officeA, role: 'admin', companyId: 'co-a' },
      { source: 'voice_note', id: 'note-open', review_job_id: IDS.jobLate, resolved: true },
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('surfaces database errors as HTTP statuses', async () => {
    const { client } = setup(jest.fn(async () => ({ data: null, error: { code: 'P0001', message: 'review_open_issue: forbidden' } })));
    const res = await reviewOpenIssue(client, caller, {
      source: 'service_report',
      id: 'report-open',
      review_job_id: IDS.jobLate,
      resolved: true,
    });
    expect(res.status).toBe(403);
  });

  it('returns 503 SCHEMA_PENDING when the voice-note columns do not exist yet', async () => {
    const db = makeOpenIssueDb();
    const client = createFakeSupabase(db, { missingColumns: ['follow_up_status'] }) as unknown as SupabaseClient;
    const res = await reviewOpenIssue(client, caller, {
      source: 'voice_note',
      id: 'note-open',
      review_job_id: IDS.jobLate,
      resolved: true,
    });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SCHEMA_PENDING');
  });
});
