'use client';

import { useTranslations } from 'next-intl';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { Briefcase, ChevronRight, Radio, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useTeam } from '@/lib/team';
import { useJobs, useRoutes } from '@/lib/data-queries';
import { monthBoundsCalendar, weekBoundsMonday } from '@/lib/date-week';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/ui/loading-state';
import { useAuth } from '@/lib/auth';
import { hasEntitlement, isOfficeRole } from '@/lib/entitlements';
import { NoAssignedRoute } from '@/components/NoAssignedRoute';

type PropertyRef = { id: string; customer_name: string; address?: string };
type TechnicianRef = { id: string; full_name: string };
type RouteRef = { id: string; name: string } | null;
type VisitKindRef = { id: string; slug: string; label: string } | null;
type JobRow = {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  property_id: string;
  technician_id: string | null;
  route_id: string | null;
  job_source?: string;
  property?: PropertyRef;
  technician?: TechnicianRef | null;
  route?: RouteRef;
  visit_kind?: VisitKindRef;
};

const STATUS_KEYS: Record<string, string> = {
  pending: 'status_pending',
  in_progress: 'status_in_progress',
  completed: 'status_completed',
  skipped: 'status_skipped',
  cancelled: 'status_cancelled',
};

function jobStatusBadgeClassName(status: string) {
  switch (status) {
    case 'completed':
      return 'border-transparent bg-success text-success-foreground hover:bg-success/90';
    case 'in_progress':
      return 'border-transparent bg-info text-info-foreground hover:bg-info/90';
    case 'pending':
      return 'border-transparent bg-warning text-warning-foreground hover:bg-warning/90';
    case 'cancelled':
      return 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90';
    case 'skipped':
      return 'border-transparent bg-muted text-muted-foreground hover:bg-muted/90';
    default:
      return 'border-transparent bg-muted text-muted-foreground';
  }
}

