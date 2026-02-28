import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, useColorScheme } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { ServiceJob } from '@/lib/database.types';
import Colors from '@/constants/Colors';

/** Today in local time as YYYY-MM-DD (avoids UTC date being wrong in Americas etc.) */
function getLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function JobsScreen() {
  const [jobs, setJobs] = useState<(ServiceJob & { caicos_properties?: { customer_name: string; address: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  const today = getLocalDateString(new Date());

  const fetchJobs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('caicos_service_jobs')
      .select('id, status, scheduled_date, scheduled_time, route_order, estimated_duration_min, caicos_properties(customer_name, address)')
      .eq('scheduled_date', today)
      .eq('technician_id', user.id)
      .order('route_order', { nullsFirst: false });
    setJobs((data ?? []) as unknown as (ServiceJob & { caicos_properties?: { customer_name: string; address: string } | null })[]);
  }, [today]);

  useEffect(() => {
    fetchJobs().finally(() => setLoading(false));
  }, [fetchJobs]);

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  }, [fetchJobs]);

  const completed = jobs.filter((j) => j.status === 'completed').length;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, padding: 16, backgroundColor: c.background },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
        date: { fontSize: 18, fontWeight: '600', color: c.text },
        subtitle: { fontSize: 14, color: c.muted, marginTop: 4 },
        progress: { fontSize: 14, color: c.tint, marginTop: 8, marginBottom: 16 },
        card: {
          backgroundColor: c.card,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: c.border,
        },
        cardTitle: { fontSize: 16, fontWeight: '600', color: c.text },
        cardAddress: { fontSize: 14, color: c.muted, marginTop: 4 },
        cardMeta: { fontSize: 12, color: c.mutedSecondary, marginTop: 4 },
        empty: { textAlign: 'center', color: c.muted, marginTop: 24 },
      }),
    [c]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.text }}>Loading jobs…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
      <Text style={styles.subtitle}>{jobs.length} jobs assigned</Text>
      <Text style={styles.progress}>Progress: {completed} of {jobs.length}</Text>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No jobs today. Enjoy your day off!</Text>}
        renderItem={({ item }) => {
          const prop = Array.isArray(item.caicos_properties) ? item.caicos_properties[0] : item.caicos_properties;
          return (
            <Pressable style={styles.card} onPress={() => router.push(`/(app)/job/${item.id}`)}>
              <Text style={styles.cardTitle}>{prop?.customer_name ?? '—'}</Text>
              <Text style={styles.cardAddress}>{prop?.address ?? ''}</Text>
              <Text style={styles.cardMeta}>
                {item.scheduled_time ?? '—'} • {item.estimated_duration_min} min • {item.status}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
