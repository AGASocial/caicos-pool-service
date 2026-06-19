'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { FollowUpAction, FollowUpActionType } from '@/lib/follow-up-jobs';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

const OFFICE_ROLES = new Set(['owner', 'admin', 'operations']);

type Props = {
  jobId: string;
  isResolved: boolean;
  onResolved?: () => void;
};

function actionBadgeVariant(type: FollowUpActionType): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (type) {
    case 'resolved':
      return 'secondary';
    case 'email_sent':
      return 'default';
    case 'call':
      return 'outline';
    default:
      return 'outline';
  }
}

export function FollowUpActionsCard({ jobId, isResolved, onResolved }: Props) {
  const t = useTranslations();
  const { user } = useAuth();
  const canManage = OFFICE_ROLES.has(user?.profile?.role ?? '');

  const [actions, setActions] = useState<FollowUpAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copyingEmail, setCopyingEmail] = useState(false);
  const [copyingSms, setCopyingSms] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadActions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/follow-up-actions`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || res.statusText);
        setActions([]);
        return;
      }
      setActions(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadActions();
  }, [loadActions]);

  async function copyTemplate(channel: 'email' | 'sms') {
    const setCopying = channel === 'email' ? setCopyingEmail : setCopyingSms;
    setCopying(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/message-template?channel=${channel}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText);
        return;
      }
      await navigator.clipboard.writeText(String(data.clipboard_text ?? data.body ?? ''));
      toast.success(channel === 'email' ? t('emailTemplateCopied') : t('smsTemplateCopied'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to copy template');
    } finally {
      setCopying(false);
    }
  }

  async function postAction(actionType: FollowUpActionType, body?: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/follow-up-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: actionType, body: body ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText);
        return;
      }
      setActions((prev) => [data as FollowUpAction, ...prev]);
      if (actionType === 'note') setNote('');
      if (actionType === 'resolved') onResolved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteAction(actionId: string) {
    setDeletingId(actionId);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/follow-up-actions/${actionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || res.statusText);
        return;
      }
      setActions((prev) => prev.filter((action) => action.id !== actionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{t('officeFollowUp')}</CardTitle>
        {isResolved && (
          <Badge variant="secondary">{t('followUpResolved')}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {canManage && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex flex-col items-end gap-2">
              <p className="text-sm text-muted-foreground text-right max-w-lg">
                {t('copyTemplateHint')}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={copyingEmail || copyingSms}
                  onClick={() => void copyTemplate('email')}
                >
                  {copyingEmail ? t('loading', { defaultValue: 'Loading…' }) : t('copyEmailTemplate')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={copyingEmail || copyingSms}
                  onClick={() => void copyTemplate('sms')}
                >
                  {copyingSms ? t('loading', { defaultValue: 'Loading…' }) : t('copySmsTemplate')}
                </Button>
              </div>
            </div>
            {!isResolved && (
              <>
            <div className="space-y-2">
              <Label htmlFor="follow-up-note">{t('addOfficeNote')}</Label>
              <textarea
                id="follow-up-note"
                className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('officeNotePlaceholder')}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={submitting || !note.trim()}
                onClick={() => void postAction('note', note.trim())}
              >
                {t('saveNote')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={submitting}
                onClick={() => void postAction('call')}
              >
                {t('logCall')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={submitting}
                onClick={() => void postAction('email_sent', note.trim() || undefined)}
              >
                {t('logEmail')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={submitting}
                onClick={() => void postAction('resolved')}
              >
                {t('markResolved')}
              </Button>
            </div>
              </>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('loading', { defaultValue: 'Loading…' })}</p>
        ) : actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noFollowUpActions')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {actions.map((action) => (
              <li key={action.id} className="py-3 first:pt-0">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant={actionBadgeVariant(action.action_type as FollowUpActionType)}>
                        {t(`followUpAction_${action.action_type}`)}
                      </Badge>
                      <span className="text-muted-foreground">
                        {action.author?.full_name ?? t('unknownUser')}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <time className="text-muted-foreground tabular-nums" dateTime={action.created_at}>
                        {new Date(action.created_at).toLocaleString()}
                      </time>
                    </div>
                    {action.body && (
                      <p className="mt-1.5 text-sm whitespace-pre-wrap">{action.body}</p>
                    )}
                  </div>
                  {canManage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={deletingId === action.id}
                      aria-label={t('removeFollowUpAction')}
                      onClick={() => void deleteAction(action.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
