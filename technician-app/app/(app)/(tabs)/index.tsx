import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, useColorScheme } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCachedUserId } from '@/lib/auth-session';
import { isJobsListInvalidated } from '@/lib/jobs-list-invalidation';
import type { ServiceJob } from '@/lib/database.types';
import Colors from '@/constants/Colors';

/** Today in local time as YYYY-MM-DD (avoids UTC date being wrong in Americas etc.) */
function getLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const FOCUS_STALE_MS = 60_000;

type JobWithProperty = ServiceJob & { cadenza_properties?: { customer_name: string; address: string } | null };

export default function JobsScreen() {
  const [jobs, setJobs] = useState<JobWithProperty[]>([]);
  const [overdueJobs, setOverdueJobs] = useState<JobWithProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const lastFetchedAt = useRef<number>(0);
  const skipNextFocusRef = useRef(true);
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  const today = getLocalDateString(new Date());

  const fetchJobs = useCallback(async () => {
    const userId = getCachedUserId();
    if (!userId) return;
    const [todayRes, overdueRes] = await Promise.all([
      supabase
        .from('cadenza_service_jobs')
        .select('id, status, scheduled_date, scheduled_time, route_order, estimated_duration_min, cadenza_properties(customer_name, address)')
        .eq('scheduled_date', today)
        .eq('technician_id', userId)
        .order('route_order', { nullsFirst: false }),
      supabase
        .from('cadenza_service_jobs')
        .select('id, status, scheduled_date, scheduled_time, route_order, estimated_duration_min, cadenza_properties(customer_name, address)')
        .lt('scheduled_date', today)
        .eq('technician_id', userId)
        .in('status', ['pending', 'in_progress'])
        .order('scheduled_date', { ascending: false })
        .order('route_order', { nullsFirst: false }),
    ]);
    setJobs((todayRes.data ?? []) as unknown as JobWithProperty[]);
    setOverdueJobs((overdueRes.data ?? []) as unknown as JobWithProperty[]);
    lastFetchedAt.current = Date.now();
  }, [today]);

  useEffect(() => {
    fetchJobs().finally(() => setLoading(false));
  }, [fetchJobs]);

  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusRef.current) {
        skipNextFocusRef.current = false;
        return;
      }
      const fetchedAt = lastFetchedAt.current;
      if (fetchedAt === 0) return;
      const stale = Date.now() - fetchedAt >= FOCUS_STALE_MS;
      const invalidated = isJobsListInvalidated(fetchedAt);
      if (stale || invalidated) {
        fetchJobs();
      }
    }, [fetchJobs])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  }, [fetchJobs]);

  const completed = jobs.filter((j) => j.status === 'completed').length;
  const progressPct = jobs.length > 0 ? Math.round((completed / jobs.length) * 100) : 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: c.background },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
        headerSection: { padding: 24, paddingBottom: 8 },
        headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        headerIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: c.badgeBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerIconText: { color: c.tint, fontSize: 18, fontWeight: '600' },
        date: { fontSize: 18, fontWeight: '700', color: c.text, letterSpacing: -0.3 },
        headerSub: { fontSize: 12, color: c.muted, marginTop: 2, fontWeight: '500' },
        progressCard: {
          marginTop: 16,
          marginBottom: 8,
          padding: 20,
          borderRadius: 16,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
        progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        progressTitle: { fontSize: 16, fontWeight: '700', color: c.text },
        progressSub: { fontSize: 14, color: c.muted, marginTop: 4 },
        progressCircle: {
          width: 40,
          height: 40,
          borderRadius: 20,
          borderWidth: 2,
          borderColor: c.borderSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.card,
        },
        progressCircleText: { fontSize: 11, fontWeight: '700', color: c.muted },
        progressBarBg: { height: 10, borderRadius: 5, backgroundColor: c.progressBarBg, marginTop: 16 },
        progressBarFill: { height: 10, borderRadius: 5, backgroundColor: c.progressBarFill, minWidth: 8 },
        listHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: 16,
        },
        listHeaderTitle: { fontSize: 20, fontWeight: '700', color: c.text },
        countBadge: {
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: c.tint,
          alignItems: 'center',
          justifyContent: 'center',
        },
        countBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
        listContent: { paddingHorizontal: 24, paddingBottom: 24 },
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
        cardAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
        cardAddress: { fontSize: 14, color: c.muted, fontWeight: '500' },
        cardFooter: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: c.divider,
        },
        startServiceBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          height: 40,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.tint,
        },
        startServiceText: { fontSize: 14, fontWeight: '600', color: c.tint },
        statusBadge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: c.chipBg,
        },
        statusBadgeText: { fontSize: 12, fontWeight: '600', color: c.tint },
        empty: { textAlign: 'center', color: c.muted, marginTop: 32, fontSize: 15 },
        overdueSection: { marginTop: 8, paddingBottom: 24 },
        overdueHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 0,
          paddingTop: 20,
          paddingBottom: 16,
        },
        overdueHeaderTitle: { fontSize: 20, fontWeight: '700', color: c.warningBorder },
        overdueCountBadge: {
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: c.warningBorder,
          alignItems: 'center',
          justifyContent: 'center',
        },
        overdueCountBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
        overdueCard: {
          backgroundColor: c.card,
          borderRadius: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: c.warningBorder,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        },
        overdueDateBadge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: c.warningBorder,
          alignSelf: 'flex-start',
        },
        overdueDateText: { fontSize: 11, fontWeight: '700', color: '#fff' },
      }),
    [c]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.text }}>Loading jobs...</Text>
      </View>
    );
  }

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <FlatList
      style={styles.container}
      data={jobs}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.tint} />}
      ListHeaderComponent={
        <>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={styles.headerIcon}>
                <Text style={styles.headerIconText}>{'Cal'[0]}</Text>
              </View>
              <View>
                <Text style={styles.date}>{dateLabel}</Text>
                <Text style={styles.headerSub}>Today's schedule</Text>
              </View>
            </View>
          </View>
          <View style={styles.progressCard}>
            <View style={styles.progressTop}>
              <View>
                <Text style={styles.progressTitle}>Daily Progress</Text>
                <Text style={styles.progressSub}>{completed} of {jobs.length} jobs completed</Text>
              </View>
              <View style={styles.progressCircle}>
                <Text style={styles.progressCircleText}>{progressPct}%</Text>
              </View>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.max(progressPct, 3)}%` }]} />
            </View>
          </View>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>Upcoming Jobs</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{jobs.length}</Text>
            </View>
          </View>
        </>
      }
      ListEmptyComponent={<Text style={styles.empty}>No jobs today. Enjoy your day off!</Text>}
      ListFooterComponent={
        overdueJobs.length > 0 ? (
          <View style={styles.overdueSection}>
            <View style={styles.overdueHeader}>
              <Text style={styles.overdueHeaderTitle}>Pending from Past</Text>
              <View style={styles.overdueCountBadge}>
                <Text style={styles.overdueCountBadgeText}>{overdueJobs.length}</Text>
              </View>
            </View>
            {overdueJobs.map((item) => {
              const prop = Array.isArray(item.cadenza_properties) ? item.cadenza_properties[0] : item.cadenza_properties;
              const overdueDateLabel = item.scheduled_date
                ? new Date(item.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                : '';
              return (
                <Pressable key={item.id} style={styles.overdueCard} onPress={() => router.push(`/(app)/job/${item.id}`)}>
                  <View style={styles.cardBody}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.cardTitle}>{prop?.customer_name ?? '—'}</Text>
                        <View style={styles.cardAddressRow}>
                          <Text style={styles.cardAddress}>{prop?.address ?? ''}</Text>
                        </View>
                      </View>
                      <View style={styles.overdueDateBadge}>
                        <Text style={styles.overdueDateText}>{overdueDateLabel}</Text>
                      </View>
                    </View>
                    <View style={styles.cardFooter}>
                      <View style={styles.startServiceBtn}>
                        <Text style={styles.startServiceText}>Start Service</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const prop = Array.isArray(item.cadenza_properties) ? item.cadenza_properties[0] : item.cadenza_properties;
        const isCompleted = item.status === 'completed';
        return (
          <Pressable style={styles.card} onPress={() => router.push(`/(app)/job/${item.id}`)}>
            <View style={styles.cardBody}>
              <View>
                <Text style={styles.cardTitle}>{prop?.customer_name ?? '\u2014'}</Text>
                <View style={styles.cardAddressRow}>
                  <Text style={styles.cardAddress}>{prop?.address ?? ''}</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                {!isCompleted ? (
                  <View style={styles.startServiceBtn}>
                    <Text style={styles.startServiceText}>Start Service</Text>
                  </View>
                ) : (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>Completed</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}
