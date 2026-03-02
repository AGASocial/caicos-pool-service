'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { PropertyForm } from '@/components/properties/PropertyForm';
import { ArrowLeft } from 'lucide-react';

export default function NewPropertyPage() {
  const t = useTranslations();

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
      <PropertyForm
        title={t('createProperty')}
        description={t('propertiesCardDescription')}
      />
    </div>
  );
}
