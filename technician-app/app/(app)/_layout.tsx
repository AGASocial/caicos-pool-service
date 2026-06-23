import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { BiometricLockOverlay } from '@/components/BiometricLockOverlay';
import { useAppColors } from '@/lib/theme';
import { isBiometricLoginEnabled } from '@/lib/biometric-auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function AppLayout() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useAppColors();
  const [isLocked, setIsLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const appState = useRef(AppState.currentState);

  const refreshBiometricSetting = useCallback(() => {
    void isBiometricLoginEnabled().then(setBiometricEnabled);
  }, []);

  useEffect(() => {
    refreshBiometricSetting();
  }, [refreshBiometricSetting]);

  useFocusEffect(
    useCallback(() => {
      refreshBiometricSetting();
    }, [refreshBiometricSetting])
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIsLocked(false);
        router.replace('/(auth)/login');
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appState.current;

      if (
        previousState === 'active' &&
        (nextState === 'background' || nextState === 'inactive') &&
        biometricEnabled
      ) {
        setIsLocked(true);
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [biometricEnabled]);

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={({ route }) => {
          const isJobRoute = route.name?.startsWith('job') ?? false;
          return {
            headerShown: isJobRoute,
            headerBackTitle: t('common.back'),
            headerStyle: { backgroundColor: colors.headerBg },
            headerBackground: () => <View style={{ flex: 1, backgroundColor: colors.headerBg }} />,
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text, fontWeight: '600' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
            ...(isJobRoute && route.name === 'job/[id]/cant-service'
              ? { title: t('nav.cantService') }
              : isJobRoute
                ? { title: t('nav.job') }
                : {}),
          };
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen
          name="personal-information"
          options={{
            headerShown: true,
            title: t('settings.personalInformation'),
            headerBackTitle: t('nav.settings'),
          }}
        />
        <Stack.Screen
          name="language"
          options={{
            headerShown: true,
            title: t('settings.language'),
            headerBackTitle: t('nav.settings'),
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: true,
            title: t('nav.notifications'),
            headerBackTitle: t('nav.settings'),
          }}
        />
        <Stack.Screen
          name="password-security"
          options={{
            headerShown: true,
            title: t('nav.passwordSecurity'),
            headerBackTitle: t('nav.settings'),
          }}
        />
      </Stack>

      {biometricEnabled && (
        <BiometricLockOverlay visible={isLocked} onUnlock={() => setIsLocked(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
