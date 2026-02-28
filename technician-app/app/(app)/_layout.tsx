import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AppLayout() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/(auth)/login');
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return (
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
    </Stack>
  );
}
