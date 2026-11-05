'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { Archive, ImageOff } from 'lucide-react';
import type { HistoryVisit } from '@/lib/photo-history';

type Resp = { visits: HistoryVisit[]; hasMore: boolean; page: number; total: number };

export function PhotoHistory({ propertyId }: { propertyId: string }) {
  const t = useTranslations();
  const [visits, setVisits] = useState<HistoryVisit[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (next: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/properties/${propertyId}/photo-history?page=${next}&page_size=10`);
        const data = (await res.json().catch(() => ({}))) as Partial<Resp> & { error?: string };
        if (!res.ok) throw new Error(data.error || res.statusText);
        setVisits((prev) => (next === 1 ? data.visits ?? [] : [...prev, ...(data.visits ?? [])]));
        setHasMore(!!data.hasMore);
        setPage(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [propertyId],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <Card data-testid="photo-history">
      <CardHeader>
        <CardTitle className="text-base">{t('photoHistory')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && visits.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="photo-history-empty">
            {t('photoHistoryEmpty')}
          </p>
        )}
        <ol className="space-y-6 border-l pl-4">
          {visits.map((v) => (
            <li key={v.jobId} data-testid="photo-history-visit" data-date={v.scheduledDate}>
              <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <Link href={`/jobs/${v.jobId}`} className="font-medium hover:underline">
                  {v.scheduledDate}
                </Link>
                <span className="text-muted-foreground">{v.technicianName ?? '—'}</span>
                <span className="text-xs text-muted-foreground">{t(`status_${v.status}`)}</span>
              </div>
              {v.notes && <p className="mt-1 text-sm text-muted-foreground">{v.notes}</p>}
              {v.photos.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">{t('visitNoPhotos')}</p>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {v.photos.map((p) =>
                    p.url ? (
                      <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={p.caption ?? p.photo_type ?? 'photo'}
                          loading="lazy"
                          className="aspect-square w-full rounded object-cover"
                          data-testid="photo-history-img"
                        />
                      </a>
                    ) : (
                      <div
                        key={p.id}
                        className="flex aspect-square flex-col items-center justify-center rounded bg-muted text-center text-xs text-muted-foreground"
                        data-testid={p.archived ? 'photo-history-archived' : 'photo-history-unavailable'}
                      >
                        {p.archived ? <Archive className="mb-1 h-4 w-4" /> : <ImageOff className="mb-1 h-4 w-4" />}
                        {p.archived ? t('photoArchived') : t('photoUnavailable')}
                      </div>
                    ),
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
        {hasMore && (
          <Button variant="outline" onClick={() => load(page + 1)} disabled={loading} data-testid="photo-history-more">
            {loading ? t('loading') : t('loadMore')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
