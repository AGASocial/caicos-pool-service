import type { ServiceJob } from '@/lib/database.types';

export type JobStatus = ServiceJob['status'];

/** Jobs the technician can still open and work (start or continue). */
export function isJobActionable(status: JobStatus): boolean {
  return status === 'pending' || status === 'in_progress';
}

/** i18n key for a read-only status badge. */
export function jobStatusLabelKey(status: JobStatus): string {
  switch (status) {
    case 'completed':
      return 'common.completed';
    case 'skipped':
      return 'jobs.statusSkipped';
    case 'cancelled':
      return 'jobs.statusCancelled';
    case 'in_progress':
      return 'jobs.statusInProgress';
    default:
      return 'jobs.statusPending';
  }
}

/** Count toward "still to do" indicators (dots, overdue-style lists). */
export function isJobOpen(status: JobStatus): boolean {
  return status === 'pending' || status === 'in_progress';
}

/** Count toward "done for the day" indicators (progress bar, calendar dots). */
export function isJobClosedForDay(status: JobStatus): boolean {
  return status === 'completed' || status === 'skipped';
}
