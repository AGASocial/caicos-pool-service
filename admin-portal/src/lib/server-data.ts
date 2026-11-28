import { fetchCompanyCounts } from '@/lib/company-counts';
import { createRouteClient } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { buildPaginatedResponse } from '@/lib/pagination';
import { formatLocalYmd } from '@/lib/date-week';
import { unionOpenIssues, type OpenIssue, type OpenIssueReportInput } from '@/lib/follow-up-jobs';
import { buildJobQueue, fetchOpenIssues, OpenIssuesSchemaPendingError } from '@/lib/open-issues';
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
  /** Whole days since the oldest open issue on this job was recorded (KAN-153). */
  days_open: number;
  /** True when the job has an unresolved problem voice note. */
  has_voice_note_problem: boolean;
};

const DASHBOARD_ISSUE_LIMIT = 8;

type IssueQueue = { issues: OpenIssue[]; schemaPending: boolean };

/**
 * Open issues (reports ∪ problem voice notes). If the KAN-153 migration is not applied yet we
 * fall back to reports only and flag it, so the dashboard still renders but says so.
 */
async function loadDashboardIssues(
  client: CadenzaSupabaseClient,
  companyId: string,
): Promise<IssueQueue> {
  try {
    const issues = await fetchOpenIssues(client as unknown as SupabaseClient, companyId);
    return { issues, schemaPending: false };
  } catch (error) {
    if (!(error instanceof OpenIssuesSchemaPendingError)) {
      console.error('dashboard: open issues failed:', error instanceof Error ? error.message : error);
      return { issues: [], schemaPending: false };
    }
  }

  const { data } = await client
    .from('cadenza_service_reports')
    .select('id, job_id, follow_up_needed, issue_categories, follow_up_status, follow_up_notes, created_at')
    .eq('company_id', companyId)
    .eq('follow_up_status', 'open')
    .or('follow_up_needed.eq.true,issue_categories.neq.{}');
  return {
    issues: unionOpenIssues((data ?? []) as unknown as OpenIssueReportInput[], []),
    schemaPending: true,
  };
}

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
    stats = await fetchCompanyCounts(client, profile.company_id as string);
  }

  const jobSelect = `
    id, property_id, technician_id, route_id, scheduled_date, scheduled_time, status, created_at,
    property:cadenza_properties!property_id(id, customer_name, address),
    technician:cadenza_profiles!technician_id(id, full_name),
    route:cadenza_routes!route_id(id, name)
  `;

  const { issues: openIssues, schemaPending: issuesSchemaPending } = await loadDashboardIssues(
    client,
    profile.company_id as string,
  );
  const issueQueue = buildJobQueue(openIssues);
  const followUpJobIds = issueQueue.map((entry) => entry.job_id);
  const queueByJobId = new Map(issueQueue.map((entry) => [entry.job_id, entry]));

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
            .order('scheduled_time', { ascending: false, nullsFirst: false });
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
    issueJobs = issueJobsRes.data
      .map((row) => {
        const job = normalizeDashboardJob(row as Record<string, unknown>);
        const entry = queueByJobId.get(job.id);
        const reportIssues = (entry?.issues ?? []).filter((i) => i.source === 'service_report');
        const categories = [...new Set(reportIssues.flatMap((i) => i.issue_categories))];
        return {
          ...job,
          issue_categories: normalizeIssueCategories(categories),
          follow_up_notes: reportIssues.find((i) => i.summary)?.summary ?? null,
          days_open: entry?.days_open ?? 0,
          has_voice_note_problem: (entry?.issues ?? []).some((i) => i.source === 'voice_note'),
        };
      })
      // Oldest open issue first (the query order is the tie-break).
      .sort((a, b) => b.days_open - a.days_open)
      .slice(0, DASHBOARD_ISSUE_LIMIT);
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
    issuesSchemaPending,
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
