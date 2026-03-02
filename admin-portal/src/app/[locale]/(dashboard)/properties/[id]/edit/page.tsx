'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { PropertyForm } from '@/components/properties/PropertyForm';
import type { PropertyFormValues } from '@/components/properties/PropertyForm';
import { ArrowLeft } from 'lucide-react';

type Property = PropertyFormValues & {
  id: string;
};

export default function EditPropertyPage() {
  const t = useTranslations();
  const params = useParams();
  const id = params?.id as string;
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/properties/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || res.statusText);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) setProperty(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <p className="text-muted-foreground">{t('loading', { defaultValue: 'Loading…' })}</p>;
  if (error || !property) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href={id ? `/properties/${id}` : '/properties'}><ArrowLeft className="mr-2 h-4 w-4" />{t('back')}</Link>
        </Button>
        <p className="text-destructive">{error ?? 'Not found'}</p>
      </div>
    );
  }

  const initialValues: Partial<PropertyFormValues> = {
    customer_name: property.customer_name ?? '',
    address: property.address ?? '',
    customer_email: property.customer_email ?? '',
    customer_phone: property.customer_phone ?? '',
    city: property.city ?? '',
    state: property.state ?? '',
    zip: property.zip ?? '',
    gate_code: property.gate_code ?? '',
    pool_type: property.pool_type ?? '',
    pool_surface: property.pool_surface ?? '',
    equipment_notes: property.equipment_notes ?? '',
    notes: property.notes ?? '',
    is_active: property.is_active !== false,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/properties/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">{t('editProperty')}</h1>
          <p className="text-muted-foreground dark:text-gray-700">{property.customer_name}</p>
        </div>
      </div>
      <PropertyForm        
        propertyId={id}
        initialValues={initialValues}
        title={t('editProperty')}
        cancelHref={`/properties/${id}`}
        />
    </div>
  );
}
