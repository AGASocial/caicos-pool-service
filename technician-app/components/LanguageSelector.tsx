import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme, type ViewStyle } from 'react-native';
import Colors from '@/constants/Colors';
import { useI18n, type Locale } from '@/lib/i18n';

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

export function getLocaleDisplayName(locale: Locale): string {
  return OPTIONS.find((o) => o.value === locale)?.label ?? locale;
}

type Props = {
  variant?: 'default' | 'auth';
  style?: ViewStyle;
};

export function LanguageSelector({ variant = 'default', style }: Props) {
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];
  const { locale, setLocale } = useI18n();
  const isAuth = variant === 'auth';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          gap: 8,
        },
        option: {
          flex: 1,
          minHeight: 44,
          borderRadius: 10,
          borderWidth: 1.5,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
        },
        optionDefault: {
          borderColor: c.border,
          backgroundColor: c.inputBgAlt,
        },
        optionDefaultSelected: {
          borderColor: c.tint,
          backgroundColor: c.chipBg,
        },
        optionAuth: {
          borderColor: 'rgba(199, 168, 95, 0.45)',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
        },
        optionAuthSelected: {
          borderColor: '#C7A85F',
          backgroundColor: 'rgba(199, 168, 95, 0.18)',
        },
        label: {
          fontSize: 14,
          fontWeight: '600',
        },
        labelDefault: { color: c.text },
        labelDefaultMuted: { color: c.muted },
        labelAuth: { color: '#F3EEE4' },
        labelAuthMuted: { color: 'rgba(243, 238, 228, 0.65)' },
      }),
    [c]
  );

  return (
    <View style={[styles.row, style]} accessibilityRole="radiogroup">
      {OPTIONS.map(({ value, label }) => {
        const selected = locale === value;
        return (
          <Pressable
            key={value}
            style={[
              styles.option,
              isAuth ? styles.optionAuth : styles.optionDefault,
              selected && (isAuth ? styles.optionAuthSelected : styles.optionDefaultSelected),
            ]}
            onPress={() => setLocale(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
          >
            <Text
              style={[
                styles.label,
                isAuth
                  ? selected
                    ? styles.labelAuth
                    : styles.labelAuthMuted
                  : selected
                    ? styles.labelDefault
                    : styles.labelDefaultMuted,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
