'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import {
  DEFAULT_AUTO_SEND_EVENT_TYPES,
  ROUTINE_AUTO_SEND_EVENT_TYPES,
  type RoutineAutoSendEventType,
} from '@/lib/customer-reports/types';

export function CustomerReportSettings() {
  const t = useTranslations('settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<RoutineAutoSendEventType[]>([
    ...DEFAULT_AUTO_SEND_EVENT_TYPES,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customer-report-settings');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || res.statusText);
        return;
      }
      const data = await res.json();
      setSelected(
        Array.isArray(data.auto_send_event_types)
          ? data.auto_send_event_types
          : [...DEFAULT_AUTO_SEND_EVENT_TYPES],
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(type: RoutineAutoSendEventType, on: boolean) {
    setSelected((prev) => {
      if (on) return prev.includes(type) ? prev : [...prev, type];
      return prev.filter((t) => t !== type);
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/customer-report-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_send_event_types: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || res.statusText);
        return;
      }
      setSelected(
        Array.isArray(data.auto_send_event_types)
          ? data.auto_send_event_types
          : selected,
      );
      toast.success(t('customerReportsSaved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6 max-w-lg">
      <p className="text-sm text-muted-foreground">{t('customerReportsHint')}</p>
      <div className="space-y-4 rounded-lg border bg-card p-6">
        {ROUTINE_AUTO_SEND_EVENT_TYPES.map((type) => (
          <div key={type} className="flex items-center justify-between gap-4">
            <Label htmlFor={`auto-send-${type}`} className="text-sm font-medium">
              {t(`customerReportEvent_${type}`)}
            </Label>
            <Switch
              id={`auto-send-${type}`}
              checked={selected.includes(type)}
              onCheckedChange={(on) => toggle(type, on)}
              data-testid={`auto-send-${type}`}
            />
          </div>
        ))}
      </div>
      <Button type="button" onClick={() => void handleSave()} disabled={saving}>
        {saving ? t('customerReportsSaving') : t('customerReportsSave')}
      </Button>
    </div>
  );
}
