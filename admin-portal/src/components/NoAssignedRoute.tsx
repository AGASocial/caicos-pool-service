'use client';

import { useTranslations } from 'next-intl';
import { MapPinOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function NoAssignedRoute() {
  const t = useTranslations();

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="icon-chip icon-bg-muted">
          <MapPinOff className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-1 max-w-md">
          <h2 className="text-lg font-semibold text-foreground">{t('noAssignedRouteTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('noAssignedRouteDescription')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
