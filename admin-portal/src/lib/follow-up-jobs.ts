/** Shared logic for office follow-up / issue queue (dashboard, jobs API). */

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
export type FollowUpActionType = (typeof FOLLOW_UP_ACTION_TYPES)[number];

export type FollowUpAction = {
  id: string;
  job_id: string;
  report_id: string | null;
  author_id: string;
  action_type: FollowUpActionType;
  body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  author?: { id: string; full_name: string } | null;
};

export function isFollowUpActionType(value: string): value is FollowUpActionType {
  return (FOLLOW_UP_ACTION_TYPES as readonly string[]).includes(value);
}
