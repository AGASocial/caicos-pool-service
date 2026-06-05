import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { BiometricLockOverlay } from '@/components/BiometricLockOverlay';
import { isBiometricLoginEnabled } from '@/lib/biometric-auth';
import { supabase } from '@/lib/supabase';

export default function AppLayout() {
  const router = useRouter();
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
            headerBackTitle: 'Back',
            ...(isJobRoute && route.name === 'job/[id]/cant-service'
              ? { title: "Can't service" }
              : isJobRoute
                ? { title: 'Job' }
                : {}),
          };
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen
          name="notifications"
          options={{ headerShown: true, title: 'Notifications', headerBackTitle: 'Settings' }}
        />
        <Stack.Screen
          name="password-security"
          options={{ headerShown: true, title: 'Password & Security', headerBackTitle: 'Settings' }}
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
