import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { ServiceJob } from '@/lib/database.types';

export default function JobsScreen() {
  const [jobs, setJobs] = useState<(ServiceJob & { properties?: { customer_name: string; address: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);

  const fetchJobs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('caicos_service_jobs')
      .select('id, status, scheduled_date, scheduled_time, route_order, estimated_duration_min, properties(customer_name, address)')
      .eq('scheduled_date', today)
      .order('route_order', { nullsFirst: false });
    setJobs((data ?? []) as unknown as (ServiceJob & { properties?: { customer_name: string; address: string } | null })[]);
  }, [today]);

  useEffect(() => {
    fetchJobs().finally(() => setLoading(false));
  }, [fetchJobs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  }, [fetchJobs]);

  const completed = jobs.filter((j) => j.status === 'completed').length;

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading jobs…</Text>
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
          const prop = Array.isArray(item.properties) ? item.properties[0] : item.properties;
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  date: { fontSize: 18, fontWeight: '600' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  progress: { fontSize: 14, color: '#2563eb', marginTop: 8, marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardAddress: { fontSize: 14, color: '#666', marginTop: 4 },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 4 },
  empty: { textAlign: 'center', color: '#666', marginTop: 24 },
});
