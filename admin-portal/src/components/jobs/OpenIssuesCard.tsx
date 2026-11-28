'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { OpenIssue } from '@/lib/follow-up-jobs';
import { useAuth } from '@/lib/auth';

const OFFICE_ROLES = new Set(['owner', 'admin', 'operations']);

type Props = {
  jobId: string;
  /** Bump to reload after another card changed an issue (e.g. the report was resolved). */
  refreshKey?: number;
};

/**
 * Open issues recorded on this job (KAN-153), with age. Reports are resolved from the office
 * follow-up card; each problem voice note is resolved here, independently of the report.
 */
export function OpenIssuesCard({ jobId, refreshKey = 0 }: Props) {
  const t = useTranslations();
  const { user } = useAuth();
  const canManage = OFFICE_ROLES.has(user?.profile?.role ?? '');

  const [issues, setIssues] = useState<OpenIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/open-issues?job_id=${encodeURIComponent(jobId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.code === 'SCHEMA_PENDING' ? t('openIssues_schemaPending') : data.error || res.statusText);
        setIssues([]);
        return;
      }
      setIssues((data.data ?? []) as OpenIssue[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('openIssues_loadError'));
    } finally {
      setLoading(false);
    }
  }, [canManage, jobId, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function resolveVoiceNote(noteId: string) {
    setResolvingId(noteId);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/follow-up-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: 'resolved', voice_note_id: noteId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || res.statusText);
        return;
      }
      setIssues((prev) => prev.filter((issue) => !(issue.source === 'voice_note' && issue.id === noteId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('openIssues_loadError'));
    } finally {
      setResolvingId(null);
    }
  }

  if (!canManage || (!loading && issues.length === 0 && !error)) return null;

  return (
    <Card data-testid="open-issues-card">
      <CardHeader>
        <CardTitle>{t('openIssues_title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('loading', { defaultValue: 'Loading…' })}</p>
        ) : (
          <ul className="divide-y divide-border">
            {issues.map((issue) => (
              <li
                key={`${issue.source}:${issue.id}`}
                className="flex flex-wrap items-start gap-2 py-3 first:pt-0"
                data-testid={`open-issue-${issue.source}`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline">
                      {issue.source === 'voice_note'
                        ? t('openIssues_sourceVoiceNote')
                        : t('openIssues_sourceReport')}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-warning/40 bg-warning/10 text-warning-foreground"
                    >
                      {t('openIssues_daysOpen', { count: issue.days_open })}
                    </Badge>
                    {issue.last_reviewed_at && (
                      <span className="text-xs text-muted-foreground">
                        {t('openIssues_lastReviewed', {
                          date: new Date(issue.last_reviewed_at).toLocaleDateString(),
                        })}
                      </span>
                    )}
                  </div>
                  {issue.summary && <p className="text-sm whitespace-pre-wrap">{issue.summary}</p>}
                </div>
                {issue.source === 'voice_note' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={resolvingId === issue.id}
                    onClick={() => void resolveVoiceNote(issue.id)}
                  >
                    {t('openIssues_resolveVoiceNote')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
