'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import {
  type ServiceReport,
  hasChemicalReadings,
  hasEquipmentFlags,
  hasVisitExtras,
  hasCantServiceReasons,
  normalizeIssueCategories,
} from '@/lib/service-report';
import { cn } from '@/lib/utils';

type Props = {
  report: ServiceReport | null;
  className?: string;
};

function ReadingRow({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  if (value == null) return null;
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}:</span>{' '}
      <span className="font-medium tabular-nums">{value}{unit ? ` ${unit}` : ''}</span>
    </p>
  );
}

function EquipmentRow({ label, ok }: { label: string; ok: boolean | null }) {
  if (ok == null) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <Badge variant={ok ? 'secondary' : 'destructive'}>{ok ? 'OK' : 'Issue'}</Badge>
    </div>
  );
}

export function ServiceReportCard({ report, className }: Props) {
  const t = useTranslations();
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!report) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{t('serviceReport')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('noServiceReportYet')}</p>
        </CardContent>
      </Card>
    );
  }

  const issues = normalizeIssueCategories(report.issue_categories);
  const cantServiceReasons = report.cant_service_reasons ?? [];
  const showDetails = hasChemicalReadings(report) || hasEquipmentFlags(report);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t('serviceReport')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasCantServiceReasons(report) && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('cantServiceReasons')}
            </p>
            <div className="flex flex-wrap gap-2">
              {cantServiceReasons.map((key) => (
                <Badge key={key} variant="outline" className="border-destructive/40 bg-destructive/10">
                  {t(`cant_service_${key}` as 'cant_service_gate_locked')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('issuesFound')}
          </p>
          {issues.length === 0 ? (
            <Badge variant="secondary">{t('noIssuesReported')}</Badge>
          ) : (
            <div className="flex flex-wrap gap-2">
              {issues.map((key) => (
                <Badge key={key} variant="outline" className="border-warning/40 bg-warning/10 text-warning-foreground">
                  {t(`issue_${key}`)}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {hasVisitExtras(report) && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('visitExtras')}
            </p>
            <div className="flex flex-wrap gap-2">
              {report.cleaned_filter && (
                <Badge variant="secondary">{t('extra_filterServiced')}</Badge>
              )}
              {report.vacuumed && (
                <Badge variant="secondary">{t('extra_extraVacuum')}</Badge>
              )}
            </div>
            {report.other_chemicals && (
              <p className="text-sm">
                <span className="text-muted-foreground">{t('saltOrChemicals')}:</span>{' '}
                {report.other_chemicals}
              </p>
            )}
          </div>
        )}

        {report.notes && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('technicianNotes')}
            </p>
            <p className="text-sm whitespace-pre-wrap">{report.notes}</p>
          </div>
        )}

        {(report.follow_up_needed || report.follow_up_notes) && (
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-warning-foreground">
              {t('followUpNeeded')}
            </p>
            {report.follow_up_notes ? (
              <p className="text-sm whitespace-pre-wrap">{report.follow_up_notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('followUpFlagged')}</p>
            )}
          </div>
        )}

        {showDetails && (
          <div className="border-t border-border pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-0 text-muted-foreground hover:text-foreground"
              onClick={() => setDetailsOpen((v) => !v)}
            >
              {t('chemicalAndEquipmentDetails')}
              <ChevronDown className={cn('h-4 w-4 transition-transform', detailsOpen && 'rotate-180')} />
            </Button>
            {detailsOpen && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {hasChemicalReadings(report) && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {t('chemicalReadings')}
                    </p>
                    <ReadingRow label={t('chem_ph')} value={report.ph_level} />
                    <ReadingRow label={t('chem_chlorine')} value={report.chlorine_level} unit="ppm" />
                    <ReadingRow label={t('chem_alkalinity')} value={report.alkalinity} unit="ppm" />
                    <ReadingRow label={t('chem_calcium')} value={report.calcium_hardness} unit="ppm" />
                    <ReadingRow label={t('chem_cya')} value={report.cyanuric_acid} unit="ppm" />
                    <ReadingRow label={t('chem_salt')} value={report.salt_level} unit="ppm" />
                    <ReadingRow label={t('chem_waterTemp')} value={report.water_temp_f} unit="°F" />
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('equipmentStatus')}
                  </p>
                  <EquipmentRow label={t('equip_pump')} ok={report.pump_ok} />
                  <EquipmentRow label={t('equip_filter')} ok={report.filter_ok} />
                  <EquipmentRow label={t('equip_heater')} ok={report.heater_ok} />
                  <EquipmentRow label={t('equip_cleaner')} ok={report.cleaner_ok} />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
