'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

function normalizeSearch(s: string) {
  return s.trim().toLowerCase();
}

export default function RouteDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [generateDate, setGenerateDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkSearch, setBulkSearch] = useState('');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);

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
    return () => {
      cancelled = true;
    };
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
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshRoute() {
    if (!id) return;
    const r = await fetch(`/api/routes/${id}`);
    if (r.ok) setRoute(await r.json());
  }

  function togglePropertySelected(propertyId: string) {
    setSelectedPropertyIds((prev) =>
      prev.includes(propertyId) ? prev.filter((x) => x !== propertyId) : [...prev, propertyId]
    );
  }

  function toggleSelectAllVisible(filtered: Property[]) {
    if (filtered.length === 0) return;
    const visibleSet = new Set(filtered.map((p) => p.id));
    const allVisibleSelected = filtered.every((p) => selectedPropertyIds.includes(p.id));
    if (allVisibleSelected) {
      setSelectedPropertyIds((prev) => prev.filter((pid) => !visibleSet.has(pid)));
      return;
    }
    setSelectedPropertyIds((prev) => {
      const next = [...prev];
      for (const p of filtered) {
        if (!next.includes(p.id)) next.push(p.id);
      }
      return next;
    });
  }

  async function bulkAddStops() {
    if (!id || selectedPropertyIds.length === 0) return;
    setError(null);
    setInfoMessage(null);
    setBulkSaving(true);
    try {
      const res = await fetch(`/api/routes/${id}/stops`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ add_property_ids: selectedPropertyIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText);
        setBulkSaving(false);
        return;
      }
      const skipped = Array.isArray(data.skipped_property_ids) ? data.skipped_property_ids.length : 0;
      const onOther = Array.isArray(data.property_ids_on_other_routes)
        ? data.property_ids_on_other_routes.length
        : 0;
      await refreshRoute();
      setAddDialogOpen(false);
      setBulkSearch('');
      setSelectedPropertyIds([]);
      const parts: string[] = [];
      if (skipped > 0) parts.push(t('bulkAddPartiallySkipped', { count: skipped }));
      if (onOther > 0) parts.push(t('bulkAddOnOtherRoutes', { count: onOther }));
      if (parts.length > 0) setInfoMessage(parts.join(' '));
      setBulkSaving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add');
      setBulkSaving(false);
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
      await refreshRoute();
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

  const availableProperties = useMemo(() => {
    const onRoute = new Set((route?.stops ?? []).map((s) => s.property_id));
    return properties.filter((p) => !onRoute.has(p.id));
  }, [properties, route?.stops]);

  const q = normalizeSearch(bulkSearch);
  const filteredAvailable = useMemo(() => {
    if (!q) return availableProperties;
    return availableProperties.filter((p) => {
      const name = (p.customer_name ?? '').toLowerCase();
      const addr = (p.address ?? '').toLowerCase();
      return name.includes(q) || addr.includes(q);
    });
  }, [availableProperties, q]);

  const allVisibleSelected =
    filteredAvailable.length > 0 &&
    filteredAvailable.every((p) => selectedPropertyIds.includes(p.id));

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
            <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">{route.name}</h1>
            <p className="text-muted-foreground dark:text-gray-700">
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
      {infoMessage && (
        <p className="text-sm text-muted-foreground" role="status">
          {infoMessage}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('routeStops')}</CardTitle>
          <CardDescription>
            {(route.stops?.length ?? 0) === 0 ? t('noStopsYet') : t('routeStopsManageDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {route.stops && route.stops.length > 0 && (
            <ul className="divide-y divide-border">
              {route.stops.map((stop, idx) => (
                <li key={stop.id} className="flex items-center gap-3 py-2">
                  <span className="text-muted-foreground w-6 text-sm">{idx + 1}.</span>
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{stop.property?.customer_name ?? stop.property_id}</span>
                    {stop.property?.address && (
                      <span className="text-muted-foreground block truncate text-sm">{stop.property.address}</span>
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

          <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addPropertiesToRoute')}
          </Button>

          <Dialog
            open={addDialogOpen}
            onOpenChange={(open) => {
              setAddDialogOpen(open);
              if (open) {
                setBulkSearch('');
                setSelectedPropertyIds([]);
                setError(null);
              }
            }}
          >
            <DialogContent className="flex max-h-[100dvh] flex-col gap-0 p-0 sm:max-h-[90vh] sm:max-w-xl">
              <div className="space-y-4 p-6 pb-0">
                <DialogHeader>
                  <DialogTitle>{t('addPropertiesToRoute')}</DialogTitle>
                  <DialogDescription>{t('addPropertiesToRouteDescription')}</DialogDescription>
                </DialogHeader>
                {availableProperties.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t('allPropertiesOnRoute')}</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="bulk-property-search" className="sr-only">
                        {t('searchPropertiesPlaceholder')}
                      </Label>
                      <Input
                        id="bulk-property-search"
                        type="search"
                        autoComplete="off"
                        placeholder={t('searchPropertiesPlaceholder')}
                        value={bulkSearch}
                        onChange={(e) => setBulkSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={filteredAvailable.length === 0}
                        onClick={() => toggleSelectAllVisible(filteredAvailable)}
                      >
                        {allVisibleSelected ? t('deselectAllVisible') : t('selectAllVisible')}
                      </Button>
                    </div>
                  </>
                )}
              </div>
              {availableProperties.length > 0 && (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto border-y px-6 py-3">
                    {filteredAvailable.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{t('noPropertiesMatchSearch')}</p>
                    ) : (
                      <ul className="space-y-1">
                        {filteredAvailable.map((p) => {
                          const checked = selectedPropertyIds.includes(p.id);
                          return (
                            <li key={p.id}>
                              <label className="hover:bg-muted/60 flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2">
                                <input
                                  type="checkbox"
                                  className="border-input text-primary focus-visible:ring-ring mt-1 size-4 shrink-0 rounded border"
                                  checked={checked}
                                  onChange={() => togglePropertySelected(p.id)}
                                />
                                <span className="min-w-0 flex-1 text-sm leading-snug">
                                  <span className="font-medium">{p.customer_name}</span>
                                  {p.address ? (
                                    <span className="text-muted-foreground block truncate">{p.address}</span>
                                  ) : null}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <DialogFooter className="border-t p-6">
                    <Button type="button" variant="ghost" onClick={() => setAddDialogOpen(false)}>
                      {t('cancel')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void bulkAddStops()}
                      disabled={
                        bulkSaving || selectedPropertyIds.length === 0 || availableProperties.length === 0
                      }
                    >
                      {bulkSaving
                        ? t('loading', { defaultValue: 'Loading…' })
                        : selectedPropertyIds.length === 0
                          ? t('addPropertiesToRoute')
                          : t('addSelectedToRoute', { count: selectedPropertyIds.length })}
                    </Button>
                  </DialogFooter>
                </>
              )}
              {availableProperties.length === 0 && (
                <DialogFooter className="p-6 pt-0">
                  <Button type="button" variant="ghost" onClick={() => setAddDialogOpen(false)}>
                    {t('close')}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('generateJobsForDate')}</CardTitle>
          <CardDescription>{t('generateJobsForDateDescription')}</CardDescription>
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
            {generating ? t('loading', { defaultValue: 'Loading…' }) : t('generateJobsForDate')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
