import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { normalizeRole } from '@/lib/entitlements';

export type TechnicianScope = {
  hasAssignedRoutes: boolean;
  routeIds: string[];
  propertyIds: string[];
};

export async function resolveTechnicianScope(
  client: CadenzaSupabaseClient,
  userId: string,
  role: string | undefined | null,
): Promise<TechnicianScope | null> {
  if (normalizeRole(role) !== 'technician') {
    return null;
  }

  const { data: routes } = await client
    .from('cadenza_routes')
    .select('id')
    .eq('technician_id', userId);

  const routeIds = (routes ?? []).map((row) => String(row.id));
  if (routeIds.length === 0) {
    return { hasAssignedRoutes: false, routeIds: [], propertyIds: [] };
  }

  const { data: stops } = await client
    .from('cadenza_route_stops')
    .select('property_id')
    .in('route_id', routeIds);

  const propertyIds = [
    ...new Set(
      (stops ?? [])
        .map((row) => row.property_id)
        .filter((id): id is string => id != null)
        .map(String),
    ),
  ];

  return { hasAssignedRoutes: true, routeIds, propertyIds };
}

export function jobMatchesTechnicianScope(
  job: { technician_id?: string | null; route_id?: string | null },
  userId: string,
  scope: TechnicianScope,
): boolean {
  if (!scope.hasAssignedRoutes) return false;
  if (job.technician_id != null && String(job.technician_id) === userId) return true;
  if (job.route_id != null && scope.routeIds.includes(String(job.route_id))) return true;
  return false;
}

/** Supabase `.or()` filter for jobs visible to an assigned technician. */
export function technicianJobsOrFilter(userId: string, routeIds: string[]): string {
  const routeClause =
    routeIds.length > 0 ? `route_id.in.(${routeIds.join(',')})` : 'route_id.is.null';
  return `${routeClause},technician_id.eq.${userId}`;
}
