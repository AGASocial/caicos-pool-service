'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { Plus, Route, ChevronRight } from 'lucide-react';

type RouteRow = {
  id: string;
  name: string;
  technician_id: string;
  stop_count: number;
  technician?: { id: string; full_name: string } | null;
};

export default function RoutesPage() {
  const t = useTranslations();
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/routes');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || res.statusText);
          return;
        }
        const data = await res.json();
        if (!cancelled) setRoutes(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('routes')}</h1>
          <p className="text-muted-foreground">{t('routesDescription')}</p>
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
          <CardDescription>{t('routesDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="text-sm text-muted-foreground">{t('loading', { defaultValue: 'Loading…' })}</p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {!loading && !error && routes.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noRoutesYet')}</p>
          )}
          {!loading && !error && routes.length > 0 && (
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
                      <span className="text-muted-foreground text-sm ml-2">
                        {r.technician?.full_name ?? '—'} · {r.stop_count} {t('routeStops').toLowerCase()}
                      </span>
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
