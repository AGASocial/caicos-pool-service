'use client';

import { Suspense } from 'react';
import { EntitlementGate } from '@/components/EntitlementGate';
import { LoadingState } from '@/components/ui/loading-state';
import { ReportDeliveryLog } from '@/components/reports/ReportDeliveryLog';

export default function ReportDeliveriesPage() {
  return (
    <EntitlementGate resource="report" action="view">
      <Suspense fallback={<LoadingState size="sm" padded={false} className="py-8" />}>
        <ReportDeliveryLog />
      </Suspense>
    </EntitlementGate>
  );
}
