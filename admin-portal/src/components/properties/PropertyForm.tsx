'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { Switch } from '@/components/ui/switch';

const POOL_TYPES = ['residential', 'commercial', 'spa', 'other'] as const;
const POOL_SURFACES = ['plaster', 'pebble', 'tile', 'vinyl', 'fiberglass', 'other'] as const;

export type PropertyFormValues = {
  customer_name: string;
  address: string;
  customer_email: string;
  customer_phone: string;
  city: string;
  state: string;
  zip: string;
  gate_code: string;
  pool_type: string;
  pool_surface: string;
  equipment_notes: string;
  notes: string;
  is_active?: boolean;
};

const emptyForm: PropertyFormValues = {
  customer_name: '',
  address: '',
  customer_email: '',
  customer_phone: '',
  city: '',
  state: '',
  zip: '',
  gate_code: '',
  pool_type: '',
  pool_surface: '',
  equipment_notes: '',
  notes: '',
};

type PropertyFormProps = {
  /** When set, form is in edit mode: PUT to /api/properties/[id]. When undefined, POST to /api/properties. */
  propertyId?: string;
  /** Initial values (e.g. from GET /api/properties/[id]). Used when editing. */
  initialValues?: Partial<PropertyFormValues>;
  /** Card title. */
  title: string;
  /** Optional card description. */
  description?: string;
  /** Cancel link href. Defaults to /properties. */
  cancelHref?: string;
};

export function PropertyForm({
  propertyId,
  initialValues,
  title,
  description,
  cancelHref = '/properties',
}: PropertyFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PropertyFormValues>(() => ({
    ...emptyForm,
    ...initialValues,
    customer_name: initialValues?.customer_name ?? '',
    address: initialValues?.address ?? '',
    customer_email: initialValues?.customer_email ?? '',
    customer_phone: initialValues?.customer_phone ?? '',
    city: initialValues?.city ?? '',
    state: initialValues?.state ?? '',
    zip: initialValues?.zip ?? '',
    gate_code: initialValues?.gate_code ?? '',
    pool_type: initialValues?.pool_type ?? '',
    pool_surface: initialValues?.pool_surface ?? '',
    equipment_notes: initialValues?.equipment_notes ?? '',
    notes: initialValues?.notes ?? '',
    is_active: initialValues?.is_active ?? true,
  }));

  function update(key: keyof PropertyFormValues, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.customer_name.trim() || !form.address.trim()) {
      setError(t('customerNameAndAddressRequired', { defaultValue: 'Customer name and address are required.' }));
      return;
    }
    setLoading(true);
    try {
      const url = propertyId ? `/api/properties/${propertyId}` : '/api/properties';
      const method = propertyId ? 'PUT' : 'POST';
      const body = {
        customer_name: form.customer_name.trim(),
        address: form.address.trim(),
        customer_email: form.customer_email.trim() || undefined,
        customer_phone: form.customer_phone.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        zip: form.zip.trim() || undefined,
        gate_code: form.gate_code.trim() || undefined,
        pool_type: form.pool_type || undefined,
        pool_surface: form.pool_surface || undefined,
        equipment_notes: form.equipment_notes.trim() || undefined,
        notes: form.notes.trim() || undefined,
        ...(propertyId ? { is_active: form.is_active !== false } : {}),
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText);
        setLoading(false);
        return;
      }
      router.push(cancelHref);
    } catch (e) {
      setError(e instanceof Error ? e.message : propertyId ? 'Failed to update' : 'Failed to create');
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer_name">{t('customerName')}</Label>
              <Input
                id="customer_name"
                value={form.customer_name}
                onChange={(e) => update('customer_name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_phone">{t('customerPhone')}</Label>
              <Input
                id="customer_phone"
                type="tel"
                value={form.customer_phone}
                onChange={(e) => update('customer_phone', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">{t('address')}</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer_email">{t('customerEmail')}</Label>
            <Input
              id="customer_email"
              type="email"
              value={form.customer_email}
              onChange={(e) => update('customer_email', e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">{t('city')}</Label>
              <Input id="city" value={form.city} onChange={(e) => update('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">{t('state')}</Label>
              <Input id="state" value={form.state} onChange={(e) => update('state', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">{t('zip')}</Label>
              <Input id="zip" value={form.zip} onChange={(e) => update('zip', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gate_code">{t('gateCode')}</Label>
            <Input id="gate_code" value={form.gate_code} onChange={(e) => update('gate_code', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pool_type">{t('poolType')}</Label>
              <select
                id="pool_type"
                value={form.pool_type}
                onChange={(e) => update('pool_type', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">—</option>
                {POOL_TYPES.map((v) => (
                  <option key={v} value={v}>{t(`poolType_${v}`) || v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pool_surface">{t('poolSurface')}</Label>
              <select
                id="pool_surface"
                value={form.pool_surface}
                onChange={(e) => update('pool_surface', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">—</option>
                {POOL_SURFACES.map((v) => (
                  <option key={v} value={v}>{t(`poolSurface_${v}`) || v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="equipment_notes">{t('equipmentNotes')}</Label>
            <Input id="equipment_notes" value={form.equipment_notes} onChange={(e) => update('equipment_notes', e.target.value)} />
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
          {propertyId != null && (
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={form.is_active !== false}
                onCheckedChange={(checked) => update('is_active', checked)}
              />
              <Label htmlFor="is_active">{t('active', { defaultValue: 'Active' })}</Label>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? t('loading', { defaultValue: 'Loading…' }) : t('save')}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={cancelHref}>{t('cancel')}</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
