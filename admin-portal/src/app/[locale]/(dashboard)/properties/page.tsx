'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { Plus, Building2, ChevronRight } from 'lucide-react';

type Property = {
  id: string;
  customer_name: string;
  address?: string;
  city?: string;
  is_active?: boolean;
  created_at?: string;
};

export default function PropertiesPage() {
  const t = useTranslations();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/properties');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || res.statusText);
          return;
        }
        const data = await res.json();
        if (!cancelled) setProperties(Array.isArray(data) ? data : []);
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">{t('properties')}</h1>
          <p className="text-muted-foreground dark:text-gray-700">{t('propertiesDescription')}</p>
        </div>
        <Button asChild className="w-fit shrink-0">
          <Link href="/properties/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('createProperty')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('properties')}</CardTitle>
          <CardDescription>{t('propertiesCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">{t('loading', { defaultValue: 'Loading…' })}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && properties.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noPropertiesYet')}</p>
          )}
          {!loading && !error && properties.length > 0 && (
            <ul className="divide-y divide-border">
              {properties.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/properties/${p.id}`}
                    className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{p.customer_name}</span>
                      {p.address && (
                        <span className="text-muted-foreground text-sm block truncate">{p.address}</span>
                      )}
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
