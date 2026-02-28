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
import { useTechnicians } from '@/lib/technicians';

const STATUSES = ['pending', 'in_progress', 'completed', 'skipped', 'cancelled'] as const;

export default function NewJobPage() {
  const t = useTranslations();
  const router = useRouter();
  const [properties, setProperties] = useState<{ id: string; customer_name: string; address?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: technicians = [] } = useTechnicians();
  const [form, setForm] = useState({
    property_id: '',
    technician_id: '',
    scheduled_date: '',
    scheduled_time: '',
    status: 'pending',
    notes: '',
    estimated_duration_min: 30,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/properties');
        if (!cancelled && res.ok) {
          const data = await res.json();
          setProperties(Array.isArray(data) ? data : []);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.property_id || !form.scheduled_date) {
      setError(t('propertyAndDateRequired'));
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">{t('createJob')}</h1>
          <p className="text-muted-foreground dark:text-gray-700">{t('jobsDescription')}</p>
        </div>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{t('createJob')}</CardTitle>
          <CardDescription>{t('jobsCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.customer_name} {p.address ? ` · ${p.address}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="technician_id">{t('technician')}</Label>
              <select
                id="technician_id"
                value={form.technician_id}
                onChange={(e) => update('technician_id', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">—</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>{tech.full_name}</option>
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
