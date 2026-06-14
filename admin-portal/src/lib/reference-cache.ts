import { unstable_cache } from 'next/cache';

/** Server-side reference data cache (US-B-006). Company-scoped keys via companyId. */

export function cachedVisitReasons(
  companyId: string,
  fetcher: () => Promise<unknown[]>,
) {
  return unstable_cache(fetcher, ['visit-reasons', companyId], {
    revalidate: 3600,
    tags: [`visit-reasons:${companyId}`],
  })();
}

export function cachedRoutesList(
  companyId: string,
  fetcher: () => Promise<unknown[]>,
) {
  return unstable_cache(fetcher, ['routes-list', companyId], {
    revalidate: 300,
    tags: [`routes:${companyId}`],
  })();
}
