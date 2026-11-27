'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/ui/loading-state';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { hasEntitlement } from '@/lib/entitlements';
import type {
  DeliveryLogEntry,
  StatusGroup,
} from '@/lib/customer-reports/delivery-log-query';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';
import { translateDeliveryReason } from './delivery-reason';

const TABS: Array<{ group: StatusGroup; labelKey: string }> = [
  { group: 'unsent', labelKey: 'reportDeliveries_tabUnsent' },
  { group: 'all', labelKey: 'reportDeliveries_tabAll' },
  { group: 'sent', labelKey: 'reportDeliveries_tabSent' },
  { group: 'failed', labelKey: 'reportDeliveries_tabFailed' },
  { group: 'pending', labelKey: 'reportDeliveries_tabPending' },
];

type ListResponse = {
  data: DeliveryLogEntry[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
  unsent_count: number;
};

const PAGE_SIZE = 25;

export function ReportDeliveryLog() {
  const t = useTranslations();
  const { user } = useAuth();
  const canRetry = hasEntitlement(user?.profile?.role, 'report', 'edit');
  const searchParams = useSearchParams();
  const propertyId = searchParams?.get('property_id') ?? null;
  const jobId = searchParams?.get('job_id') ?? null;

  // Opening the log for one property / job answers "was it sent?" → start on All.
  const [group, setGroup] = useState<StatusGroup>(propertyId || jobId ? 'all' : 'unsent');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      status: group,
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (search) params.set('q', search);
    if (propertyId) params.set('property_id', propertyId);
    if (jobId) params.set('job_id', jobId);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    try {
      const res = await fetch(`/api/report-deliveries?${params.toString()}`);
      const body = await res.json().catch(() => ({}));
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        setError(
          body?.code === 'SCHEMA_PENDING'
            ? t('reportDeliveries_schemaPending')
            : body?.error || t('reportDeliveries_loadError'),
        );
        setResult(null);
        return;
      }
      setResult(body as ListResponse);
    } catch {
      if (seq === requestSeq.current) setError(t('reportDeliveries_loadError'));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [group, page, search, propertyId, jobId, dateFrom, dateTo, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRetry(entry: DeliveryLogEntry) {
    setRetryingId(entry.id);
    try {
      const res = await fetch(`/api/report-deliveries/${entry.id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: document.documentElement.lang || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error || t('reportDeliveries_retryFailed'));
        return;
      }
      if (body.status === 'sent') toast.success(t('reportDeliveries_retrySent'));
      else
        toast.info(
          t('reportDeliveries_retryResult', { status: t(`reportDeliveries_status_${body.status === 'queued' ? 'pending' : body.status}`) }),
        );
      await load();
    } catch {
      toast.error(t('reportDeliveries_retryFailed'));
    } finally {
      setRetryingId(null);
    }
  }

  const rows = result?.data ?? [];
  const total = result?.pagination.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unsentCount = result?.unsent_count ?? 0;

  return (
    <div className="space-y-6" data-testid="report-delivery-log">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {t('reportDeliveries_title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('reportDeliveries_description')}</p>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2" data-testid="delivery-tabs">
        {TABS.map((tab) => {
          const active = group === tab.group;
          const prominent = tab.group === 'unsent';
          return (
            <button
              key={tab.group}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`delivery-tab-${tab.group}`}
              onClick={() => {
                setGroup(tab.group);
                setPage(1);
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-muted',
                prominent && !active && 'border-amber-400',
              )}
            >
              {t(tab.labelKey)}
              {prominent && unsentCount > 0 && (
                <span
                  data-testid="unsent-count"
                  className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white"
                >
                  {unsentCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="min-w-[16rem] flex-1 space-y-2">
            <Label htmlFor="delivery-search">{t('reportDeliveries_searchLabel')}</Label>
            <Input
              id="delivery-search"
              data-testid="delivery-search"
              type="search"
              value={searchInput}
              placeholder={t('reportDeliveries_searchPlaceholder')}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-date-from">{t('reportDeliveries_dateFrom')}</Label>
            <Input
              id="delivery-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-date-to">{t('reportDeliveries_dateTo')}</Label>
            <Input
              id="delivery-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {(propertyId || jobId) && (
            <Button variant="outline" asChild>
              <Link href="/reports/deliveries">{t('clearFilters')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive" data-testid="delivery-log-error">
          {error}
        </p>
      )}

      {loading && !result ? (
        <LoadingState size="sm" padded={false} className="py-8" />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm" data-testid="delivery-table">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{t('reportDeliveries_colStatus')}</th>
                  <th className="px-4 py-3 font-medium">{t('reportDeliveries_colRecipient')}</th>
                  <th className="px-4 py-3 font-medium">{t('reportDeliveries_colProperty')}</th>
                  <th className="px-4 py-3 font-medium">{t('reportDeliveries_colJob')}</th>
                  <th className="px-4 py-3 font-medium">{t('reportDeliveries_colActor')}</th>
                  <th className="px-4 py-3 font-medium">{t('reportDeliveries_colTime')}</th>
                  <th className="px-4 py-3 font-medium">{t('reportDeliveries_colError')}</th>
                  {canRetry && (
                    <th className="px-4 py-3 font-medium">{t('reportDeliveries_colActions')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !error && (
                  <tr>
                    <td
                      colSpan={canRetry ? 8 : 7}
                      className="px-4 py-8 text-center text-muted-foreground"
                      data-testid="delivery-empty"
                    >
                      {group === 'unsent' && !search && !propertyId && !jobId
                        ? t('reportDeliveries_emptyUnsent')
                        : t('reportDeliveries_empty')}
                    </td>
                  </tr>
                )}
                {rows.map((row) => {
                  const reason = translateDeliveryReason(t, row.reason);
                  return (
                    <tr
                      key={row.id}
                      className="border-b last:border-0 align-top"
                      data-testid="delivery-row"
                      data-status={row.status}
                      data-delivery-id={row.id}
                    >
                      <td className="px-4 py-3">
                        <DeliveryStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3" data-testid="delivery-recipient">
                        {row.recipient ?? (
                          <span className="text-muted-foreground">
                            {t('reportDeliveries_noRecipient')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" data-testid="delivery-property">
                        {row.property ? (
                          <Link
                            href={`/properties/${row.property.id}`}
                            className="font-medium hover:underline"
                          >
                            {row.property.customer_name ?? row.property.id}
                          </Link>
                        ) : (
                          '—'
                        )}
                        {row.property?.address && (
                          <div className="text-xs text-muted-foreground">{row.property.address}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/jobs/${row.job.id}`}
                          className="text-primary hover:underline"
                          data-testid="delivery-job-link"
                        >
                          {row.job.scheduled_date
                            ? row.job.scheduled_date.slice(0, 10)
                            : t('reportDeliveries_viewJob')}
                        </Link>
                      </td>
                      <td className="px-4 py-3" data-testid="delivery-actor">
                        {row.actor.type === 'system'
                          ? t('reportDeliveries_actorAuto')
                          : row.actor.name ?? t('reportDeliveries_actorUnknownUser')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(row.updated_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 max-w-xs break-words" data-testid="delivery-reason">
                        {reason ?? <span className="text-muted-foreground">{t('reportDeliveries_noError')}</span>}
                      </td>
                      {canRetry && (
                        <td className="px-4 py-3">
                          {row.can_retry && (
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`retry-delivery-${row.id}`}
                              disabled={retryingId === row.id}
                              onClick={() => void handleRetry(row)}
                            >
                              {retryingId === row.id
                                ? t('reportDeliveries_retrying')
                                : t('reportDeliveries_retry')}
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {result && total > 0 && (
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span data-testid="delivery-page-info">
            {t('reportDeliveries_pageOf', { page, pages, total })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('reportDeliveries_previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!result.pagination.hasMore || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('reportDeliveries_next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
