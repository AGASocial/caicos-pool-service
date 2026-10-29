'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Radio, User, MapPin, Clock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createBrowserClient } from '@supabase/ssr';

type JobStatus = 'pending' | 'en_route' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';

type StatusBoardJob = {
  id: string;
  status: JobStatus;
  scheduled_date: string;
  scheduled_time: string | null;
  en_route_at: string | null;
  technician_id: string | null;
  route_id: string | null;
  technician?: { id: string; full_name: string } | null;
  route?: { id: string; name: string } | null;
  property?: { id: string; customer_name: string; address: string } | null;
  cadenza_service_reports?: Array<{
    arrival_time: string | null;
    departure_time: string | null;
  }> | null;
};

type TechnicianGroup = {
  technician_id: string;
  technician_name: string;
  jobs: StatusBoardJob[];
};

function getRelativeTime(timestamp: string | null, t: ReturnType<typeof useTranslations>): string {
  if (!timestamp) return '';
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('timeNow');
  if (minutes < 60) return t('timeMinutesAgo', { minutes });
  const hours = Math.floor(minutes / 60);
  return t('timeHoursAgo', { hours });
}

function getJobStateLabel(
  job: StatusBoardJob,
  t: ReturnType<typeof useTranslations>
): { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; time: string; className?: string } {
  const reports = Array.isArray(job.cadenza_service_reports) ? job.cadenza_service_reports : [];
  const report = reports[0];

  if (job.status === 'completed' && report?.departure_time) {
    return {
      label: t('statusDone'),
      variant: 'default',
      className: 'bg-green-500 text-white hover:bg-green-600',
      time: getRelativeTime(report.departure_time, t),
    };
  }

  if (job.status === 'in_progress' && report?.arrival_time) {
    return {
      label: t('statusOnSite'),
      variant: 'default',
      time: getRelativeTime(report.arrival_time, t),
    };
  }

  if (job.status === 'en_route' && job.en_route_at) {
    return {
      label: t('statusOnTheWay'),
      variant: 'secondary',
      time: getRelativeTime(job.en_route_at, t),
    };
  }

  if (job.status === 'skipped') {
    return {
      label: t('statusSkipped'),
      variant: 'outline',
      time: '',
    };
  }

  return {
    label: t('statusPending'),
    variant: 'outline',
    time: '',
  };
}

export function LiveStatusBoard() {
  const t = useTranslations();
  const [jobs, setJobs] = useState<StatusBoardJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [selectedTechnician, setSelectedTechnician] = useState<string>('all');

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    async function checkAccess() {
      try {
        const response = await fetch('/api/billing/plan-features');
        if (response.ok) {
          const data = await response.json();
          const liveStatusBoard = data.features?.live_status_board;
          setHasAccess(liveStatusBoard !== false);
        } else {
          setHasAccess(true);
        }
      } catch (e) {
        console.error('Failed to check plan features:', e);
        setHasAccess(true);
      }
    }

    checkAccess();
  }, []);

  useEffect(() => {
    if (hasAccess === null || !hasAccess) return;

    async function loadJobs() {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('cadenza_service_jobs')
        .select(
          `
          id,
          status,
          scheduled_date,
          scheduled_time,
          en_route_at,
          technician_id,
          route_id,
          technician:cadenza_profiles!cadenza_service_jobs_technician_id_fkey(id, full_name),
          route:cadenza_routes!cadenza_service_jobs_route_id_fkey(id, name),
          property:cadenza_properties!cadenza_service_jobs_property_id_fkey(id, customer_name, address),
          cadenza_service_reports(arrival_time, departure_time)
        `
        )
        .eq('scheduled_date', today)
        .eq('is_deleted', false)
        .order('scheduled_time', { ascending: true });

      if (error) {
        console.error('Failed to load jobs:', error);
        setLoading(false);
        return;
      }

      setJobs((data as unknown as StatusBoardJob[]) ?? []);
      setLoading(false);
    }

    loadJobs();

    const channel = supabase
      .channel('status-board')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cadenza_service_jobs',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            loadJobs();
          } else if (payload.eventType === 'UPDATE') {
            const newJob = payload.new as Partial<StatusBoardJob>;
            setJobs((prev) =>
              prev.map((j) =>
                j.id === newJob.id
                  ? {
                      ...j,
                      status: (newJob.status ?? j.status) as JobStatus,
                      en_route_at: newJob.en_route_at ?? j.en_route_at,
                    }
                  : j
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setJobs((prev) => prev.filter((j) => j.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cadenza_service_reports',
        },
        () => {
          loadJobs();
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, hasAccess]);

  const routes = useMemo(() => {
    const routeMap = new Map<string, { id: string; name: string }>();
    jobs.forEach((job) => {
      const route = Array.isArray(job.route) ? job.route[0] : job.route;
      if (route?.id) {
        routeMap.set(route.id, route);
      }
    });
    return Array.from(routeMap.values());
  }, [jobs]);

  const technicians = useMemo(() => {
    const techMap = new Map<string, { id: string; full_name: string }>();
    jobs.forEach((job) => {
      const tech = Array.isArray(job.technician) ? job.technician[0] : job.technician;
      if (tech?.id) {
        techMap.set(tech.id, tech);
      }
    });
    return Array.from(techMap.values());
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (selectedRoute !== 'all' && job.route_id !== selectedRoute) return false;
      if (selectedTechnician !== 'all' && job.technician_id !== selectedTechnician) return false;
      return true;
    });
  }, [jobs, selectedRoute, selectedTechnician]);

  const groupedByTechnician = useMemo<TechnicianGroup[]>(() => {
    const groups = new Map<string, TechnicianGroup>();

    filteredJobs.forEach((job) => {
      const techId = job.technician_id ?? 'unassigned';
      const tech = Array.isArray(job.technician) ? job.technician[0] : job.technician;
      const techName = tech?.full_name ?? 'Unassigned';

      if (!groups.has(techId)) {
        groups.set(techId, {
          technician_id: techId,
          technician_name: techName,
          jobs: [],
        });
      }
      groups.get(techId)!.jobs.push(job);
    });

    return Array.from(groups.values());
  }, [filteredJobs]);

  if (hasAccess === null) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-muted-foreground" />
            {t('liveStatusBoard')}
          </CardTitle>
          <CardDescription>{t('liveStatusBoardDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">{t('upgradeForLiveStatus')}</p>
          <Link
            href="/billing/plans"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            {t('upgradeNow')}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-success animate-pulse" />
                {t('liveStatusBoard')}
              </CardTitle>
              <CardDescription>{t('liveStatusBoardDescription')}</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
              >
                <option value="all">{t('allRoutes')}</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={selectedTechnician}
                onChange={(e) => setSelectedTechnician(e.target.value)}
              >
                <option value="all">{t('allTechnicians')}</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : groupedByTechnician.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('noJobsForToday')}</p>
          ) : (
            <div className="space-y-6">
              {groupedByTechnician.map((group) => (
                <div key={group.technician_id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">{group.technician_name}</h3>
                    <Badge variant="outline" className="ml-auto">
                      {group.jobs.length} {group.jobs.length === 1 ? 'job' : 'jobs'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {group.jobs.map((job) => {
                      const { label, variant, time, className } = getJobStateLabel(job, t);
                      const property = Array.isArray(job.property) ? job.property[0] : job.property;
                      return (
                        <div
                          key={job.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {property?.customer_name ?? '—'}
                            </div>
                            {property?.address && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {property.address}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {time && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {time}
                              </div>
                            )}
                            <Badge variant={variant} className={className}>{label}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
  );
}
