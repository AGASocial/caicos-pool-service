'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ByStatus = {
  pending: number;
  in_progress: number;
  completed: number;
  skipped: number;
  cancelled: number;
};

type TechnicianRow = {
  technicianId: string;
  fullName: string;
  total: number;
  completed: number;
};

type ReportsStats = {
  total: number;
  byStatus: ByStatus;
  completionRate: number;
  byTechnician: TechnicianRow[];
};

export default function ReportsPage() {
  const t = useTranslations();

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [appliedFrom, setAppliedFrom] = useState(today);
  const [appliedTo, setAppliedTo] = useState(today);

  const [stats, setStats] = useState<ReportsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats(from: string, to: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('date_from', from);
      if (to) params.set('date_to', to);
      const res = await fetch(`/api/reports/jobs?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || res.statusText);
        setLoading(false);
        return;
      }
      const data: ReportsStats = await res.json();
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats(appliedFrom, appliedTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApply() {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    fetchStats(dateFrom, dateTo);
  }

  const completionRatePct = stats ? Math.round(stats.completionRate * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">
          {t('reports')}
        </h1>
        <p className="text-muted-foreground dark:text-gray-700">{t('reportsDescription')}</p>
      </div>

      {/* Date range filter */}
      <Card>
        <CardHeader>
          <CardTitle>{t('applyFilters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-from">{t('dateFrom')}</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">{t('dateTo')}</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button onClick={handleApply} disabled={loading}>
              {loading ? t('loading') : t('applyFilters')}
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Stat cards */}
      {loading && !stats ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('totalJobs')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('completed')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.byStatus.completed}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('pending')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.byStatus.pending}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('completionRate')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{completionRatePct}%</p>
              </CardContent>
            </Card>
          </div>

          {/* By-technician table */}
          <Card>
            <CardHeader>
              <CardTitle>{t('technician')}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.byTechnician.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noData')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">
                          {t('technician')}
                        </th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">
                          {t('totalJobs')}
                        </th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">
                          {t('completed')}
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground text-right">
                          {t('completionRate')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byTechnician.map((row) => {
                        const rate =
                          row.total > 0
                            ? Math.round((row.completed / row.total) * 100)
                            : 0;
                        return (
                          <tr key={row.technicianId} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">{row.fullName}</td>
                            <td className="py-2 pr-4 text-right">{row.total}</td>
                            <td className="py-2 pr-4 text-right">{row.completed}</td>
                            <td className="py-2 text-right">{rate}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
