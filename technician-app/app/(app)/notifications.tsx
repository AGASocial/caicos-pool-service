import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, useColorScheme, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import Colors from '@/constants/Colors';

type Prefs = {
  job_assigned: boolean;
  job_reminder: boolean;
  schedule_changed: boolean;
  follow_up_due: boolean;
};

const DEFAULTS: Prefs = {
  job_assigned: true,
  job_reminder: true,
  schedule_changed: true,
  follow_up_due: false,
};

export default function NotificationsScreen() {
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const userIdRef = useRef<string | null>(null);

  const notificationGroups = useMemo(
    () => [
      {
        title: t('notifications.jobs'),
        items: [
          {
            key: 'job_assigned' as const,
            label: t('notifications.newJobAssigned'),
            description: t('notifications.newJobAssignedDesc'),
          },
          {
            key: 'job_reminder' as const,
            label: t('notifications.jobReminder'),
            description: t('notifications.jobReminderDesc'),
          },
          {
            key: 'schedule_changed' as const,
            label: t('notifications.scheduleChanged'),
            description: t('notifications.scheduleChangedDesc'),
          },
        ],
      },
      {
        title: t('notifications.followUps'),
        items: [
          {
            key: 'follow_up_due' as const,
            label: t('notifications.followUpDue'),
            description: t('notifications.followUpDueDesc'),
          },
        ],
      },
    ],
    [t]
  );

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        userIdRef.current = user.id;
        const { data } = await supabase
          .from('cadenza_profiles')
          .select('notification_prefs')
          .eq('id', user.id)
          .single();
        if (data?.notification_prefs) {
          setPrefs({ ...DEFAULTS, ...(data.notification_prefs as Partial<Prefs>) });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function toggle(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    if (!userIdRef.current) return;
    const { error } = await supabase
      .from('cadenza_profiles')
      .update({ notification_prefs: next })
      .eq('id', userIdRef.current);
    if (error) {
      setPrefs(prefs);
      Alert.alert(t('common.error'), error.message ?? t('notifications.saveFailed'));
    }
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: c.background },
        content: { padding: 16, gap: 16, paddingBottom: 40 },
        sectionLabel: {
          fontSize: 12,
          fontWeight: '600',
          color: c.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 4,
          marginLeft: 4,
        },
        card: {
          backgroundColor: c.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: c.divider,
          gap: 16,
        },
        rowLast: { borderBottomWidth: 0 },
        rowText: { flex: 1, gap: 2 },
        rowLabel: { fontSize: 16, fontWeight: '500', color: c.text },
        rowDescription: { fontSize: 13, color: c.muted },
      }),
    [c]
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background }}>
        <Text style={{ color: c.muted }}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {notificationGroups.map((group) => (
          <View key={group.title}>
            <Text style={styles.sectionLabel}>{group.title}</Text>
            <View style={styles.card}>
              {group.items.map((item, idx) => (
                <View
                  key={item.key}
                  style={[styles.row, idx === group.items.length - 1 && styles.rowLast]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowDescription}>{item.description}</Text>
                  </View>
                  <Switch
                    value={prefs[item.key]}
                    onValueChange={(v) => { toggle(item.key, v); }}
                    trackColor={{ false: c.switchTrack, true: c.switchTrackActive }}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
