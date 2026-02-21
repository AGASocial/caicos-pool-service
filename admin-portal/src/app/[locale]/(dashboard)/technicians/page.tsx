'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

export default function TechniciansPage() {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('team')}</h1>
          <p className="text-muted-foreground">{t('teamDescription')}</p>
        </div>
        <Button className="w-fit shrink-0">
          <UserPlus className="mr-2 h-4 w-4" />
          {t('inviteTechnician')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('team')}</CardTitle>
          <CardDescription>{t('teamCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('noTeamYet')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
