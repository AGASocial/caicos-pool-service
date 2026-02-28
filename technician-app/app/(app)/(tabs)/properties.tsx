import { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, useColorScheme } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Property } from '@/lib/database.types';
import Colors from '@/constants/Colors';

export default function PropertiesScreen() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, padding: 16, backgroundColor: c.background },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
        title: { fontSize: 18, fontWeight: '600', marginBottom: 16, color: c.text },
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
        <Text style={{ color: c.text }}>Loading properties…</Text>
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
