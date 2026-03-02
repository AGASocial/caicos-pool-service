'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Pencil } from 'lucide-react';

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
  equipment_notes?: string;
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/properties">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">
              {property.customer_name}
            </h1>
            {property.address && (
              <p className="text-sm text-muted-foreground">
                {property.address}
                {property.city || property.state || property.zip ? (
                  <>
                    {', '}
                    {[property.city, property.state, property.zip].filter(Boolean).join(', ')}
                  </>
                ) : null}
              </p>
            )}
          </div>
        </div>
        <Button asChild>
          <Link href={`/properties/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            {t('edit')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Customer info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('customer', { defaultValue: 'Customer' })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">{t('customerName')}:</span>{' '}
              {property.customer_name}
            </p>
            {property.customer_phone && (
              <p>
                <span className="text-muted-foreground">{t('customerPhone')}:</span>{' '}
                {property.customer_phone}
              </p>
            )}
            {property.customer_email && (
              <p>
                <span className="text-muted-foreground">{t('customerEmail')}:</span>{' '}
                {property.customer_email}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">{t('status', { defaultValue: 'Status' })}:</span>{' '}
              {property.is_active !== false
                ? t('active', { defaultValue: 'Active' })
                : t('inactive', { defaultValue: 'Inactive' })}
            </p>
          </CardContent>
        </Card>

        {/* Property / access info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('property', { defaultValue: 'Property' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {property.address && (
              <p>
                <span className="text-muted-foreground">{t('address')}:</span>{' '}
                {property.address}
              </p>
            )}
            {(property.city || property.state || property.zip) && (
              <p>
                <span className="text-muted-foreground">{t('city')}:</span>{' '}
                {[property.city, property.state, property.zip].filter(Boolean).join(', ')}
              </p>
            )}
            {property.gate_code && (
              <p>
                <span className="text-muted-foreground">{t('gateCode')}:</span>{' '}
                {property.gate_code}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pool info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('pool', { defaultValue: 'Pool' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {property.pool_type && (
              <p>
                <span className="text-muted-foreground">{t('poolType')}:</span>{' '}
                {t(`poolType_${property.pool_type}`) || property.pool_type}
              </p>
            )}
            {property.pool_surface && (
              <p>
                <span className="text-muted-foreground">{t('poolSurface')}:</span>{' '}
                {t(`poolSurface_${property.pool_surface}`) || property.pool_surface}
              </p>
            )}
            {property.equipment_notes && (
              <p>
                <span className="text-muted-foreground">{t('equipmentNotes')}:</span>{' '}
                {property.equipment_notes}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {(property.notes) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm">{property.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
