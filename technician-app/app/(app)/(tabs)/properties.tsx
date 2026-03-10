import { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, useColorScheme } from 'react-native';
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
        container: { flex: 1, backgroundColor: c.background },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
        header: {
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderBottomColor: c.borderSubtle,
        },
        searchWrapper: {
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        searchBg: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.background,
          borderRadius: 12,
          height: 48,
          paddingHorizontal: 16,
          borderWidth: 1,
          borderColor: 'transparent',
        },
        searchInput: {
          flex: 1,
          height: 48,
          fontSize: 16,
          color: c.text,
        },
        filtersRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingBottom: 16,
          gap: 8,
        },
        filterChip: {
          paddingHorizontal: 16,
          height: 36,
          borderRadius: 9999,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.background,
          justifyContent: 'center',
          alignItems: 'center',
        },
        filterChipPrimary: {
          backgroundColor: c.buttonPrimary,
          borderColor: 'transparent',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 1,
        },
        filterText: {
          fontSize: 14,
          fontWeight: '500',
          color: c.text,
        },
        filterTextPrimary: {
          color: '#ffffff',
        },
        listContent: {
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 96,
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: '700',
          marginBottom: 12,
          color: c.text,
        },
        card: {
          backgroundColor: c.card,
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
        cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
        thumb: {
          width: 80,
          height: 80,
          borderRadius: 8,
          backgroundColor: c.progressBarBg,
        },
        cardBody: { flex: 1, justifyContent: 'space-between', height: 80, paddingVertical: 2 },
        cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        cardTitle: { fontSize: 16, fontWeight: '700', color: c.text, flex: 1 },
        typeBadge: {
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 9999,
          backgroundColor: c.chipBg,
        },
        typeBadgeText: { fontSize: 12, fontWeight: '500', color: c.tint },
        cardAddress: { fontSize: 14, color: c.muted, marginTop: 4 },
        cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 'auto' },
        cardMeta: { fontSize: 12, color: c.mutedSecondary },
        cardDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: c.border },
        cardFooter: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopWidth: 1,
          borderTopColor: c.divider,
          paddingTop: 12,
          marginTop: 12,
        },
        callBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 8,
          backgroundColor: c.badgeBg,
        },
        callBtnText: { fontSize: 14, fontWeight: '500', color: c.tint },
        empty: { textAlign: 'center', color: c.muted, marginTop: 32, fontSize: 15 },
      }),
    [c]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.text }}>Loading properties...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.searchWrapper}>
                <View style={styles.searchBg}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search properties or address..."
                    placeholderTextColor={c.placeholder}
                  />
                </View>
              </View>
              <View style={styles.filtersRow}>
                <View style={[styles.filterChip, styles.filterChipPrimary]}>
                  <Text style={[styles.filterText, styles.filterTextPrimary]}>All Types</Text>
                </View>
                <View style={styles.filterChip}>
                  <Text style={styles.filterText}>Residential</Text>
                </View>
                <View style={styles.filterChip}>
                  <Text style={styles.filterText}>Commercial</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Properties ({properties.length})</Text>
          </>
        }
        ListEmptyComponent={<Text style={styles.empty}>No properties</Text>}
        renderItem={({ item }) => {
          const poolType = item.pool_type ?? 'Pool';
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.thumb} />
                <View style={styles.cardBody}>
                  <View>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.customer_name}</Text>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>Residential</Text>
                      </View>
                    </View>
                    <Text style={styles.cardAddress} numberOfLines={1}>{item.address}</Text>
                  </View>
                  <View style={styles.cardMetaRow}>
                    <Text style={styles.cardMeta}>{poolType}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
