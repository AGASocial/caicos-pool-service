"use client";
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, MapPin, Users, Building2, CheckCircle2, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from '@/i18n/navigation';

type DashboardJob = {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  created_at: string;
  property: { id: string; customer_name: string; address: string } | null;
  technician: { id: string; full_name: string } | null;
};

type DashboardStats = {
  totalJobs: number;
  totalRoutes: number;
  totalTeamMembers: number;
  totalProperties: number;
};

function JobRow({ job }: { job: DashboardJob }) {
  const propertyName = job.property?.customer_name ?? '—';
  const technicianName = job.technician?.full_name ?? '—';
  const date = job.scheduled_date;
  const time = job.scheduled_time ? String(job.scheduled_time).slice(0, 5) : '';

  return (
    <Link href={`/jobs/${job.id}`}>
      <div className="group flex items-center justify-between p-3 border border-transparent rounded-xl bg-white/5 hover:bg-white/10 transition-all hover:border-primary/10">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground truncate">{propertyName}</p>
          <p className="text-sm text-muted-foreground truncate">
            {technicianName} · {date}{time ? ` ${time}` : ''}
          </p>
        </div>
      </div>
    </Link>
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
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t('dashboard')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t('dashboardOverview')}</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-panel hover-lift border-border/50 animate-fade-in-up delay-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {t('jobs')}
            </CardTitle>
            <div className="p-2.5 rounded-xl bg-primary/10 shadow-inner">
              <Briefcase className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground tracking-tight">{stats.totalJobs}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {t('totalJobsLabel')}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-panel hover-lift border-border/50 animate-fade-in-up delay-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {t('routes')}
            </CardTitle>
            <div className="p-2.5 rounded-xl icon-bg-success shadow-inner">
              <MapPin className="h-4 w-4 icon-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground tracking-tight">{stats.totalRoutes}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {t('totalRoutesLabel')}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-panel hover-lift border-border/50 animate-fade-in-up delay-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {t('team')}
            </CardTitle>
            <div className="p-2.5 rounded-xl icon-bg-accent shadow-inner">
              <Users className="h-4 w-4 icon-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground tracking-tight">{stats.totalTeamMembers}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {t('totalTeamMembersLabel')}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-panel hover-lift border-border/50 animate-fade-in-up delay-[400ms]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {t('properties')}
            </CardTitle>
            <div className="p-2.5 rounded-xl icon-bg-info shadow-inner">
              <Building2 className="h-4 w-4 icon-info" />
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
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 animate-fade-in-up delay-[500ms]">
        <Card className="col-span-1 glass-card border-none shadow-xl bg-card/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-white/5 pb-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                {t('recentCompletedJobs')}
              </CardTitle>
              <CardDescription className="text-base">{t('status_completed')}</CardDescription>
            </div>
            <Link href="/jobs?status=completed">
              <Button variant="ghost" size="sm">{t('jobs')}</Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : completedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">{t('noCompletedJobs')}</p>
                <Link href="/jobs">
                  <Button variant="outline" size="sm" className="mt-3">{t('jobs')}</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {completedJobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 glass-card border-none shadow-xl bg-card/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-white/5 pb-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                {t('recentPendingJobs')}
              </CardTitle>
              <CardDescription className="text-base">{t('status_pending')}</CardDescription>
            </div>
            <Link href="/jobs?status=pending">
              <Button variant="ghost" size="sm">{t('jobs')}</Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : pendingJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">{t('noPendingJobs')}</p>
                <Link href="/jobs">
                  <Button variant="outline" size="sm" className="mt-3">{t('jobs')}</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingJobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
