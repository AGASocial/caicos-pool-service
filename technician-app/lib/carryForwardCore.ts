/**
 * KAN-153 carry-forward: pure helpers (no React Native / Supabase imports so they stay unit
 * testable). The database access lives in `carryForward.ts`.
 */

export type CarryForwardSource = 'service_report' | 'voice_note';

export type CarryForwardIssue = {
  source: CarryForwardSource;
  id: string;
  /** Job on which the issue was recorded. */
  job_id: string;
  property_id: string;
  created_at: string;
  summary: string | null;
  issue_categories: string[];
  /** Set when this issue was already reviewed during the job being viewed ("No" persisted). */
  reviewed_on_job_id: string | null;
};

/** Answers keyed by `source:id`; true = resolved (Yes), false = still open (No). */
export type CarryForwardAnswers = Record<string, boolean | undefined>;

const SUMMARY_MAX_LENGTH = 140;

export function carryForwardKey(issue: { source: CarryForwardSource; id: string }): string {
  return `${issue.source}:${issue.id}`;
}

export function truncateSummary(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  return trimmed.length > SUMMARY_MAX_LENGTH ? `${trimmed.slice(0, SUMMARY_MAX_LENGTH - 1)}…` : trimmed;
}

/** Issues to show on a job: same property, recorded on a different job, oldest first. */
export function issuesForJob(
  issues: CarryForwardIssue[],
  job: { id: string; property_id: string | null | undefined },
): CarryForwardIssue[] {
  if (!job.property_id) return [];
  return issues
    .filter((issue) => issue.property_id === job.property_id && issue.job_id !== job.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

/** Count of carry-forward items per job id, for the list-card badge. */
export function carryForwardCountsByJob(
  issues: CarryForwardIssue[],
  jobs: Array<{ id: string; property_id: string | null | undefined }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const job of jobs) {
    const count = issuesForJob(issues, job).length;
    if (count > 0) counts[job.id] = count;
  }
  return counts;
}

/** Answers pre-filled from reviews already recorded on this job ("No" persists across opens). */
export function initialAnswers(issues: CarryForwardIssue[], jobId: string): CarryForwardAnswers {
  const answers: CarryForwardAnswers = {};
  for (const issue of issues) {
    if (issue.reviewed_on_job_id === jobId) answers[carryForwardKey(issue)] = false;
  }
  return answers;
}

/** Items still waiting for Yes/No. */
export function unansweredCarryForward(
  issues: Array<{ source: CarryForwardSource; id: string }>,
  answers: CarryForwardAnswers,
): Array<{ source: CarryForwardSource; id: string }> {
  return issues.filter((issue) => typeof answers[carryForwardKey(issue)] !== 'boolean');
}

/** Guard for the Complete action: true when every visible item has Yes or No (zero items => true). */
export function allCarryForwardAnswered(
  issues: Array<{ source: CarryForwardSource; id: string }>,
  answers: CarryForwardAnswers,
): boolean {
  return unansweredCarryForward(issues, answers).length === 0;
}

function localDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** Whole local calendar days from `createdAt` to `now` (same rule as the admin portal). */
export function daysOpen(createdAt: string, now: Date = new Date()): number {
  const opened = new Date(createdAt);
  if (Number.isNaN(opened.getTime())) return 0;
  return Math.max(0, localDayNumber(now) - localDayNumber(opened));
}
