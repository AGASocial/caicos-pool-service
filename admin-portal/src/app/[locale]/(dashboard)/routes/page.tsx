'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { Plus, Route, ChevronRight } from 'lucide-react';
import { useRoutes } from '@/lib/data-queries';
import { LoadingState } from '@/components/ui/loading-state';

type RouteRow = {
  id: string;
  name: string;
  technician_id: string;
  stop_count: number;
  technician?: { id: string; full_name: string } | null;
};

export default function RoutesPage() {
  const t = useTranslations();
  const { data: result, isLoading, error } = useRoutes();
  const routes = (result?.data ?? []) as RouteRow[];
  const errorMessage = error instanceof Error ? error.message : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t('routes')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('routesDescription')}</p>
        </div>
        <Button asChild className="w-fit shrink-0">
          <Link href="/routes/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('createRoute')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('routes')}</CardTitle>
          <CardDescription>{t('routesCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <LoadingState size="sm" padded={false} className="py-8" />}
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          {!isLoading && !errorMessage && routes.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noRoutesYet')}</p>
          )}
          {!isLoading && !errorMessage && routes.length > 0 && (
            <ul className="divide-y divide-border">
              {routes.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/routes/${r.id}`}
                    className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Route className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{r.name}</span>
                      <p className="text-sm text-muted-foreground">
                        {r.technician?.full_name ?? '—'} · {r.stop_count} {t('stops', { defaultValue: 'stops' })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
