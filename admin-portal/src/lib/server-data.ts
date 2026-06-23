import { createRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { buildPaginatedResponse } from '@/lib/pagination';
import { formatLocalYmd } from '@/lib/date-week';
import { uniqueJobIdsFromReports } from '@/lib/follow-up-jobs';
import { normalizeIssueCategories } from '@/lib/service-report';
import { resolveTechnicianScope, technicianJobsOrFilter } from '@/lib/technician-scope';

/** Server-side data helpers for RSC pages (US-F-001). */

export type DashboardJob = {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  created_at: string;
  property: { id: string; customer_name: string; address: string } | null;
  technician: { id: string; full_name: string } | null;
  route: { id: string; name: string } | null;
};

export type DashboardIssueJob = DashboardJob & {
  issue_categories: string[];
  follow_up_notes: string | null;
};

type Relation<T> = T | T[] | null | undefined;

function firstRelation<T>(value: Relation<T>): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeDashboardJob(row: Record<string, unknown>): DashboardJob {
  return {
    id: row.id as string,
    scheduled_date: row.scheduled_date as string,
    scheduled_time: (row.scheduled_time as string | null) ?? null,
    status: row.status as string,
    created_at: row.created_at as string,
    property: firstRelation(row.property as Relation<DashboardJob['property']>),
    technician: firstRelation(row.technician as Relation<DashboardJob['technician']>),
    route: firstRelation(row.route as Relation<DashboardJob['route']>),
  };
}

export async function fetchDashboardServerData() {
  const supabase = await createRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const client = supabase as unknown as CadenzaSupabaseClient;
  const { data: profile } = await client
    .from('cadenza_profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  const technicianScope = profile
    ? await resolveTechnicianScope(client, user.id, profile.role as string)
    : null;
  const isTechnicianView = technicianScope != null;

  if (technicianScope && !technicianScope.hasAssignedRoutes) {
    return {
      stats: { totalJobs: 0, totalRoutes: 0, totalTeamMembers: 0, totalProperties: 0 },
      issueJobs: [],
      pendingJobsToday: [],
      isTechnicianView,
      noAssignedRoute: true,
    };
  }

  if (!profile?.company_id) {
    return {
      stats: { totalJobs: 0, totalRoutes: 0, totalTeamMembers: 0, totalProperties: 0 },
      issueJobs: [],
      pendingJobsToday: [],
      isTechnicianView,
      noAssignedRoute: isTechnicianView,
    };
  }

  let stats = {
    totalJobs: 0,
    totalRoutes: 0,
    totalTeamMembers: 0,
    totalProperties: 0,
  };

  if (technicianScope) {
    const { count: jobCount } = await client
      .from('cadenza_service_jobs')
      .select('id', { count: 'exact', head: true })
      .or(technicianJobsOrFilter(user.id, technicianScope.routeIds));
    stats = {
      totalJobs: jobCount ?? 0,
      totalRoutes: technicianScope.routeIds.length,
      totalTeamMembers: 0,
      totalProperties: technicianScope.propertyIds.length,
    };
  } else {
    const { data: statsRow } = await client
      .from('cadenza_company_stats')
      .select('total_jobs, total_routes, total_team_members, total_properties')
      .eq('company_id', profile.company_id)
      .maybeSingle();
    stats = {
      totalJobs: statsRow?.total_jobs ?? 0,
      totalRoutes: statsRow?.total_routes ?? 0,
      totalTeamMembers: statsRow?.total_team_members ?? 0,
      totalProperties: statsRow?.total_properties ?? 0,
    };
  }

  const jobSelect = `
    id, property_id, technician_id, route_id, scheduled_date, scheduled_time, status, created_at,
    property:cadenza_properties!property_id(id, customer_name, address),
    technician:cadenza_profiles!technician_id(id, full_name),
    route:cadenza_routes!route_id(id, name)
  `;

  const { data: flaggedReports } = await client
    .from('cadenza_service_reports')
    .select('job_id, follow_up_needed, issue_categories, follow_up_status, follow_up_notes')
    .eq('follow_up_status', 'open')
    .or('follow_up_needed.eq.true,issue_categories.neq.{}');

  const followUpJobIds = uniqueJobIdsFromReports(
    (flaggedReports ?? []) as Parameters<typeof uniqueJobIdsFromReports>[0],
  );

  const reportByJobId = new Map(
    (flaggedReports ?? []).map((row) => {
      const record = row as {
        job_id: string;
        issue_categories?: string[] | null;
        follow_up_notes?: string | null;
      };
      return [String(record.job_id), record];
    }),
  );

  let issueJobs: DashboardIssueJob[] = [];
  const today = formatLocalYmd(new Date());

  const [issueJobsRes, pendingRes] = await Promise.all([
    followUpJobIds.length > 0
      ? (() => {
          let issueQuery = client
            .from('cadenza_service_jobs')
            .select(jobSelect)
            .in('id', followUpJobIds)
            .order('scheduled_date', { ascending: false })
            .order('scheduled_time', { ascending: false, nullsFirst: false })
            .limit(8);
          if (technicianScope) {
            issueQuery = issueQuery.or(
              technicianJobsOrFilter(user.id, technicianScope.routeIds),
            );
          }
          return issueQuery;
        })()
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    (() => {
      let pendingQuery = client
        .from('cadenza_service_jobs')
        .select(jobSelect)
        .eq('status', 'pending')
        .eq('scheduled_date', today)
        .order('scheduled_time', { ascending: true, nullsFirst: false })
        .order('route_order', { ascending: true, nullsFirst: true })
        .limit(8);
      if (technicianScope) {
        pendingQuery = pendingQuery.or(
          technicianJobsOrFilter(user.id, technicianScope.routeIds),
        );
      }
      return pendingQuery;
    })(),
  ]);

  if (issueJobsRes.data?.length) {
    issueJobs = issueJobsRes.data.map((row) => {
      const job = normalizeDashboardJob(row as Record<string, unknown>);
      const report = reportByJobId.get(job.id);
      return {
        ...job,
        issue_categories: normalizeIssueCategories(report?.issue_categories),
        follow_up_notes: report?.follow_up_notes ?? null,
      };
    });
  }

  const pendingJobsToday = (pendingRes.data ?? []).map((row) =>
    normalizeDashboardJob(row as Record<string, unknown>),
  );

  return {
    stats,
    issueJobs,
    pendingJobsToday,
    isTechnicianView,
    noAssignedRoute: false,
  };
}

export async function fetchPropertiesServerPage(limit = 50) {
  const supabase = await createRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const client = supabase as unknown as CadenzaSupabaseClient;
  const { data: profile } = await client
    .from('cadenza_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const technicianScope = profile
    ? await resolveTechnicianScope(client, user.id, profile.role as string)
    : null;

  if (technicianScope && !technicianScope.hasAssignedRoutes) {
    return {
      data: [],
      pagination: { hasMore: false, nextCursor: null },
      noAssignedRoute: true,
    };
  }

  let query = client
    .from('cadenza_properties')
    .select('id, customer_name, address, city, is_active, created_at')
    .eq('is_active', true)
    .order('customer_name', { ascending: true })
    .order('id', { ascending: true });

  if (technicianScope) {
    if (technicianScope.propertyIds.length === 0) {
      return {
        data: [],
        pagination: { hasMore: false, nextCursor: null },
        noAssignedRoute: false,
      };
    }
    query = query.in('id', technicianScope.propertyIds);
  }

  const { data } = await query.limit(limit + 1);

  const rows = data ?? [];
  return buildPaginatedResponse(
    rows as { id: string; customer_name: string }[],
    limit,
    (r) => `${r.customer_name}|${r.id}`,
  );
}
