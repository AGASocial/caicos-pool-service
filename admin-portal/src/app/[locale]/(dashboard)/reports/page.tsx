'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReportsPage() {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">{t('reports')}</h1>
        <p className="text-muted-foreground dark:text-gray-700">{t('reportsDescription')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('reports')}</CardTitle>
          <CardDescription>{t('reportsCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('noReportsYet')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
