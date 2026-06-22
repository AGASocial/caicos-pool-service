/** Bumped when job status changes so list screens refetch on next focus. */
let invalidatedAt = 0;

export function invalidateJobsList(): void {
  invalidatedAt = Date.now();
}

/** True if list data fetched at `fetchedAtMs` is older than a job mutation. */
export function isJobsListInvalidated(fetchedAtMs: number): boolean {
  return invalidatedAt > fetchedAtMs;
}
