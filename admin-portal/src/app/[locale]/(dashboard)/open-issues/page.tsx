'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { EntitlementGate } from '@/components/EntitlementGate';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/ui/page-header';
import { Link } from '@/i18n/navigation';
import { groupIssuesByTechnician, type OpenIssue } from '@/lib/follow-up-jobs';

type PropertyIdentity = { id: string; customer_name: string; address: string };
type ScreenIssue = OpenIssue & { property: PropertyIdentity | null };

const ALL = '__all__';
const UNASSIGNED = '__unassigned__';

function IssueRow({ issue }: { issue: ScreenIssue }) {
  const t = useTranslations();
  const propertyName = issue.property?.customer_name ?? '—';
  return (
    <li
      data-testid="open-issue-row"
      data-issue-id={issue.id}
      data-job-id={issue.job_id}
      data-source={issue.source}
    >
      <Link
        href={`/jobs/${issue.job_id}`}
        className="flex items-start gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors"
      >
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-foreground truncate" data-testid="issue-property">
              {propertyName}
            </span>
            <Badge
              variant="outline"
              data-testid="issue-days-open"
              className="shrink-0 border-warning/40 bg-warning/10 text-warning-foreground text-xs"
            >
              {t('openIssues_daysOpen', { count: issue.days_open })}
            </Badge>
          </div>
          {issue.property?.address && (
            <div className="text-sm text-muted-foreground truncate">{issue.property.address}</div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-xs" data-testid="issue-source">
              {issue.source === 'voice_note' ? t('openIssues_sourceVoiceNote') : t('openIssues_sourceReport')}
            </Badge>
            {issue.issue_categories.map((key) => (
              <Badge
                key={key}
                variant="outline"
                className="border-warning/40 bg-warning/10 text-warning-foreground text-xs"
              >
                {t.has(`issue_${key}`) ? t(`issue_${key}`) : key}
              </Badge>
            ))}
          </div>
          {issue.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2" data-testid="issue-summary">
              {issue.summary}
            </p>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0 mt-1">{t('openIssues_openJob')}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" aria-hidden />
      </Link>
    </li>
  );
}

function OpenIssuesByTechnician() {
  const t = useTranslations();
  const format = useFormatter();

  const [issues, setIssues] = useState<ScreenIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [technician, setTechnician] = useState(ALL);
  const [lastSent, setLastSent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/open-issues');
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(body.code === 'SCHEMA_PENDING' ? t('openIssues_schemaPending') : body.error || res.statusText);
          return;
        }
        setIssues((body.data ?? []) as ScreenIssue[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('openIssues_loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    async function loadStatus() {
      try {
        const res = await fetch('/api/open-issues/digest-status');
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setLastSent(body?.data?.last_sent_at ?? null);
      } catch {
        // The "last sent" cue is optional.
      }
    }
    void load();
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const groups = useMemo(() => groupIssuesByTechnician(issues), [issues]);
  const visibleGroups = useMemo(
    () =>
      groups.filter((group) => {
        if (technician === ALL) return true;
        if (technician === UNASSIGNED) return group.technician_id == null;
        return group.technician_id === technician;
      }),
    [groups, technician],
  );

  return (
    <div className="space-y-6" data-testid="open-issues-page">
      <PageHeader title={t('openIssues_title')} description={t('openIssues_pageDescription')} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <label htmlFor="open-issues-technician" className="text-xs font-medium">
            {t('openIssues_filterTechnician')}
          </label>
          <select
            id="open-issues-technician"
            data-testid="technician-filter"
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
            className="flex h-9 w-full min-w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value={ALL}>{t('openIssues_allTechnicians')}</option>
            {groups.map((group) => (
              <option key={group.technician_id ?? UNASSIGNED} value={group.technician_id ?? UNASSIGNED}>
                {group.technician_name || t('openIssues_unassigned')}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="digest-last-sent">
          {lastSent
            ? t('openIssues_digestLastSent', { date: format.dateTime(new Date(lastSent), { dateStyle: 'medium' }) })
            : t('openIssues_digestNeverSent')}
        </p>
      </div>

      {loading && <LoadingState size="sm" padded={false} className="py-8" />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && issues.length === 0 && (
        <p className="text-sm text-muted-foreground py-4" data-testid="open-issues-empty">
          {t('openIssues_empty')}
        </p>
      )}

      {visibleGroups.map((group) => (
        <Card
          key={group.technician_id ?? UNASSIGNED}
          data-testid="technician-group"
          data-technician-id={group.technician_id ?? ''}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg text-foreground" data-testid="technician-group-name">
              {group.technician_name || t('openIssues_unassigned')}
            </CardTitle>
            <Badge variant="secondary" data-testid="technician-group-count">
              {t('openIssues_groupCount', { count: group.issues.length })}
            </Badge>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {group.issues.map((issue) => (
                <IssueRow key={`${issue.source}:${issue.id}`} issue={issue as ScreenIssue} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function OpenIssuesPage() {
  return (
    <EntitlementGate resource="follow_up" action="view">
      <OpenIssuesByTechnician />
    </EntitlementGate>
  );
}
