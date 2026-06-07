"use client";
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, MapPin, Users, Building2, ChevronRight, Route as RouteIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type DashboardJob = {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  created_at: string;
  property: { id: string; customer_name: string; address: string } | null;
  technician: { id: string; full_name: string } | null;
  route: { id: string; name: string } | null;
};

type DashboardStats = {
  totalJobs: number;
  totalRoutes: number;
  totalTeamMembers: number;
  totalProperties: number;
};

function JobRow({ job, dotClass }: { job: DashboardJob; dotClass: string }) {
  const t = useTranslations();
  const propertyName = job.property?.customer_name ?? '—';
  const address = job.property?.address;
  const technicianName = job.technician?.full_name;
  const routeName = job.route?.name;

  return (
    <li>
      <Link
        href={`/jobs/${job.id}`}
        className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors"
      >
        <Briefcase className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground truncate">{propertyName}</div>
          <div className="text-sm text-muted-foreground truncate">
            {address && <span>{address}</span>}
            {address && technicianName && <span className="mx-1.5 opacity-60">·</span>}
            {technicianName && <span>{technicianName}</span>}
            {!address && !technicianName && <span className="opacity-60">—</span>}
          </div>
        </div>
        {routeName && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-info-soft text-info-soft-foreground px-2.5 py-0.5 text-xs font-medium shrink-0"
            title={`${t('route')}: ${routeName}`}
          >
            <RouteIcon className="h-3 w-3" aria-hidden />
            {routeName}
          </span>
        )}
        <span
          aria-hidden
          className={cn("h-2 w-2 rounded-full shrink-0", dotClass)}
        />
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>
    </li>
  );
}

export default function DashboardPage() {
  const t = useTranslations();
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    totalRoutes: 0,
    totalTeamMembers: 0,
    totalProperties: 0,
  });
  const [completedJobs, setCompletedJobs] = useState<DashboardJob[]>([]);
  const [pendingJobs, setPendingJobs] = useState<DashboardJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) return;
        const data = await res.json();
        setStats(data.stats ?? stats);
        setCompletedJobs(data.completedJobs ?? []);
        setPendingJobs(data.pendingJobs ?? []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  return (
    <div className="flex-1 space-y-8 p-4 sm:p-8 pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t('dashboard')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('dashboardOverview')}</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-lift animate-fade-in-up delay-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {t('jobs')}
            </CardTitle>
            <div className="icon-chip icon-bg-primary">
              <Briefcase className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground tracking-tight">{stats.totalJobs}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {t('totalJobsLabel')}
            </p>
          </CardContent>
        </Card>
        <Card className="hover-lift animate-fade-in-up delay-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {t('routes')}
            </CardTitle>
            <div className="icon-chip icon-bg-success">
              <MapPin className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground tracking-tight">{stats.totalRoutes}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {t('totalRoutesLabel')}
            </p>
          </CardContent>
        </Card>
        <Card className="hover-lift animate-fade-in-up delay-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {t('team')}
            </CardTitle>
            <div className="icon-chip icon-bg-accent">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground tracking-tight">{stats.totalTeamMembers}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {t('totalTeamMembersLabel')}
            </p>
          </CardContent>
        </Card>
        <Card className="hover-lift animate-fade-in-up delay-400">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {t('properties')}
            </CardTitle>
            <div className="icon-chip icon-bg-info">
              <Building2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground tracking-tight">{stats.totalProperties}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {t('totalPropertiesLabel')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Cards: Completed (left) and Pending (right) */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 animate-fade-in-up delay-500">
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-foreground">
                <span className="status-dot status-dot--success" aria-hidden />
                {t('recentCompletedJobs')}
              </CardTitle>
              <CardDescription>{t('status_completed')}</CardDescription>
            </div>
            <Link href="/jobs?status=completed">
              <Button variant="ghost" size="sm">{t('jobs')}</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">
                {t('loading', { defaultValue: 'Loading…' })}
              </p>
            ) : completedJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{t('noCompletedJobs')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {completedJobs.map((job) => (
                  <JobRow key={job.id} job={job} dotClass="bg-success" />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-foreground">
                <span className="status-dot status-dot--warning" aria-hidden />
                {t('recentPendingJobs')}
              </CardTitle>
              <CardDescription>{t('status_pending')}</CardDescription>
            </div>
            <Link href="/jobs?status=pending">
              <Button variant="ghost" size="sm">{t('jobs')}</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">
                {t('loading', { defaultValue: 'Loading…' })}
              </p>
            ) : pendingJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{t('noPendingJobs')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {pendingJobs.map((job) => (
                  <JobRow key={job.id} job={job} dotClass="bg-warning" />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
