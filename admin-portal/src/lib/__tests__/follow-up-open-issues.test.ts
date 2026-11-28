import {
  allCarryForwardAnswered,
  carryForwardIssuesForJob,
  daysOpen,
  filterByMinDays,
  groupOpenIssuesByJob,
  oldestDaysByJob,
  openIssuesFromReports,
  openIssuesFromVoiceNotes,
  parseMinDays,
  reportNeedsFollowUp,
  sortOldestFirst,
  unionOpenIssues,
  type OpenIssue,
  type OpenIssueReportInput,
  type OpenIssueVoiceNoteInput,
} from '../follow-up-jobs';
import {
  allCarryForwardAnswered as techAllAnswered,
  carryForwardCountsByJob,
  daysOpen as techDaysOpen,
  initialAnswers,
  issuesForJob,
  unansweredCarryForward,
  type CarryForwardIssue,
} from '../../../../technician-app/lib/carryForwardCore';

// Local-time constructor so the tests do not depend on the machine time zone.
const NOW = new Date(2026, 10, 27, 15, 30, 0); // 2026-11-27 local

function daysAgo(n: number, hour = 9): string {
  return new Date(2026, 10, 27 - n, hour, 0, 0).toISOString();
}

function report(over: Partial<OpenIssueReportInput> & { id: string; job_id: string }): OpenIssueReportInput {
  return {
    property_id: 'prop-1',
    created_at: daysAgo(3),
    follow_up_status: 'open',
    follow_up_needed: true,
    issue_categories: [],
    follow_up_notes: null,
    ...over,
  };
}

function note(over: Partial<OpenIssueVoiceNoteInput> & { id: string; job_id: string }): OpenIssueVoiceNoteInput {
  return {
    property_id: 'prop-1',
    created_at: daysAgo(10),
    follow_up_status: 'open',
    reason: 'pump noise',
    ...over,
  };
}

describe('daysOpen (AC-3 / requirement 6)', () => {
  it('is 0 for the same local calendar day, even late in the evening', () => {
    expect(daysOpen(daysAgo(0, 0), NOW)).toBe(0);
    expect(daysOpen(new Date(2026, 10, 27, 23, 59).toISOString(), new Date(2026, 10, 27, 0, 1))).toBe(0);
  });

  it('counts whole calendar days, not 24h periods', () => {
    // 23:59 yesterday vs 00:01 today is one calendar day apart.
    expect(daysOpen(new Date(2026, 10, 26, 23, 59).toISOString(), new Date(2026, 10, 27, 0, 1))).toBe(1);
    expect(daysOpen(daysAgo(7), NOW)).toBe(7);
    expect(daysOpen(daysAgo(30), NOW)).toBe(30);
  });

  it('is DST safe across a spring-forward / fall-back boundary', () => {
    const start = new Date(2026, 2, 1, 12).toISOString();
    const end = new Date(2026, 3, 1, 12);
    expect(daysOpen(start, end)).toBe(31);
  });

  it('clamps future and invalid dates to 0', () => {
    expect(daysOpen(new Date(2026, 11, 5).toISOString(), NOW)).toBe(0);
    expect(daysOpen('not-a-date', NOW)).toBe(0);
  });

  it('accepts a Date instance', () => {
    expect(daysOpen(new Date(2026, 10, 20, 8), NOW)).toBe(7);
  });
});

