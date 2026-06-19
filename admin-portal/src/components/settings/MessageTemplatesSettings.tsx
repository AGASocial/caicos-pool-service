'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Mail, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingState } from '@/components/ui/loading-state';
import { cn } from '@/lib/utils';
import type { MessageTemplate, MessageChannel } from '@/lib/message-templates';
import { DEFAULT_TEMPLATE_LOCALE, TEMPLATE_TAGS } from '@/lib/message-templates';
import { ISSUE_CATEGORY_KEYS, type IssueCategoryKey } from '@/lib/service-report';

type FormState = {
  name: string;
  subject: string;
  body: string;
  issue_categories: IssueCategoryKey[];
  is_default: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  subject: '',
  body: '',
  issue_categories: [],
  is_default: false,
};

export function MessageTemplatesSettings() {
  const t = useTranslations();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<MessageChannel>('email');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/message-templates?locale=${DEFAULT_TEMPLATE_LOCALE}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || res.statusText);
        setTemplates([]);
        return;
      }
      setTemplates(await res.json());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const channelTemplates = useMemo(
    () => templates.filter((tpl) => tpl.channel === channel),
    [templates, channel],
  );

  function openCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      is_default: channelTemplates.length === 0,
    });
    setDialogOpen(true);
  }

  function openEdit(tpl: MessageTemplate) {
    setEditingId(tpl.id);
    setForm({
      name: tpl.name,
      subject: tpl.subject ?? '',
      body: tpl.body,
      issue_categories: tpl.issue_categories,
      is_default: tpl.is_default,
    });
    setDialogOpen(true);
  }

  function toggleIssue(key: IssueCategoryKey) {
    setForm((prev) => {
      const selected = prev.issue_categories.includes(key);
      const issue_categories = selected
        ? prev.issue_categories.filter((k) => k !== key)
        : [...prev.issue_categories, key];
      return {
        ...prev,
        issue_categories,
        is_default: issue_categories.length > 0 ? false : prev.is_default,
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        channel,
        locale: DEFAULT_TEMPLATE_LOCALE,
        name: form.name.trim(),
        subject: channel === 'email' ? form.subject.trim() : null,
        body: form.body.trim(),
        issue_categories: form.issue_categories,
        is_default: form.is_default,
      };

      const res = await fetch(
        editingId ? `/api/message-templates/${editingId}` : '/api/message-templates',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || res.statusText);
        return;
      }

      toast.success(t('settings.templateSaved'));
      setDialogOpen(false);
      await loadTemplates();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('settings.templateDeleteConfirm'))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/message-templates/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || res.statusText);
        return;
      }
      toast.success(t('settings.templateDeleted'));
      await loadTemplates();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('settings.templateEnglishOnlyNote')}</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-border p-1">
          {(['email', 'sms'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setChannel(value)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                channel === value
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'email' ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
              {value === 'email' ? t('settings.templateChannelEmail') : t('settings.templateChannelSms')}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('settings.templateAdd')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.templateMergeTags')}</CardTitle>
          <CardDescription>{t('settings.templateMergeTagsHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_TAGS.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-mono text-xs">
                {`{{${tag}}}`}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingState padded={false} className="py-12" />
      ) : channelTemplates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('settings.templateEmpty')}</p>
      ) : (
        <ul className="space-y-3">
          {channelTemplates.map((tpl) => (
            <li key={tpl.id}>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{tpl.name}</CardTitle>
                    <div className="flex flex-wrap gap-1.5">
                      {tpl.is_default && (
                        <Badge variant="default">{t('settings.templateDefault')}</Badge>
                      )}
                      {tpl.issue_categories.length === 0 && !tpl.is_default && (
                        <Badge variant="outline">{t('settings.templateGeneric')}</Badge>
                      )}
                      {tpl.issue_categories.map((key) => (
                        <Badge key={key} variant="outline" className="border-warning/40 bg-warning/10">
                          {t(`issue_${key}`)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(tpl)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deletingId === tpl.id}
                      onClick={() => void handleDelete(tpl.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {tpl.channel === 'email' && tpl.subject && (
                    <p>
                      <span className="text-muted-foreground">{t('settings.templateSubject')}:</span>{' '}
                      {tpl.subject}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-muted-foreground line-clamp-4">{tpl.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('settings.templateEdit') : t('settings.templateAdd')}
            </DialogTitle>
            <DialogDescription>{t('settings.templateFormHint')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">{t('settings.templateName')}</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            {channel === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="tpl-subject">{t('settings.templateSubject')}</Label>
                <Input
                  id="tpl-subject"
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tpl-body">{t('settings.templateBody')}</Label>
              <textarea
                id="tpl-body"
                className="flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono"
                value={form.body}
                onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('settings.templateIssueCategories')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.templateIssueCategoriesHint')}</p>
              <div className="flex flex-wrap gap-2">
                {ISSUE_CATEGORY_KEYS.map((key) => {
                  const selected = form.issue_categories.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleIssue(key)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        selected
                          ? 'border-warning bg-warning/15 text-warning-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {t(`issue_${key}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-input"
                checked={form.is_default}
                disabled={form.issue_categories.length > 0}
                onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
              />
              {t('settings.templateDefault')}
            </label>
            {form.issue_categories.length > 0 && (
              <p className="text-xs text-muted-foreground">{t('settings.templateDefaultDisabledHint')}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? t('loading', { defaultValue: 'Loading…' }) : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
