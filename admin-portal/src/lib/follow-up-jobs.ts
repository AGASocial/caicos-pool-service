/** Shared logic for office follow-up / issue queue (dashboard, jobs API). */
import { formatLocalYmd } from '@/lib/date-week';

export type FollowUpReportRow = {
  job_id: string;
  follow_up_needed?: boolean | null;
  issue_categories?: string[] | null;
  follow_up_status?: string | null;
  follow_up_notes?: string | null;
};

export function reportNeedsFollowUp(report: FollowUpReportRow): boolean {
  if (report.follow_up_status === 'resolved') return false;
  if (report.follow_up_needed) return true;
  return Array.isArray(report.issue_categories) && report.issue_categories.length > 0;
}

export function uniqueJobIdsFromReports(reports: FollowUpReportRow[]): string[] {
  return [
    ...new Set(
      reports.filter(reportNeedsFollowUp).map((row) => String(row.job_id)),
    ),
  ];
}

export const FOLLOW_UP_ACTION_TYPES = ['note', 'email_sent', 'resolved', 'call'] as const;
/** Action types an office user can create directly. */
export type FollowUpActionType = (typeof FOLLOW_UP_ACTION_TYPES)[number];
/** Stored action types; 'still_open' is only written by the review_open_issue RPC (KAN-153). */
export type StoredFollowUpActionType = FollowUpActionType | 'still_open';

export type FollowUpAction = {
  id: string;
  job_id: string;
  report_id: string | null;
  author_id: string;
  action_type: StoredFollowUpActionType;
  body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  author?: { id: string; full_name: string } | null;
};

export function isFollowUpActionType(value: string): value is FollowUpActionType {
  return (FOLLOW_UP_ACTION_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// KAN-153: open issues = open follow-up reports ∪ unresolved problem voice notes
// ---------------------------------------------------------------------------

export type OpenIssueSource = 'service_report' | 'voice_note';

/** Minimum-age filter options offered in the office queue (0 = all). */
export const MIN_DAYS_OPTIONS = [0, 7, 14, 30] as const;

export type OpenIssue = {
  source: OpenIssueSource;
  id: string;
  /** Job on which the issue was recorded (origin job). */
  job_id: string;
  property_id: string | null;
  created_at: string;
  summary: string | null;
  issue_categories: string[];
  urgency: 'low' | 'medium' | 'high' | null;
  last_reviewed_at: string | null;
  days_open: number;
};

export type OpenIssueReportInput = FollowUpReportRow & {
  id: string;
  property_id?: string | null;
  created_at: string;
  last_reviewed_at?: string | null;
};

export type OpenIssueVoiceNoteInput = {
  id: string;
  job_id: string;
  property_id: string | null;
  created_at: string;
  urgency?: 'low' | 'medium' | 'high' | null;
  reason?: string | null;
  explanation?: string | null;
  transcript?: string | null;
  follow_up_status?: string | null;
  last_reviewed_at?: string | null;
};

const SUMMARY_MAX_LENGTH = 160;

function truncateSummary(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  return trimmed.length > SUMMARY_MAX_LENGTH
    ? `${trimmed.slice(0, SUMMARY_MAX_LENGTH - 1)}…`
    : trimmed;
}

/** Local calendar day number (days since epoch of the local Y-M-D, DST safe). */
function localDayNumber(d: Date): number {
  const [y, m, day] = formatLocalYmd(d).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, day) / 86_400_000);
}

/**
 * Whole calendar days between the local date of `openedAt` and local date of `now`.
 * Same-day issues are 0; invalid input or future dates clamp to 0.
 */
export function daysOpen(openedAt: string | Date, now: Date = new Date()): number {
  const opened = openedAt instanceof Date ? openedAt : new Date(openedAt);
  if (Number.isNaN(opened.getTime())) return 0;
  return Math.max(0, localDayNumber(now) - localDayNumber(opened));
}

