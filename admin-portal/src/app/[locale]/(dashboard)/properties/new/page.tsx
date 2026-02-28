'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';

const POOL_TYPES = ['residential', 'commercial', 'spa', 'other'] as const;
const POOL_SURFACES = ['plaster', 'pebble', 'tile', 'vinyl', 'fiberglass', 'other'] as const;

export default function NewPropertyPage() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
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
  });

  function update(key: string, value: string) {
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
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText);
        setLoading(false);
        return;
      }
      if (data.id) router.push('/properties');
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
          <Link href="/properties">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">{t('createProperty')}</h1>
          <p className="text-muted-foreground dark:text-gray-700">{t('propertiesDescription')}</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('createProperty')}</CardTitle>
          <CardDescription>{t('propertiesCardDescription')}</CardDescription>
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
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>{loading ? t('loading', { defaultValue: 'Loading…' }) : t('save')}</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/properties">{t('cancel')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