describe('min-days filter and oldest-first sort (AC-3)', () => {
  it('parseMinDays normalizes query values', () => {
    expect(parseMinDays('14')).toBe(14);
    expect(parseMinDays(null)).toBe(0);
    expect(parseMinDays('')).toBe(0);
    expect(parseMinDays('-5')).toBe(0);
    expect(parseMinDays('abc')).toBe(0);
    expect(parseMinDays('7.9')).toBe(7);
  });

  const items = [
    { id: 'a', days_open: 2, created_at: daysAgo(2) },
    { id: 'b', days_open: 8, created_at: daysAgo(8) },
    { id: 'c', days_open: 15, created_at: daysAgo(15) },
    { id: 'd', days_open: 31, created_at: daysAgo(31) },
  ];

  it.each([
    [0, ['a', 'b', 'c', 'd']],
    [7, ['b', 'c', 'd']],
    [14, ['c', 'd']],
    [30, ['d']],
  ])('min_days=%i keeps items at least that old', (min, expected) => {
    expect(filterByMinDays(items, min).map((i) => i.id)).toEqual(expected);
  });

  it('keeps an issue exactly at the threshold', () => {
    expect(filterByMinDays([{ id: 'x', days_open: 7 }], 7)).toHaveLength(1);
  });

  it('sorts oldest first with created_at then id as stable tie-breaks', () => {
    const sorted = sortOldestFirst([
      { id: 'z', days_open: 5, created_at: daysAgo(5, 10) },
      { id: 'y', days_open: 5, created_at: daysAgo(5, 8) },
      { id: 'x', days_open: 30, created_at: daysAgo(30) },
      { id: 'w', days_open: 5, created_at: daysAgo(5, 8) },
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['x', 'w', 'y', 'z']);
  });
});

describe('open-issue union (AC-4)', () => {
  it('keeps reportNeedsFollowUp semantics for reports', () => {
    expect(reportNeedsFollowUp({ job_id: 'j', follow_up_needed: true, follow_up_status: 'open' })).toBe(true);
    expect(reportNeedsFollowUp({ job_id: 'j', issue_categories: ['motor'], follow_up_status: 'open' })).toBe(true);
    expect(reportNeedsFollowUp({ job_id: 'j', follow_up_needed: true, follow_up_status: 'resolved' })).toBe(false);
    expect(reportNeedsFollowUp({ job_id: 'j', follow_up_needed: false, issue_categories: [] })).toBe(false);
  });

  it('turns open reports into issues with age and drops resolved/unflagged ones', () => {
    const issues = openIssuesFromReports(
      [
        report({ id: 'r1', job_id: 'j1', created_at: daysAgo(9), issue_categories: ['motor'], follow_up_notes: 'check motor' }),
        report({ id: 'r2', job_id: 'j2', follow_up_status: 'resolved' }),
        report({ id: 'r3', job_id: 'j3', follow_up_needed: false, issue_categories: [] }),
      ],
      NOW,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      source: 'service_report',
      id: 'r1',
      job_id: 'j1',
      days_open: 9,
      summary: 'check motor',
      issue_categories: ['motor'],
    });
  });

  it('turns unresolved problem voice notes into issues and drops resolved ones', () => {
    const issues = openIssuesFromVoiceNotes(
      [
        note({ id: 'n1', job_id: 'j1', created_at: daysAgo(12) }),
        note({ id: 'n2', job_id: 'j1', follow_up_status: 'resolved' }),
        note({ id: 'n3', job_id: 'j2', follow_up_status: null, reason: null, explanation: null, transcript: 'x'.repeat(400) }),
      ],
      NOW,
    );
    expect(issues.map((i) => i.id).sort()).toEqual(['n1', 'n3']);
    expect(issues.find((i) => i.id === 'n1')).toMatchObject({ source: 'voice_note', days_open: 12, summary: 'pump noise' });
    expect(issues.find((i) => i.id === 'n3')?.summary?.length).toBeLessThanOrEqual(160);
  });

  it('unions both kinds, shows both for one job, oldest first', () => {
    const issues = unionOpenIssues(
      [report({ id: 'r1', job_id: 'j1', created_at: daysAgo(3) })],
      [note({ id: 'n1', job_id: 'j1', created_at: daysAgo(10) }), note({ id: 'n2', job_id: 'j9', created_at: daysAgo(40) })],
      NOW,
    );
    expect(issues.map((i) => `${i.source}:${i.id}`)).toEqual(['voice_note:n2', 'voice_note:n1', 'service_report:r1']);
    // A voice-note-only job is part of the queue (jobs list must include it).
    expect(groupOpenIssuesByJob(issues).has('j9')).toBe(true);
    // Resolving the report must not remove the distinct voice note on the same job.
    const afterReportResolved = unionOpenIssues(
      [report({ id: 'r1', job_id: 'j1', follow_up_status: 'resolved' })],
      [note({ id: 'n1', job_id: 'j1' })],
      NOW,
    );
    expect(afterReportResolved.map((i) => i.id)).toEqual(['n1']);
    // ...and the other way around.
    const afterNoteResolved = unionOpenIssues(
      [report({ id: 'r1', job_id: 'j1' })],
      [note({ id: 'n1', job_id: 'j1', follow_up_status: 'resolved' })],
      NOW,
    );
    expect(afterNoteResolved.map((i) => i.id)).toEqual(['r1']);
  });

  it('reports the oldest age per origin job', () => {
    const issues = unionOpenIssues(
      [report({ id: 'r1', job_id: 'j1', created_at: daysAgo(3) })],
      [note({ id: 'n1', job_id: 'j1', created_at: daysAgo(20) })],
      NOW,
    );
    expect(oldestDaysByJob(issues).get('j1')).toBe(20);
  });
});

describe('carry-forward selection (AC-1)', () => {
  const issues: OpenIssue[] = unionOpenIssues(
    [
      report({ id: 'r1', job_id: 'origin', property_id: 'prop-1' }),
      report({ id: 'r2', job_id: 'current', property_id: 'prop-1' }),
      report({ id: 'r3', job_id: 'other', property_id: 'prop-2' }),
    ],
    [note({ id: 'n1', job_id: 'origin', property_id: 'prop-1' })],
    NOW,
  );

  it('returns same-property issues recorded on a different job', () => {
    const forJob = carryForwardIssuesForJob(issues, { id: 'current', property_id: 'prop-1' });
    expect(forJob.map((i) => i.id).sort()).toEqual(['n1', 'r1']);
  });

  it('returns nothing when the job has no property', () => {
    expect(carryForwardIssuesForJob(issues, { id: 'current', property_id: null })).toEqual([]);
  });
});

