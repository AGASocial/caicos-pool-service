'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, MapPin, Users, Building2, ChevronRight, Route as RouteIcon } from "lucide-react";
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { DashboardJob } from '@/lib/server-data';

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
      <Link href={`/jobs/${job.id}`} className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors">
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
          <span className="inline-flex items-center gap-1 rounded-full bg-info-soft text-info-soft-foreground px-2.5 py-0.5 text-xs font-medium shrink-0">
            <RouteIcon className="h-3 w-3" aria-hidden />
            {routeName}
          </span>
        )}
        <span aria-hidden className={cn("h-2 w-2 rounded-full shrink-0", dotClass)} />
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>
    </li>
  );
}

export default function DashboardClient({
  stats,
  completedJobs,
  pendingJobs,
}: {
  stats: DashboardStats;
  completedJobs: DashboardJob[];
  pendingJobs: DashboardJob[];
}) {
  const t = useTranslations();

  return (
    <div className="flex-1 space-y-8 p-4 sm:p-8 pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t('dashboard')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('dashboardOverview')}</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t('jobs'), icon: Briefcase, value: stats.totalJobs, sub: t('totalJobsLabel'), chip: 'icon-bg-primary' },
          { label: t('routes'), icon: MapPin, value: stats.totalRoutes, sub: t('totalRoutesLabel'), chip: 'icon-bg-success' },
          { label: t('team'), icon: Users, value: stats.totalTeamMembers, sub: t('totalTeamMembersLabel'), chip: 'icon-bg-accent' },
          { label: t('properties'), icon: Building2, value: stats.totalProperties, sub: t('totalPropertiesLabel'), chip: 'icon-bg-info' },
        ].map((item, i) => (
          <Card key={item.label} className={`hover-lift animate-fade-in-up delay-${(i + 1) * 100}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">{item.label}</CardTitle>
              <div className={`icon-chip ${item.chip}`}>
                <item.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground tracking-tight">{item.value}</div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 animate-fade-in-up delay-500">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-foreground">
                <span className="status-dot status-dot--success" aria-hidden />
                {t('recentCompletedJobs')}
              </CardTitle>
              <CardDescription>{t('status_completed')}</CardDescription>
            </div>
            <Link href="/jobs?status=completed"><Button variant="ghost" size="sm">{t('jobs')}</Button></Link>
          </CardHeader>
          <CardContent>
            {completedJobs.length === 0 ? (
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-foreground">
                <span className="status-dot status-dot--warning" aria-hidden />
                {t('recentPendingJobs')}
              </CardTitle>
              <CardDescription>{t('status_pending')}</CardDescription>
            </div>
            <Link href="/jobs?status=pending"><Button variant="ghost" size="sm">{t('jobs')}</Button></Link>
          </CardHeader>
          <CardContent>
            {pendingJobs.length === 0 ? (
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
