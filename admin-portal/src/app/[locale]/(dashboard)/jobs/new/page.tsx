'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { useTeam } from '@/lib/team';

const STATUSES = ['pending', 'in_progress', 'completed', 'skipped', 'cancelled'] as const;

type VisitReason = { id: string; slug: string; label: string };

type PropertyRow = {
  id: string;
  customer_name: string;
  address?: string;
  route?: { id: string; name: string } | null;
};

export default function NewJobPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatchMode = searchParams.get('mode') === 'dispatch';
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [routes, setRoutes] = useState<{ id: string; name: string }[]>([]);
  const [routeFilter, setRouteFilter] = useState<string>('');
  const [visitReasons, setVisitReasons] = useState<VisitReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: teamMembers = [] } = useTeam();
  const [form, setForm] = useState({
    property_id: '',
    technician_id: '',
    scheduled_date: '',
    scheduled_time: '',
    status: 'pending',
    notes: '',
    estimated_duration_min: 30,
    visit_kind_id: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = dispatchMode ? '/api/properties?include_route=1' : '/api/properties';
        const res = await fetch(url);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setProperties(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [dispatchMode]);

  useEffect(() => {
    if (!dispatchMode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/routes');
        if (!cancelled && res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          setRoutes(
            list
              .map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))
              .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
          );
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [dispatchMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/visit-reasons');
        if (!cancelled && res.ok) {
          const data = await res.json();
          setVisitReasons(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function update(key: string, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const filteredProperties = useMemo(() => {
    if (!dispatchMode) return properties;
    if (routeFilter === '') return properties;
    if (routeFilter === '__none__') {
      return properties.filter((p) => !p.route);
    }
    return properties.filter((p) => p.route?.id === routeFilter);
  }, [dispatchMode, properties, routeFilter]);

  useEffect(() => {
    if (!dispatchMode) return;
    setForm((prev) => {
      if (!prev.property_id) return prev;
      if (!filteredProperties.some((p) => p.id === prev.property_id)) {
        return { ...prev, property_id: '' };
      }
      return prev;
    });
  }, [dispatchMode, routeFilter, filteredProperties]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.property_id || !form.scheduled_date) {
      setError(t('propertyAndDateRequired'));
      return;
    }
    if (dispatchMode && !form.visit_kind_id) {
      setError(t('visitKindRequired'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: form.property_id,
          technician_id: form.technician_id || undefined,
          scheduled_date: form.scheduled_date,
          scheduled_time: form.scheduled_time || undefined,
          status: form.status,
          notes: form.notes || undefined,
          estimated_duration_min: form.estimated_duration_min,
          job_source: 'ad_hoc',
          visit_kind_id: form.visit_kind_id || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText);
        setLoading(false);
        return;
      }
      if (data.id) router.push(`/jobs/${data.id}`);
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
          <Link href="/jobs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">
            {dispatchMode ? t('adHocDispatch') : t('createJob')}
          </h1>
          <p className="text-muted-foreground dark:text-gray-700">
            {dispatchMode ? t('adHocDispatchDescription') : t('createJobAdHocHint')}
          </p>
        </div>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{dispatchMode ? t('adHocDispatch') : t('createJob')}</CardTitle>
          <CardDescription>
            {dispatchMode ? t('adHocDispatchDescription') : t('jobsCardDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {dispatchMode && (
              <div className="space-y-2">
                <Label htmlFor="dispatch_route_filter">{t('dispatchFilterByRoute')}</Label>
                <select
                  id="dispatch_route_filter"
                  value={routeFilter}
                  onChange={(e) => setRouteFilter(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">{t('dispatchAllRoutes')}</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                  <option value="__none__">{t('dispatchNoRoutes')}</option>
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="property_id">{t('properties')}</Label>
              <select
                id="property_id"
                value={form.property_id}
                onChange={(e) => update('property_id', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                required
              >
                <option value="">—</option>
                {(dispatchMode ? filteredProperties : properties).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.customer_name}
                    {p.address ? ` · ${p.address}` : ''}
                    {dispatchMode && p.route?.name ? ` · ${p.route.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="technician_id">{t('teamMember')}</Label>
              <select
                id="technician_id"
                value={form.technician_id}
                onChange={(e) => update('technician_id', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">—</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>{member.full_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="visit_kind_id">
                {t('visitKind')}
                {dispatchMode ? <span className="text-destructive"> *</span> : null}
              </Label>
              <select
                id="visit_kind_id"
                value={form.visit_kind_id}
                onChange={(e) => update('visit_kind_id', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                required={dispatchMode}
              >
                <option value="">{t('visitKindPlaceholder')}</option>
                {visitReasons.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="scheduled_date">{t('scheduledDate')}</Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => update('scheduled_date', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduled_time">{t('scheduledTime')}</Label>
                <Input
                  id="scheduled_time"
                  type="time"
                  value={form.scheduled_time}
                  onChange={(e) => update('scheduled_time', e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status">{t('status')}</Label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{t(`status_${s}`)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated_duration_min">{t('estimatedDuration')}</Label>
                <Input
                  id="estimated_duration_min"
                  type="number"
                  min={1}
                  value={form.estimated_duration_min}
                  onChange={(e) => update('estimated_duration_min', Number(e.target.value) || 30)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t('notes')}</Label>
              <textarea
                id="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? t('loading', { defaultValue: 'Loading…' }) : t('save')}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/jobs">{t('cancel')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
