'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LoadingState } from '@/components/ui/loading-state';

type TrashJob = {
  id: string;
  scheduled_date: string;
  status: string;
  updated_at: string;
  property?: { customer_name?: string; address?: string } | null;
};

type TrashRoute = {
  id: string;
  name: string;
  updated_at: string;
};

type TrashPhoto = {
  id: string;
  photo_type?: string | null;
  caption?: string | null;
  created_at: string;
};

type TrashPayload = {
  jobs: TrashJob[];
  routes: TrashRoute[];
  photos: TrashPhoto[];
};

function formatWhen(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function TrashSettingsPage() {
  const t = useTranslations('settings');
  const tGlobal = useTranslations();
  const locale = useLocale();
  const [data, setData] = useState<TrashPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTrash() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/trash');
        if (res.status === 403) {
          if (!cancelled) setError(t('trashForbidden'));
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError(t('trashLoadError'));
          return;
        }
        const payload = (await res.json()) as TrashPayload;
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setError(t('trashLoadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTrash();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const total =
    (data?.jobs.length ?? 0) + (data?.routes.length ?? 0) + (data?.photos.length ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t('trash')}</h3>
        <p className="text-sm text-muted-foreground">{t('trashDescription')}</p>
      </div>

      {loading ? (
        <LoadingState label={tGlobal('loading')} />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : total === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          {t('trashEmpty')}
        </div>
      ) : (
        <div className="space-y-6">
          {data && data.jobs.length > 0 && (
            <TrashSection title={t('trashJobs')}>
              {data.jobs.map((job) => {
                const label =
                  job.property?.customer_name ||
                  job.property?.address ||
                  job.id.slice(0, 8);
                return (
                  <TrashRow
                    key={job.id}
                    title={label}
                    subtitle={`${job.scheduled_date} · ${tGlobal(`status_${job.status}`, { defaultValue: job.status })}`}
                    deletedAt={`${t('trashDeletedAt')}: ${formatWhen(job.updated_at, locale)}`}
                  />
                );
              })}
            </TrashSection>
          )}

          {data && data.routes.length > 0 && (
            <TrashSection title={t('trashRoutes')}>
              {data.routes.map((route) => (
                <TrashRow
                  key={route.id}
                  title={route.name}
                  deletedAt={`${t('trashDeletedAt')}: ${formatWhen(route.updated_at, locale)}`}
                />
              ))}
            </TrashSection>
          )}

          {data && data.photos.length > 0 && (
            <TrashSection title={t('trashPhotos')}>
              {data.photos.map((photo) => (
                <TrashRow
                  key={photo.id}
                  title={photo.caption || photo.photo_type || photo.id.slice(0, 8)}
                  deletedAt={`${t('trashDeletedAt')}: ${formatWhen(photo.created_at, locale)}`}
                />
              ))}
            </TrashSection>
          )}
        </div>
      )}
    </div>
  );
}

function TrashSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3 text-sm font-medium">{title}</div>
      <ul className="divide-y">{children}</ul>
    </div>
  );
}

function TrashRow({
  title,
  subtitle,
  deletedAt,
}: {
  title: string;
  subtitle?: string;
  deletedAt: string;
}) {
  return (
    <li className="px-4 py-3">
      <p className="text-sm font-medium">{title}</p>
      {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      <p className="mt-1 text-xs text-muted-foreground">{deletedAt}</p>
    </li>
  );
}
