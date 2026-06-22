import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppColors } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import {
  isJobActionable,
  jobStatusLabelKey,
  type JobStatus,
} from '@/lib/jobStatusDisplay';

type Props = {
  status: JobStatus;
  startLabel?: string;
  continueLabel?: string;
};

export function JobCardFooter({ status, startLabel, continueLabel }: Props) {
  const { colors: c } = useAppColors();
  const { t } = useI18n();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        footer: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
        },
        actionBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          height: 36,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.tint,
        },
        actionText: { fontSize: 14, fontWeight: '600', color: c.tint },
        statusBadge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: c.chipBg,
        },
        statusBadgeSkipped: {
          backgroundColor: c.warningBg,
        },
        statusBadgeCancelled: {
          backgroundColor: c.inputBgDisabled,
        },
        statusBadgeText: { fontSize: 12, fontWeight: '600', color: c.tint },
        statusBadgeTextSkipped: { color: c.warningText },
        statusBadgeTextCancelled: { color: c.mutedSecondary },
      }),
    [c]
  );

  if (isJobActionable(status)) {
    const label =
      status === 'in_progress'
        ? (continueLabel ?? t('jobs.continueService'))
        : (startLabel ?? t('jobs.startService'));
    return (
      <View style={styles.footer}>
        <View style={styles.actionBtn}>
          <Text style={styles.actionText}>{label}</Text>
        </View>
      </View>
    );
  }

  const badgeStyle =
    status === 'skipped'
      ? styles.statusBadgeSkipped
      : status === 'cancelled'
        ? styles.statusBadgeCancelled
        : null;
  const textStyle =
    status === 'skipped'
      ? styles.statusBadgeTextSkipped
      : status === 'cancelled'
        ? styles.statusBadgeTextCancelled
        : styles.statusBadgeText;

  return (
    <View style={styles.footer}>
      <View style={[styles.statusBadge, badgeStyle]}>
        <Text style={[styles.statusBadgeText, textStyle]}>{t(jobStatusLabelKey(status))}</Text>
      </View>
    </View>
  );
}
