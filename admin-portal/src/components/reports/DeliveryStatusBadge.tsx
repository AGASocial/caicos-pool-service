'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ApiDeliveryStatus } from '@/lib/customer-reports/delivery-log-query';

const STATUS_STYLES: Record<ApiDeliveryStatus, string> = {
  sent: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  failed: 'border-transparent bg-destructive/15 text-destructive',
  pending: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  skipped: 'border-transparent bg-muted text-muted-foreground',
};

export function DeliveryStatusBadge({
  status,
  className,
}: {
  status: ApiDeliveryStatus;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <Badge
      className={cn(STATUS_STYLES[status], className)}
      data-testid="delivery-status-badge"
      data-status={status}
    >
      {t(`reportDeliveries_status_${status}`)}
    </Badge>
  );
}
