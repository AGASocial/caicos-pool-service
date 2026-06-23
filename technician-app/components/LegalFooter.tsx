import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Colors from '@/constants/Colors';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/constants/Legal';
import { useI18n } from '@/lib/i18n';

type Props = {
  compact?: boolean;
};

export function LegalFooter({ compact = false }: Props) {
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];
  const { t } = useI18n();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: 'center',
          paddingVertical: compact ? 12 : 20,
          gap: compact ? 6 : 8,
        },
        row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
        text: { fontSize: compact ? 11 : 12, color: c.mutedSecondary, textAlign: 'center' },
        link: { fontSize: compact ? 11 : 12, color: c.link, fontWeight: '600' },
        dot: { fontSize: 11, color: c.mutedSecondary },
      }),
    [c, compact]
  );

  function openUrl(url: string) {
    void WebBrowser.openBrowserAsync(url);
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable onPress={() => openUrl(PRIVACY_POLICY_URL)} hitSlop={8}>
          <Text style={styles.link}>{t('common.privacyPolicy')}</Text>
        </Pressable>
        <Text style={styles.dot}>·</Text>
        <Pressable onPress={() => openUrl(TERMS_OF_SERVICE_URL)} hitSlop={8}>
          <Text style={styles.link}>{t('common.termsOfService')}</Text>
        </Pressable>
      </View>
      {!compact && (
        <Text style={styles.text}>© {new Date().getFullYear()} Cadenza Operations</Text>
      )}
    </View>
  );
}
