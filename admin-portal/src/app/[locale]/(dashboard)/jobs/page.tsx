'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { Briefcase, ChevronRight, Radio } from 'lucide-react';
import { useTeam } from '@/lib/team';
import { monthBoundsCalendar, weekBoundsMonday } from '@/lib/date-week';

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

export default function JobsPage() {
  const t = useTranslations();
  const week = weekBoundsMonday();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(week.from);
  const [dateTo, setDateTo] = useState(week.to);
  const [teamMemberId, setTeamMemberId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [jobSourceFilter, setJobSourceFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [dayOfWeekFilter, setDayOfWeekFilter] = useState('');
  const [routes, setRoutes] = useState<{ id: string; name: string }[]>([]);
  const { data: teamMembers = [] } = useTeam();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/routes');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setRoutes(Array.isArray(data) ? data : []);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function jobsQueryString() {
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (teamMemberId) params.set('technician_id', teamMemberId);
    if (statusFilter) params.set('status', statusFilter);
    if (jobSourceFilter === 'route' || jobSourceFilter === 'ad_hoc') {
      params.set('job_source', jobSourceFilter);
    }
    if (routeFilter) params.set('route_id', routeFilter);
    if (dayOfWeekFilter !== '') params.set('day_of_week', dayOfWeekFilter);
    return params.toString();
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs?${jobsQueryString()}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || res.statusText);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) setJobs(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load; filters via applyFilters
  }, []);

  async function applyFilters() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs?${jobsQueryString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText);
        setLoading(false);
        return;
      }
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  function setThisWeek() {
    const w = weekBoundsMonday();
    setDateFrom(w.from);
    setDateTo(w.to);
  }

  function setThisMonth() {
    const m = monthBoundsCalendar();
    setDateFrom(m.from);
    setDateTo(m.to);
  }

  function statusLabel(s: string) {
    return t(STATUS_KEYS[s] || 'status_pending');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('jobs')}</h1>
          <p className="text-muted-foreground">{t('jobsDescription')}</p>
        </div>
        <Button asChild className="w-fit shrink-0">
          <Link href="/jobs/new?mode=dispatch">
            <Radio className="mr-2 h-4 w-4" />
            {t('adHocDispatch')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('jobs')}</CardTitle>
          <CardDescription>{t('jobsCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('dateFrom')}</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('dateTo')}</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={setThisWeek}>
              {t('thisWeek')}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={setThisMonth}>
              {t('thisMonth')}
            </Button>
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
              <Label className="text-xs">{t('filterByStatus')}</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-9 w-full min-w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">{t('allStatuses')}</option>
                {['pending', 'in_progress', 'completed', 'skipped', 'cancelled'].map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
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
            <Button size="sm" onClick={applyFilters}>{t('applyFilters')}</Button>
          </div>

          {loading && <p className="text-sm text-muted-foreground">{t('loading', { defaultValue: 'Loading…' })}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && jobs.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noJobsYet')}</p>
          )}
          {!loading && !error && jobs.length > 0 && (
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
                      <span className="text-muted-foreground text-sm block">
                        {job.scheduled_date}
                        {job.scheduled_time ? ` ${job.scheduled_time}` : ''}
                        {' · '}
                        {job.technician?.full_name ?? '—'}
                        {' · '}
                        {statusLabel(job.status)}
                        {job.route?.name ? ` · ${job.route.name}` : ''}
                        {job.job_source === 'ad_hoc' && (
                          <>
                            {' · '}
                            <span className="text-foreground/80">{t('jobSource_ad_hoc')}</span>
                          </>
                        )}
                        {job.visit_kind?.label && (
                          <>
                            {' · '}
                            {job.visit_kind.label}
                          </>
                        )}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