/** Normalizes a `min_days` query value; anything invalid or <= 0 means "no filter". */
export function parseMinDays(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function filterByMinDays<T extends { days_open: number }>(items: T[], minDays: number): T[] {
  if (minDays <= 0) return items;
  return items.filter((item) => item.days_open >= minDays);
}

/** Oldest first (largest days_open, then earliest created_at, then id for stability). */
export function sortOldestFirst<T extends { days_open: number; created_at: string; id: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (b.days_open !== a.days_open) return b.days_open - a.days_open;
    const byCreated = a.created_at.localeCompare(b.created_at);
    if (byCreated !== 0) return byCreated;
    return a.id.localeCompare(b.id);
  });
}

/** Open service-report issues only (reuses {@link reportNeedsFollowUp}). */
export function openIssuesFromReports(
  reports: OpenIssueReportInput[],
  now: Date = new Date(),
): OpenIssue[] {
  return reports.filter(reportNeedsFollowUp).map((report) => ({
    source: 'service_report' as const,
    id: String(report.id),
    job_id: String(report.job_id),
    property_id: report.property_id ?? null,
    created_at: report.created_at,
    summary: truncateSummary(report.follow_up_notes),
    issue_categories: Array.isArray(report.issue_categories) ? report.issue_categories : [],
    urgency: null,
    last_reviewed_at: report.last_reviewed_at ?? null,
    days_open: daysOpen(report.created_at, now),
  }));
}

/** Unresolved problem voice notes (input rows are already filtered to category = problem). */
export function openIssuesFromVoiceNotes(
  notes: OpenIssueVoiceNoteInput[],
  now: Date = new Date(),
): OpenIssue[] {
  return notes
    .filter((note) => note.follow_up_status !== 'resolved')
    .map((note) => ({
      source: 'voice_note' as const,
      id: String(note.id),
      job_id: String(note.job_id),
      property_id: note.property_id ?? null,
      created_at: note.created_at,
      summary: truncateSummary(note.reason ?? note.explanation ?? note.transcript),
      issue_categories: [],
      urgency: note.urgency ?? null,
      last_reviewed_at: note.last_reviewed_at ?? null,
      days_open: daysOpen(note.created_at, now),
    }));
}

/** Union of both sources, oldest first. */
export function unionOpenIssues(
  reports: OpenIssueReportInput[],
  notes: OpenIssueVoiceNoteInput[],
  now: Date = new Date(),
): OpenIssue[] {
  return sortOldestFirst([
    ...openIssuesFromReports(reports, now),
    ...openIssuesFromVoiceNotes(notes, now),
  ]);
}

export function uniqueJobIdsFromOpenIssues(issues: OpenIssue[]): string[] {
  return [...new Set(issues.map((issue) => issue.job_id))];
}

/** Oldest issue per origin job: job_id -> { days_open, issues } (issues oldest first). */
export function groupOpenIssuesByJob(issues: OpenIssue[]): Map<string, OpenIssue[]> {
  const grouped = new Map<string, OpenIssue[]>();
  for (const issue of sortOldestFirst(issues)) {
    const list = grouped.get(issue.job_id);
    if (list) list.push(issue);
    else grouped.set(issue.job_id, [issue]);
  }
  return grouped;
}

/** Oldest `days_open` for each origin job. */
export function oldestDaysByJob(issues: OpenIssue[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const [jobId, list] of groupOpenIssuesByJob(issues)) {
    result.set(jobId, list[0].days_open);
  }
  return result;
}

/**
 * Carry-forward items for a job: same property, origin job is not the current job.
 * Property comes from the issue (voice notes/reports are resolved to the origin job's property).
 */
export function carryForwardIssuesForJob(
  issues: OpenIssue[],
  job: { id: string; property_id: string | null },
): OpenIssue[] {
  if (!job.property_id) return [];
  return sortOldestFirst(
    issues.filter((issue) => issue.property_id === job.property_id && issue.job_id !== job.id),
  );
}

/** True when every visible carry-forward item has an answer (Yes/No). Zero items => true. */
export function allCarryForwardAnswered(
  issues: Array<{ source: OpenIssueSource; id: string }>,
  answers: Record<string, boolean | null | undefined>,
): boolean {
  return issues.every((issue) => typeof answers[`${issue.source}:${issue.id}`] === 'boolean');
}

export function openIssueKey(issue: { source: OpenIssueSource; id: string }): string {
  return `${issue.source}:${issue.id}`;
}
