'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, MapPin, Users, Building2, ChevronRight, Route as RouteIcon, AlertTriangle } from "lucide-react";
import { Link } from '@/i18n/navigation';
import type { DashboardIssueJob, DashboardJob } from '@/lib/server-data';

type DashboardStats = {
  totalJobs: number;
  totalRoutes: number;
  totalTeamMembers: number;
  totalProperties: number;
};

function PendingJobRow({ job }: { job: DashboardJob }) {
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
            {job.scheduled_time && <span>{job.scheduled_time.slice(0, 5)}</span>}
            {job.scheduled_time && (address || technicianName) && <span className="mx-1.5 opacity-60">·</span>}
            {address && <span>{address}</span>}
            {address && technicianName && <span className="mx-1.5 opacity-60">·</span>}
            {technicianName && <span>{technicianName}</span>}
            {!job.scheduled_time && !address && !technicianName && <span className="opacity-60">—</span>}
          </div>
        </div>
        {routeName && (
          <span className="inline-flex items-center gap-1 rounded-full bg-info-soft text-info-soft-foreground px-2.5 py-0.5 text-xs font-medium shrink-0">
            <RouteIcon className="h-3 w-3" aria-hidden />
            {routeName}
          </span>
        )}
        <span aria-hidden className="h-2 w-2 rounded-full shrink-0 bg-warning" />
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>
    </li>
  );
}

function IssueJobRow({ job }: { job: DashboardIssueJob }) {
  const t = useTranslations();
  const propertyName = job.property?.customer_name ?? '—';
  const address = job.property?.address;
  const technicianName = job.technician?.full_name;
  const routeName = job.route?.name;

  return (
    <li>
      <Link href={`/jobs/${job.id}`} className="flex items-start gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="font-medium text-foreground truncate">{propertyName}</div>
          <div className="text-sm text-muted-foreground truncate">
            {address && <span>{address}</span>}
            {address && technicianName && <span className="mx-1.5 opacity-60">·</span>}
            {technicianName && <span>{technicianName}</span>}
            {!address && !technicianName && (
              <span>{job.scheduled_date}</span>
            )}
          </div>
          {job.issue_categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {job.issue_categories.map((key) => (
                <Badge
                  key={key}
                  variant="outline"
                  className="border-warning/40 bg-warning/10 text-warning-foreground text-xs"
                >
                  {t(`issue_${key}`)}
                </Badge>
              ))}
            </div>
          )}
          {job.follow_up_notes && (
            <p className="text-xs text-muted-foreground line-clamp-2">{job.follow_up_notes}</p>
          )}
        </div>
        {routeName && (
          <span className="inline-flex items-center gap-1 rounded-full bg-info-soft text-info-soft-foreground px-2.5 py-0.5 text-xs font-medium shrink-0">
            <RouteIcon className="h-3 w-3" aria-hidden />
            {routeName}
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </Link>
    </li>
  );
}

export default function DashboardClient({
  stats,
  issueJobs,
  pendingJobsToday,
}: {
  stats: DashboardStats;
  issueJobs: DashboardIssueJob[];
  pendingJobsToday: DashboardJob[];
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
                <span className="status-dot status-dot--warning" aria-hidden />
                {t('jobsWithIssues')}
              </CardTitle>
              <CardDescription>{t('jobsWithIssuesDescription')}</CardDescription>
            </div>
            <Link href="/jobs?needs_follow_up=1">
              <Button variant="ghost" size="sm">{t('viewAll')}</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {issueJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{t('noJobsWithIssues')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {issueJobs.map((job) => (
                  <IssueJobRow key={job.id} job={job} />
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
                {t('pendingJobsToday')}
              </CardTitle>
              <CardDescription>{t('status_pending')} · {t('today')}</CardDescription>
            </div>
            <Link href="/jobs?status=pending">
              <Button variant="ghost" size="sm">{t('viewAll')}</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {pendingJobsToday.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{t('noPendingJobsToday')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {pendingJobsToday.map((job) => (
                  <PendingJobRow key={job.id} job={job} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
