'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { hasEntitlement } from '@/lib/entitlements';
import type { DeliveryLogEntry } from '@/lib/customer-reports/delivery-log-query';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';
import { translateDeliveryReason } from './delivery-reason';

type Props =
  | { jobId: string; propertyId?: undefined }
  | { propertyId: string; jobId?: undefined };

/**
 * Shows the latest customer-report delivery for a job or a property, so office staff can
 * answer "was the report sent?" without opening email. Office roles only (report.view).
 */
export function LatestDeliveryIndicator({ jobId, propertyId }: Props) {
  const t = useTranslations();
  const { user } = useAuth();
  const allowed = hasEntitlement(user?.profile?.role, 'report', 'view');
  const [entry, setEntry] = useState<DeliveryLogEntry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const params = new URLSearchParams({ limit: '1' });
    if (jobId) params.set('job_id', jobId);
    if (propertyId) params.set('property_id', propertyId);
    (async () => {
      try {
        const res = await fetch(`/api/report-deliveries?${params.toString()}`);
        if (!res.ok) {
          if (!cancelled) setUnavailable(true);
          return;
        }
        const body = (await res.json()) as { data?: DeliveryLogEntry[] };
        if (!cancelled) setEntry(body.data?.[0] ?? null);
      } catch {
        if (!cancelled) setUnavailable(true);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, jobId, propertyId]);

  if (!allowed || unavailable || !loaded) return null;

  const isJob = Boolean(jobId);
  const logHref = jobId
    ? `/reports/deliveries?job_id=${jobId}`
    : `/reports/deliveries?property_id=${propertyId}`;
  const reason = translateDeliveryReason(t, entry?.reason);

  return (
    <Card data-testid={isJob ? 'job-delivery-indicator' : 'property-delivery-indicator'}>
      <CardHeader>
        <CardTitle className="text-base">
          {t(isJob ? 'reportDeliveries_indicatorTitle' : 'reportDeliveries_propertyTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {entry ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <DeliveryStatusBadge status={entry.status} />
              <span className="text-muted-foreground">
                {new Date(entry.updated_at).toLocaleString()}
              </span>
            </div>
            {entry.recipient && (
              <p className="text-muted-foreground" data-testid="delivery-indicator-recipient">
                {entry.recipient}
              </p>
            )}
            {reason && entry.status !== 'sent' && (
              <p className="text-destructive" data-testid="delivery-indicator-reason">
                {reason}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground" data-testid="delivery-indicator-none">
            {t(isJob ? 'reportDeliveries_indicatorNone' : 'reportDeliveries_propertyNone')}
          </p>
        )}
        <Link href={logHref} className="text-primary underline-offset-4 hover:underline">
          {t(isJob ? 'reportDeliveries_indicatorViewLog' : 'reportDeliveries_propertyViewAll')}
        </Link>
      </CardContent>
    </Card>
  );
}
