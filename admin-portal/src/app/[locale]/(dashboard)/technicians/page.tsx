'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { UserPlus, Users } from 'lucide-react';

type Technician = { id: string; full_name: string; role?: string; is_active?: boolean };

export default function TechniciansPage() {
  const t = useTranslations();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/technicians');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || res.statusText);
          return;
        }
        const data = await res.json();
        if (!cancelled) setTechnicians(Array.isArray(data) ? data : []);
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
          <h1 className="text-2xl font-bold tracking-tight">{t('team')}</h1>
          <p className="text-muted-foreground">{t('teamDescription')}</p>
        </div>
        <Button asChild className="w-fit shrink-0">
          <Link href="/technicians/invite">
            <UserPlus className="mr-2 h-4 w-4" />
            {t('inviteTechnician')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('team')}</CardTitle>
          <CardDescription>{t('teamCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">{t('loading', { defaultValue: 'Loading…' })}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && technicians.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noTeamYet')}</p>
          )}
          {!loading && !error && technicians.length > 0 && (
            <ul className="divide-y divide-border">
              {technicians.map((tech) => (
                <li key={tech.id} className="flex items-center gap-3 py-3">
                  <Users className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{tech.full_name}</span>
                    {tech.role && (
                      <span className="text-muted-foreground text-sm ml-2">{tech.role}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
