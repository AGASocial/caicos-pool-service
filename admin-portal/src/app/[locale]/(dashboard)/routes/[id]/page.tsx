'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Trash2, Plus, Calendar, MapPin } from 'lucide-react';

type Property = { id: string; customer_name: string; address?: string };
type Stop = { id: string; property_id: string; stop_order: number; property?: Property };
type RouteDetail = {
  id: string;
  name: string;
  technician_id: string;
  technician?: { id: string; full_name: string } | null;
  stops: Stop[];
};

export default function RouteDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generateDate, setGenerateDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [addPropertyId, setAddPropertyId] = useState('');
  const [properties, setProperties] = useState<{ id: string; customer_name: string; address?: string }[]>([]);
  const [showAddStop, setShowAddStop] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/routes/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || res.statusText);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) setRoute(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/properties');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setProperties(Array.isArray(data) ? data : []);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function addStop() {
    if (!id || !addPropertyId) return;
    setError(null);
    try {
      const stopOrder = (route?.stops?.length ?? 0);
      const res = await fetch(`/api/routes/${id}/stops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: addPropertyId, stop_order: stopOrder }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText);
        return;
      }
      setAddPropertyId('');
      setShowAddStop(false);
      const r = await fetch(`/api/routes/${id}`);
      if (r.ok) setRoute(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add');
    }
  }

  async function removeStop(stopId: string) {
    if (!id) return;
    setError(null);
    try {
      const res = await fetch(`/api/routes/${id}/stops/${stopId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || res.statusText);
        return;
      }
      const r = await fetch(`/api/routes/${id}`);
      if (r.ok) setRoute(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove');
    }
  }

  async function generateJobs() {
    if (!id || !generateDate) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/routes/${id}/generate-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: generateDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText);
        setGenerating(false);
        return;
      }
      setGenerating(false);
      router.push(`/jobs?date=${generateDate}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
      setGenerating(false);
    }
  }

  async function deleteRoute() {
    if (!id || !confirm(t('confirmDeleteRoute'))) return;
    setError(null);
    try {
      const res = await fetch(`/api/routes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || res.statusText);
        return;
      }
      router.push('/routes');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  const existingIds = new Set((route?.stops ?? []).map((s) => s.property_id));
  const availableProperties = properties.filter((p) => !existingIds.has(p.id));

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">{t('loading', { defaultValue: 'Loading…' })}</p>
      </div>
    );
  }

  if (error && !route) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/routes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('back')}
          </Link>
        </Button>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!route) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/routes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{route.name}</h1>
            <p className="text-muted-foreground">
              {route.technician?.full_name ?? '—'} · {route.stops?.length ?? 0} {t('routeStops')}
            </p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={deleteRoute}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t('deleteRoute')}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{t('routeStops')}</CardTitle>
          <CardDescription>{t('noStopsYet')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {route.stops?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noStopsYet')}</p>
          )}
          {route.stops && route.stops.length > 0 && (
            <ul className="divide-y divide-border">
              {route.stops.map((stop, idx) => (
                <li key={stop.id} className="flex items-center gap-3 py-2">
                  <span className="text-muted-foreground w-6 text-sm">{idx + 1}.</span>
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{stop.property?.customer_name ?? stop.property_id}</span>
                    {stop.property?.address && (
                      <span className="text-muted-foreground text-sm block truncate">{stop.property.address}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeStop(stop.id)}
                  >
                    {t('removeStop')}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {!showAddStop && (
            <Button variant="outline" size="sm" onClick={() => setShowAddStop(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addStop')}
            </Button>
          )}
          {showAddStop && (
            <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label>{t('addPropertyToRoute')}</Label>
                <select
                  value={addPropertyId}
                  onChange={(e) => setAddPropertyId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">—</option>
                  {availableProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.customer_name} {p.address ? ` · ${p.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <Button size="sm" onClick={addStop} disabled={!addPropertyId}>
                {t('addStop')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddStop(false); setAddPropertyId(''); }}>
                {t('cancel')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('generateJobsForDate')}</CardTitle>
          <CardDescription>
            {t('generateJobsForDateDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="gen-date">{t('pickDate')}</Label>
            <Input
              id="gen-date"
              type="date"
              value={generateDate}
              onChange={(e) => setGenerateDate(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <Button
            onClick={generateJobs}
            disabled={!generateDate || generating || (route.stops?.length ?? 0) === 0}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {generating ? (t('loading', { defaultValue: 'Loading…' })) : t('generateJobsForDate')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
