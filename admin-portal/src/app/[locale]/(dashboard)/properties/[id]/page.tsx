'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

type Property = {
  id: string;
  customer_name: string;
  address?: string;
  customer_email?: string;
  customer_phone?: string;
  city?: string;
  state?: string;
  zip?: string;
  gate_code?: string;
  pool_type?: string;
  pool_surface?: string;
  notes?: string;
  is_active?: boolean;
};

export default function PropertyDetailPage() {
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
          <Link href="/properties"><ArrowLeft className="mr-2 h-4 w-4" />{t('back')}</Link>
        </Button>
        <p className="text-destructive">{error ?? 'Not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/properties"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">{property.customer_name}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('properties')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {property.address && <p><span className="text-muted-foreground">{t('address')}:</span> {property.address}</p>}
          {(property.city || property.state || property.zip) && (
            <p><span className="text-muted-foreground">{t('city')}:</span> {[property.city, property.state, property.zip].filter(Boolean).join(', ')}</p>
          )}
          {property.customer_phone && <p><span className="text-muted-foreground">{t('customerPhone')}:</span> {property.customer_phone}</p>}
          {property.customer_email && <p><span className="text-muted-foreground">{t('customerEmail')}:</span> {property.customer_email}</p>}
          {property.gate_code && <p><span className="text-muted-foreground">{t('gateCode')}:</span> {property.gate_code}</p>}
          {property.pool_type && <p><span className="text-muted-foreground">{t('poolType')}:</span> {property.pool_type}</p>}
          {property.notes && <p><span className="text-muted-foreground">{t('notes')}:</span> {property.notes}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
