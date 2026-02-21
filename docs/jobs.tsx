import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useJobs } from '@/hooks/useJobs';
import { JOB_STATUS_COLORS, JOB_STATUS_LABELS } from '@/constants/readings';
import type { ServiceJobWithProperty } from '@/types/database';

function JobCard({ job, onPress }: { job: ServiceJobWithProperty; onPress: () => void }) {
  const statusColor = JOB_STATUS_COLORS[job.status];
  const property = job.properties;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.routeOrderBadge}>
          <Text style={styles.routeOrderText}>{job.route_order ?? '—'}</Text>
        </View>
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.customerName}>{property.customer_name}</Text>
          <Text style={styles.address} numberOfLines={1}>{property.address}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {JOB_STATUS_LABELS[job.status]}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        {job.scheduled_time && (
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color="#64748B" />
            <Text style={styles.detailText}>{job.scheduled_time.slice(0, 5)}</Text>
          </View>
        )}
        {job.estimated_duration_min && (
          <View style={styles.detailRow}>
            <Ionicons name="hourglass-outline" size={14} color="#64748B" />
            <Text style={styles.detailText}>{job.estimated_duration_min} min</Text>
          </View>
        )}
        {property.pool_type && (
          <View style={styles.detailRow}>
            <Ionicons name="water-outline" size={14} color="#64748B" />
            <Text style={styles.detailText}>{property.pool_type}</Text>
          </View>
        )}
        {property.gate_code && (
          <View style={styles.detailRow}>
            <Ionicons name="key-outline" size={14} color="#64748B" />
            <Text style={styles.detailText}>Gate: {property.gate_code}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function JobsScreen() {
  const router = useRouter();
  const { jobs, isLoading, refresh } = useJobs();

  const completedCount = jobs.filter((j) => j.status === 'completed').length;

  return (
    <View style={styles.container}>
      {/* Summary bar */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {completedCount} of {jobs.length} completed
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: jobs.length > 0 ? `${(completedCount / jobs.length) * 100}%` : '0%' },
            ]}
          />
        </View>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <JobCard
            job={item}
            onPress={() => router.push(`/(app)/job/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#0891B2" />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No jobs today</Text>
              <Text style={styles.emptyText}>Enjoy your day off!</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  summary: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  summaryText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeOrderBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0891B2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeOrderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cardHeaderInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  address: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#64748B',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
});