export default function JobsPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isOffice = isOfficeRole(user?.profile?.role);
  const canCreateJob = hasEntitlement(user?.profile?.role, 'job', 'create');
  const noAssignedRoute = user?.technicianScope?.hasAssignedRoutes === false;
  const week = weekBoundsMonday();
  const followUpFromUrl = searchParams.get('needs_follow_up') === '1';
  const [dateFrom, setDateFrom] = useState(week.to);
  const [dateTo, setDateTo] = useState(week.to);
  const [teamMemberId, setTeamMemberId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [jobSourceFilter, setJobSourceFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [dayOfWeekFilter, setDayOfWeekFilter] = useState('');
  const [needsFollowUpFilter, setNeedsFollowUpFilter] = useState(followUpFromUrl);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(followUpFromUrl);
  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: week.to,
    dateTo: week.to,
    teamMemberId: '',
    statusFilter: '',
    jobSourceFilter: '',
    routeFilter: '',
    dayOfWeekFilter: '',
    needsFollowUpFilter: followUpFromUrl,
  });

  useEffect(() => {
    if (followUpFromUrl) {
      setNeedsFollowUpFilter(true);
      setMoreFiltersOpen(true);
      setAppliedFilters((prev) => ({ ...prev, needsFollowUpFilter: true }));
    }
  }, [followUpFromUrl]);

  const { data: teamMembers = [] } = useTeam({ enabled: isOffice });
  const { data: routesResult } = useRoutes({ enabled: hasEntitlement(user?.profile?.role, 'route', 'view') });
  const routes = (routesResult?.data ?? []) as { id: string; name: string }[];

  const jobFilters = useMemo(
    () => ({
      date_from: appliedFilters.needsFollowUpFilter ? undefined : appliedFilters.dateFrom,
      date_to: appliedFilters.needsFollowUpFilter ? undefined : appliedFilters.dateTo,
      technician_id: appliedFilters.teamMemberId || undefined,
      status: appliedFilters.statusFilter || undefined,
      job_source:
        appliedFilters.jobSourceFilter === 'route' || appliedFilters.jobSourceFilter === 'ad_hoc'
          ? appliedFilters.jobSourceFilter
          : undefined,
      route_id: appliedFilters.routeFilter || undefined,
      day_of_week: appliedFilters.dayOfWeekFilter,
      needs_follow_up: appliedFilters.needsFollowUpFilter || undefined,
    }),
    [appliedFilters],
  );

  const { data: jobsResult, isLoading, error, refetch, isFetching } = useJobs(jobFilters);
  const jobs = (jobsResult?.data ?? []) as JobRow[];
  const hasMore = jobsResult?.pagination.hasMore ?? false;

  function applyFilters(dateRange?: { dateFrom?: string; dateTo?: string }) {
    setAppliedFilters({
      dateFrom: dateRange?.dateFrom ?? dateFrom,
      dateTo: dateRange?.dateTo ?? dateTo,
      teamMemberId,
      statusFilter,
      jobSourceFilter,
      routeFilter,
      dayOfWeekFilter,
      needsFollowUpFilter,
    });
  }

  function setToday() {
    const today = new Date().toISOString().slice(0, 10);
    setDateFrom(today);
    setDateTo(today);
    setAppliedFilters((prev) => ({ ...prev, dateFrom: today, dateTo: today }));
  }

  function setThisWeek() {
    const w = weekBoundsMonday();
    setDateFrom(w.from);
    setDateTo(w.to);
    setAppliedFilters((prev) => ({ ...prev, dateFrom: w.from, dateTo: w.to }));
  }

  function setThisMonth() {
    const m = monthBoundsCalendar();
    setDateFrom(m.from);
    setDateTo(m.to);
    setAppliedFilters((prev) => ({ ...prev, dateFrom: m.from, dateTo: m.to }));
  }

  function statusLabel(s: string) {
    return t(STATUS_KEYS[s] || 'status_pending');
  }

  const errorMessage = error instanceof Error ? error.message : null;

  if (noAssignedRoute) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t('jobs')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('jobsDescription')}</p>
        </div>
        <NoAssignedRoute />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t('jobs')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('jobsDescription')}</p>
        </div>
        {canCreateJob && (
          <Button asChild className="w-fit shrink-0">
            <Link href="/jobs/new?mode=dispatch">
              <Radio className="mr-2 h-4 w-4" />
              {t('adHocDispatch')}
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[140px] h-9"
            />
            <span className="text-muted-foreground text-sm">–</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[140px] h-9"
            />
            <Button type="button" variant="secondary" size="sm" onClick={setToday}>
              {t('today')}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={setThisWeek}>
              {t('thisWeek')}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={setThisMonth}>
              {t('thisMonth')}
            </Button>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm min-w-[130px]"
            >
              <option value="">{t('allStatuses')}</option>
              {['pending', 'in_progress', 'completed', 'skipped', 'cancelled'].map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => applyFilters()}>
              {t('applyFilters')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMoreFiltersOpen((v) => !v)}
              className="ml-auto gap-1.5"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t('moreFilters', { defaultValue: 'More Filters' })}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreFiltersOpen ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          {moreFiltersOpen && isOffice && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('filterByTeamMember')}</Label>
                <select
                  value={teamMemberId}
                  onChange={(e) => setTeamMemberId(e.target.value)}
                  className="flex h-9 w-full min-w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">{t('all', { defaultValue: 'All' })}</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>{member.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('filterByRoute')}</Label>
                <select
                  value={routeFilter}
                  onChange={(e) => setRouteFilter(e.target.value)}
                  className="flex h-9 w-full min-w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">{t('all', { defaultValue: 'All' })}</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('filterByDayOfWeek')}</Label>
                <select
                  value={dayOfWeekFilter}
                  onChange={(e) => setDayOfWeekFilter(e.target.value)}
                  className="flex h-9 w-full min-w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">{t('all', { defaultValue: 'All' })}</option>
                  <option value="0">{t('dow_sunday')}</option>
                  <option value="1">{t('dow_monday')}</option>
                  <option value="2">{t('dow_tuesday')}</option>
                  <option value="3">{t('dow_wednesday')}</option>
                  <option value="4">{t('dow_thursday')}</option>
                  <option value="5">{t('dow_friday')}</option>
                  <option value="6">{t('dow_saturday')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('filterByJobSource')}</Label>
                <select
                  value={jobSourceFilter}
                  onChange={(e) => setJobSourceFilter(e.target.value)}
                  className="flex h-9 w-full min-w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">{t('all', { defaultValue: 'All' })}</option>
                  <option value="route">{t('jobSource_route')}</option>
                  <option value="ad_hoc">{t('jobSource_ad_hoc')}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm h-9 cursor-pointer">
                <input
                  type="checkbox"
                  checked={needsFollowUpFilter}
                  onChange={(e) => setNeedsFollowUpFilter(e.target.checked)}
                  className="rounded border-input"
                />
                {t('filterNeedsFollowUp')}
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('jobs')}</CardTitle>
          <CardDescription>{t('jobsCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <LoadingState size="sm" padded={false} className="py-8" />}
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          {!isLoading && !errorMessage && jobs.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noJobsYet')}</p>
          )}
          {!isLoading && !errorMessage && jobs.length > 0 && (
            <ul className="divide-y divide-border">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Briefcase className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{job.property?.customer_name ?? job.property_id}</span>
                      <div className="text-muted-foreground text-sm mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-1">
                        <span>
                          {job.scheduled_date}
                          {job.scheduled_time ? ` ${job.scheduled_time}` : ''}
                        </span>
                        <span className="text-muted-foreground/70" aria-hidden>·</span>
                        <span>{job.technician?.full_name ?? '—'}</span>
                        <span className="text-muted-foreground/70" aria-hidden>·</span>
                        <Badge className={cn('align-middle font-medium', jobStatusBadgeClassName(job.status))}>
                          {statusLabel(job.status)}
                        </Badge>
                        {job.route?.name ? (
                          <>
                            <span className="text-muted-foreground/70" aria-hidden>·</span>
                            <span>{job.route.name}</span>
                          </>
                        ) : null}
                        {job.job_source === 'ad_hoc' && (
                          <>
                            <span className="text-muted-foreground/70" aria-hidden>·</span>
                            <span className="text-foreground/80">{t('jobSource_ad_hoc')}</span>
                          </>
                        )}
                        {job.visit_kind?.label && (
                          <>
                            <span className="text-muted-foreground/70" aria-hidden>·</span>
                            <span>{job.visit_kind.label}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                {t('loadMore', { defaultValue: 'Load more' })}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
