import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Property } from '@/lib/database.types';

export default function PropertiesScreen() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('caicos_properties')
      .select('id, customer_name, address, pool_type')
      .eq('is_active', true)
      .order('customer_name')
      .then(({ data }) => {
        setProperties((data as Property[]) ?? []);
      })
      .then(() => setLoading(false), () => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading properties…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Properties ({properties.length})</Text>
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No properties</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.customer_name}</Text>
            <Text style={styles.cardAddress}>{item.address}</Text>
            <Text style={styles.cardMeta}>{item.pool_type ?? '—'}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardAddress: { fontSize: 14, color: '#666', marginTop: 4 },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 4 },
  empty: { textAlign: 'center', color: '#666', marginTop: 24 },
});
