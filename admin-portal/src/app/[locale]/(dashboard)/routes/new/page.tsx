'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';

type Technician = { id: string; full_name: string; role?: string };

export default function NewRoutePage() {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/technicians');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setTechnicians(Array.isArray(data) ? data : []);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !technicianId) {
      setError('Name and technician are required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), technician_id: technicianId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText);
        setLoading(false);
        return;
      }
      if (data.id) router.push(`/routes/${data.id}`);
      else setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/routes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('createRoute')}</h1>
          <p className="text-muted-foreground">{t('routesDescription')}</p>
        </div>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t('createRoute')}</CardTitle>
          <CardDescription>{t('routesDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('routeName')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('routeName')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="technician">{t('technician')}</Label>
              <select
                id="technician"
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              >
                <option value="">—</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.full_name}
                  </option>
                ))}
              </select>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? (t('loading', { defaultValue: 'Loading…' })) : t('save')}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/routes">{t('cancel')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
