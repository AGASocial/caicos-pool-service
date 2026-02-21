'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function JobsPage() {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('jobs')}</h1>
          <p className="text-muted-foreground">{t('jobsDescription')}</p>
        </div>
        <Button className="w-fit shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          {t('createJob')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('jobs')}</CardTitle>
          <CardDescription>{t('jobsCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('noJobsYet')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
