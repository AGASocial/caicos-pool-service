'use client';

import { useTranslations } from 'next-intl';
import { CustomerReportSettings } from '@/components/settings/CustomerReportSettings';

export default function CustomerReportsSettingsPage() {
  const t = useTranslations('settings');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">{t('customerReports')}</h2>
        <p className="text-sm text-muted-foreground">{t('customerReportsDescription')}</p>
      </div>
      <div className="border-t border-muted" />
      <CustomerReportSettings />
    </div>
  );
}
