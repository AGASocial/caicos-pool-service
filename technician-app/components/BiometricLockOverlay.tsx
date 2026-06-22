import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  useColorScheme,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  authenticateWithBiometrics,
  getBiometricCapability,
} from '@/lib/biometric-auth';
import { useI18n } from '@/lib/i18n';
import Colors from '@/constants/Colors';

type Props = {
  visible: boolean;
  onUnlock: () => void;
};

export function BiometricLockOverlay({ visible, onUnlock }: Props) {
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('Face ID');
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];
  const { t } = useI18n();

  const attemptUnlock = useCallback(
    async (biometricLabel: string) => {
      setUnlocking(true);
      setError(null);

      const success = await authenticateWithBiometrics(
        t('biometricLock.unlockPrompt', { label: biometricLabel })
      );
      setUnlocking(false);

      if (success) {
        onUnlock();
        return;
      }

      setError(t('biometricLock.verificationCancelled', { label: biometricLabel }));
    },
    [onUnlock, t]
  );

  useEffect(() => {
    if (!visible) {
      setError(null);
      setUnlocking(false);
      return;
    }

    void (async () => {
      const { label: biometricLabel } = await getBiometricCapability();
      setLabel(biometricLabel);
      await attemptUnlock(biometricLabel);
    })();
  }, [visible, attemptUnlock]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          ...StyleSheet.absoluteFillObject,
          zIndex: 1000,
        },
        content: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
        },
        logo: { width: 96, height: 96, marginBottom: 24 },
        title: { fontSize: 30, fontWeight: '500', color: '#F3EEE4', marginBottom: 8, letterSpacing: 0.3, fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }) },
        subtitle: {
          fontSize: 16,
          color: 'rgba(243, 238, 228, 0.8)',
          textAlign: 'center',
          marginBottom: 32,
          lineHeight: 22,
        },
        button: {
          backgroundColor: '#C7A85F',
          borderRadius: 12,
          minWidth: 220,
          height: 52,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        },
        buttonDisabled: { opacity: 0.7 },
        buttonText: { color: '#1a1407', fontWeight: '700', fontSize: 16 },
        error: { color: c.error, fontSize: 14, marginTop: 16, textAlign: 'center' },
      }),
    [c.error]
  );

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <LinearGradient
        colors={['#15191F', '#0F1419']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
        <Text style={styles.title}>Cadenza</Text>
        <Text style={styles.subtitle}>{t('biometricLock.subtitle', { label })}</Text>

        <Pressable
          style={[styles.button, unlocking && styles.buttonDisabled]}
          onPress={() => void attemptUnlock(label)}
          disabled={unlocking}
        >
          {unlocking ? (
            <ActivityIndicator color="#1a1407" size="small" />
          ) : (
            <Text style={styles.buttonText}>{t('biometricLock.unlockWith', { label })}</Text>
          )}
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}
