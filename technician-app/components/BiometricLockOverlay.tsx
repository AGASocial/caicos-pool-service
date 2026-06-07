import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  authenticateWithBiometrics,
  getBiometricCapability,
} from '@/lib/biometric-auth';
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

  const attemptUnlock = useCallback(
    async (biometricLabel: string) => {
      setUnlocking(true);
      setError(null);

      const success = await authenticateWithBiometrics(`Unlock Cadenza with ${biometricLabel}`);
      setUnlocking(false);

      if (success) {
        onUnlock();
        return;
      }

      setError(`${biometricLabel} verification was cancelled.`);
    },
    [onUnlock]
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
        title: { fontSize: 28, fontWeight: '800', color: '#00D9FF', marginBottom: 8 },
        subtitle: {
          fontSize: 16,
          color: 'rgba(255, 255, 255, 0.85)',
          textAlign: 'center',
          marginBottom: 32,
          lineHeight: 22,
        },
        button: {
          backgroundColor: '#00D9FF',
          borderRadius: 12,
          minWidth: 220,
          height: 52,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        },
        buttonDisabled: { opacity: 0.7 },
        buttonText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
        error: { color: c.error, fontSize: 14, marginTop: 16, textAlign: 'center' },
      }),
    [c.error]
  );

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <LinearGradient
        colors={['#0D7C8F', '#1A3A52']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
        <Text style={styles.title}>Cadenza</Text>
        <Text style={styles.subtitle}>App locked. Use {label} to continue.</Text>

        <Pressable
          style={[styles.button, unlocking && styles.buttonDisabled]}
          onPress={() => void attemptUnlock(label)}
          disabled={unlocking}
        >
          {unlocking ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Unlock with {label}</Text>
          )}
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}
