import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useI18n } from '@/lib/i18n';
import Colors from '@/constants/Colors';

export default function LanguageScreen() {
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];
  const { t } = useI18n();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: c.background },
        content: { padding: 16, paddingBottom: 40 },
        sectionCard: {
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
        sectionHeader: {
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: c.borderSubtle,
        },
        sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text },
        sectionBody: { padding: 20, gap: 16 },
        description: { fontSize: 14, color: c.muted, lineHeight: 20 },
      }),
    [c]
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.description}>{t('settings.languageDescription')}</Text>
            <LanguageSelector />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