describe('complete-visit guard (AC-7)', () => {
  const pending = [
    { source: 'service_report' as const, id: 'r1' },
    { source: 'voice_note' as const, id: 'n1' },
  ];

  it('allows completing when there are no carry-forward items', () => {
    expect(allCarryForwardAnswered([], {})).toBe(true);
  });

  it('blocks until every item has Yes or No', () => {
    expect(allCarryForwardAnswered(pending, {})).toBe(false);
    expect(allCarryForwardAnswered(pending, { 'service_report:r1': true })).toBe(false);
    expect(allCarryForwardAnswered(pending, { 'service_report:r1': true, 'voice_note:n1': undefined })).toBe(false);
    expect(allCarryForwardAnswered(pending, { 'service_report:r1': true, 'voice_note:n1': false })).toBe(true);
  });

  it('treats "No" (false) as answered, not as missing', () => {
    expect(allCarryForwardAnswered([pending[0]], { 'service_report:r1': false })).toBe(true);
  });
});

describe('technician-app carry-forward core (shared by the Complete guard and list badge)', () => {
  const issue = (over: Partial<CarryForwardIssue> & { id: string; job_id: string }): CarryForwardIssue => ({
    source: 'service_report',
    property_id: 'prop-1',
    created_at: daysAgo(4),
    summary: null,
    issue_categories: [],
    reviewed_on_job_id: null,
    ...over,
  });

  it('daysOpen matches the portal helper', () => {
    for (const n of [0, 1, 7, 14, 30, 90]) {
      expect(techDaysOpen(daysAgo(n), NOW)).toBe(daysOpen(daysAgo(n), NOW));
    }
    expect(techDaysOpen('bad', NOW)).toBe(0);
  });

  it('guard blocks Complete until each item is answered and counts what is left', () => {
    const items = [issue({ id: 'a', job_id: 'o1' }), issue({ id: 'b', job_id: 'o2', source: 'voice_note' })];
    expect(techAllAnswered(items, {})).toBe(false);
    expect(unansweredCarryForward(items, { 'service_report:a': true })).toEqual([
      { source: 'voice_note', id: 'b', job_id: 'o2', property_id: 'prop-1', created_at: items[1].created_at, summary: null, issue_categories: [], reviewed_on_job_id: null },
    ]);
    expect(techAllAnswered(items, { 'service_report:a': true, 'voice_note:b': false })).toBe(true);
    expect(techAllAnswered([], {})).toBe(true);
  });

  it('issuesForJob excludes the origin job and other properties; badge counts match', () => {
    const items = [
      issue({ id: 'a', job_id: 'o1' }),
      issue({ id: 'b', job_id: 'current' }),
      issue({ id: 'c', job_id: 'o3', property_id: 'prop-2' }),
    ];
    expect(issuesForJob(items, { id: 'current', property_id: 'prop-1' }).map((i) => i.id)).toEqual(['a']);
    expect(
      carryForwardCountsByJob(items, [
        { id: 'current', property_id: 'prop-1' },
        { id: 'other', property_id: 'prop-2' },
        { id: 'clean', property_id: 'prop-3' },
      ]),
    ).toEqual({ current: 1, other: 1 });
  });

  it('a "No" already recorded on this job counts as answered after reopening the screen', () => {
    const items = [issue({ id: 'a', job_id: 'o1', reviewed_on_job_id: 'current' }), issue({ id: 'b', job_id: 'o1', reviewed_on_job_id: 'another' })];
    const answers = initialAnswers(items, 'current');
    expect(answers).toEqual({ 'service_report:a': false });
    expect(techAllAnswered(items, answers)).toBe(false);
  });
});

describe('KAN-154: voice-note summary provenance', () => {
  it('flags a transcript-only summary so broad emails can leave it out', () => {
    const [classified] = openIssuesFromVoiceNotes([note({ id: 'n1', job_id: 'j1', reason: 'pump noise' })], NOW);
    expect(classified.summary).toBe('pump noise');
    expect(classified.summary_is_transcript).toBeUndefined();

    const [transcriptOnly] = openIssuesFromVoiceNotes(
      [note({ id: 'n2', job_id: 'j1', reason: null, explanation: null, transcript: 'raw audio text' })],
      NOW,
    );
    expect(transcriptOnly.summary).toBe('raw audio text');
    expect(transcriptOnly.summary_is_transcript).toBe(true);
  });
});
