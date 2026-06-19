import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';

export type SoftDeletableTable =
  | 'cadenza_routes'
  | 'cadenza_route_stops'
  | 'cadenza_service_jobs'
  | 'cadenza_report_photos'
  | 'cadenza_job_follow_up_actions';

export const SOFT_DELETE_ROLES = new Set(['owner', 'admin', 'operations']);

const TABLES_WITH_UPDATED_AT = new Set<SoftDeletableTable>([
  'cadenza_routes',
  'cadenza_service_jobs',
]);

const TABLES_WITH_COMPANY_ID = new Set<SoftDeletableTable>([
  'cadenza_routes',
  'cadenza_service_jobs',
  'cadenza_report_photos',
  'cadenza_job_follow_up_actions',
]);

type SoftDeleteResult = {
  count: number;
  ids: string[];
  error: { message: string } | null;
};

type SoftDeleteAuthResult =
  | { companyId: string }
  | { error: string; status: 403 };

/**
 * Ensures the user may soft-delete records for their company.
 */
export async function requireSoftDeleteCompanyId(
  client: CadenzaSupabaseClient,
  userId: string
): Promise<SoftDeleteAuthResult> {
  const { data: profile, error } = await client
    .from('cadenza_profiles')
    .select('company_id, role')
    .eq('id', userId)
    .single();

  const companyId = profile && typeof profile.company_id === 'string' ? profile.company_id : null;
  const role = profile && typeof profile.role === 'string' ? profile.role : null;

  if (error || !companyId || !role || !SOFT_DELETE_ROLES.has(role)) {
    return { error: 'Forbidden', status: 403 };
  }

  return { companyId };
}

/**
 * Soft-deletes rows using the service-role client, scoped to company where applicable.
 * API routes must call requireSoftDeleteCompanyId first.
 */
export async function softDeleteRowsForCompany(
  companyId: string,
  table: SoftDeletableTable,
  filters: Record<string, string | string[]>
): Promise<SoftDeleteResult> {
  const payload: Record<string, unknown> = { is_deleted: true };
  if (TABLES_WITH_UPDATED_AT.has(table)) {
    payload.updated_at = new Date().toISOString();
  }

  const admin = getSupabaseAdmin() as unknown as CadenzaSupabaseClient;
  let query = admin.from(table).update(payload).eq('is_deleted', false);

  if (TABLES_WITH_COMPANY_ID.has(table)) {
    query = query.eq('company_id', companyId);
  }

  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      query = query.in(key, value);
    } else {
      query = query.eq(key, value);
    }
  }

  const { data, error } = await query.select('id');

  if (error) {
    return { count: 0, ids: [], error: { message: error.message } };
  }

  const ids = (data ?? [])
    .map((row) => (row as { id?: string }).id)
    .filter((id): id is string => typeof id === 'string');

  return { count: ids.length, ids, error: null };
}

export async function softDeleteForUser(
  client: CadenzaSupabaseClient,
  userId: string,
  table: SoftDeletableTable,
  filters: Record<string, string | string[]>
): Promise<SoftDeleteResult & { forbidden?: boolean }> {
  const auth = await requireSoftDeleteCompanyId(client, userId);
  if ('error' in auth) {
    return { count: 0, ids: [], error: { message: auth.error }, forbidden: true };
  }

  return softDeleteRowsForCompany(auth.companyId, table, filters);
}

export async function softDeleteByIdForUser(
  client: CadenzaSupabaseClient,
  userId: string,
  table: SoftDeletableTable,
  id: string,
  extraFilters?: Record<string, string>
): Promise<SoftDeleteResult & { forbidden?: boolean }> {
  return softDeleteForUser(client, userId, table, { id, ...extraFilters });
}
