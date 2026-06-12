'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { ServiceJob } from '@/lib/database.types';
import Colors from '@/constants/Colors';

function getLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns the Monday of the week containing `d` */
function getWeekStart(d: Date): Date {
  const copy = new Date(d);
  const dow = copy.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

type JobWithProperty = ServiceJob & {
  cadenza_properties?: { customer_name: string; address: string } | null;
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarScreen() {
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];
  const router = useRouter();

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => getLocalDateString(today), [today]);

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(today));
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [jobsByDate, setJobsByDate] = useState<Record<string, JobWithProperty[]>>({});
  const [refreshing, setRefreshing] = useState(false);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const fetchWeek = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const from = getLocalDateString(weekDates[0]);
    const to = getLocalDateString(weekDates[6]);
    const { data } = await supabase
      .from('cadenza_service_jobs')
      .select('id, status, scheduled_date, scheduled_time, route_order, estimated_duration_min, cadenza_properties(customer_name, address)')
      .eq('technician_id', user.id)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .order('route_order', { nullsFirst: false });
    const map: Record<string, JobWithProperty[]> = {};
    for (const job of (data ?? []) as unknown as JobWithProperty[]) {
      const d = job.scheduled_date ?? '';
      if (!map[d]) map[d] = [];
      map[d].push(job);
    }
    setJobsByDate(map);
  }, [weekDates]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWeek();
    setRefreshing(false);
  }, [fetchWeek]);

  function goToPrevWeek() {
    setWeekStart((w) => addDays(w, -7));
  }

  function goToNextWeek() {
    setWeekStart((w) => addDays(w, 7));
  }

  const selectedJobs = jobsByDate[selectedDate] ?? [];

  const monthLabel = weekDates[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: c.background },
        // Week nav
        weekNav: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 8,
        },
        weekNavArrow: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        },
        weekNavArrowText: { fontSize: 18, color: c.text, fontWeight: '600', lineHeight: 22 },
        monthLabel: { fontSize: 15, fontWeight: '700', color: c.text, letterSpacing: -0.2 },
        // Day strip
        dayStrip: {
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingBottom: 12,
          gap: 6,
        },
        dayCell: {
          flex: 1,
          alignItems: 'center',
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          gap: 4,
        },
        dayCellSelected: {
          backgroundColor: c.tint,
          borderColor: c.tint,
        },
        dayCellToday: {
          borderColor: c.tint,
        },
        dayLabel: { fontSize: 10, fontWeight: '600', color: c.muted, letterSpacing: 0.3 },
        dayLabelSelected: { color: '#fff' },
        dayNum: { fontSize: 15, fontWeight: '700', color: c.text },
        dayNumSelected: { color: '#fff' },
        dotRow: { flexDirection: 'row', gap: 2, minHeight: 6 },
        dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.muted },
        dotSelected: { backgroundColor: 'rgba(255,255,255,0.7)' },
        dotCompleted: { backgroundColor: c.tint },
        // Jobs list
        listArea: { flex: 1, paddingHorizontal: 24 },
        dayHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingTop: 16,
          paddingBottom: 12,
        },
        dayHeaderText: { fontSize: 18, fontWeight: '700', color: c.text },
        countBadge: {
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: c.tint,
          alignItems: 'center',
          justifyContent: 'center',
        },
        countBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
        empty: { textAlign: 'center', color: c.muted, marginTop: 40, fontSize: 15 },
        card: {
          backgroundColor: c.card,
          borderRadius: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        },
        cardBody: { padding: 16, paddingTop: 12, gap: 12 },
        cardTitle: { fontSize: 16, fontWeight: '700', color: c.text },
        cardAddress: { fontSize: 14, color: c.muted, fontWeight: '500', marginTop: 2 },
        cardFooter: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: c.divider,
        },
        statusBadge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: c.chipBg,
        },
        statusBadgeText: { fontSize: 12, fontWeight: '600', color: c.tint },
        startBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          height: 36,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.tint,
        },
        startBtnText: { fontSize: 14, fontWeight: '600', color: c.tint },
      }),
    [c]
  );

  return (
    <View style={styles.container}>
      {/* Week navigation */}
      <View style={styles.weekNav}>
        <Pressable style={styles.weekNavArrow} onPress={goToPrevWeek}>
          <Text style={styles.weekNavArrowText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable style={styles.weekNavArrow} onPress={goToNextWeek}>
          <Text style={styles.weekNavArrowText}>›</Text>
        </Pressable>
      </View>

      {/* Day strip */}
      <View style={styles.dayStrip}>
        {weekDates.map((d, i) => {
          const ds = getLocalDateString(d);
          const isSelected = ds === selectedDate;
          const isToday = ds === todayStr;
          const dayJobs = jobsByDate[ds] ?? [];
          const completedCount = dayJobs.filter((j) => j.status === 'completed').length;
          const pendingCount = dayJobs.length - completedCount;

          return (
            <Pressable
              key={ds}
              style={[styles.dayCell, isToday && styles.dayCellToday, isSelected && styles.dayCellSelected]}
              onPress={() => setSelectedDate(ds)}
            >
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
                {DAY_LABELS[i]}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                {d.getDate()}
              </Text>
              <View style={styles.dotRow}>
                {Array.from({ length: Math.min(pendingCount, 3) }).map((_, k) => (
                  <View key={`p${k}`} style={[styles.dot, isSelected && styles.dotSelected]} />
                ))}
                {Array.from({ length: Math.min(completedCount, 3) }).map((_, k) => (
                  <View key={`c${k}`} style={[styles.dot, !isSelected && styles.dotCompleted, isSelected && styles.dotSelected]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Jobs for selected day */}
      <ScrollView
        style={styles.listArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.tint} />}
      >
        <View style={styles.dayHeader}>
          <Text style={styles.dayHeaderText}>
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
          {selectedJobs.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{selectedJobs.length}</Text>
            </View>
          )}
        </View>

        {selectedJobs.length === 0 ? (
          <Text style={styles.empty}>No jobs scheduled</Text>
        ) : (
          selectedJobs.map((item) => {
            const prop = Array.isArray(item.cadenza_properties)
              ? item.cadenza_properties[0]
              : item.cadenza_properties;
            const isCompleted = item.status === 'completed';
            return (
              <Pressable
                key={item.id}
                style={styles.card}
                onPress={() => router.push(`/(app)/job/${item.id}`)}
              >
                <View style={styles.cardBody}>
                  <View>
                    <Text style={styles.cardTitle}>{prop?.customer_name ?? '—'}</Text>
                    <Text style={styles.cardAddress}>{prop?.address ?? ''}</Text>
                  </View>
                  <View style={styles.cardFooter}>
                    {isCompleted ? (
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>Completed</Text>
                      </View>
                    ) : (
                      <View style={styles.startBtn}>
                        <Text style={styles.startBtnText}>Start Service</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
