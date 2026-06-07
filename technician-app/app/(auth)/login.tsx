import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';
import {
  enableBiometricLogin,
  getBiometricCapability,
  getStoredBiometricEmail,
  hasStoredBiometricCredentials,
  isBiometricLoginEnabled,
  signInWithBiometrics,
} from '@/lib/biometric-auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBiometricSignIn, setShowBiometricSignIn] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Face ID');
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  const loadBiometricState = useCallback(async () => {
    const [{ available, label }, enabled, hasCredentials, storedEmail] = await Promise.all([
      getBiometricCapability(),
      isBiometricLoginEnabled(),
      hasStoredBiometricCredentials(),
      getStoredBiometricEmail(),
    ]);

    setBiometricLabel(label);
    setShowBiometricSignIn(available && enabled && hasCredentials);

    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  useEffect(() => {
    void loadBiometricState();
  }, [loadBiometricState]);

  async function promptEnableBiometric(label: string): Promise<void> {
    const alreadyEnabled = await isBiometricLoginEnabled();
    if (alreadyEnabled) return;

    const { available } = await getBiometricCapability();
    if (!available) return;

    await new Promise<void>((resolve) => {
      Alert.alert(
        `Enable ${label}?`,
        `Use ${label} to sign in faster and lock the app when you switch away.`,
        [
          { text: 'Not now', style: 'cancel', onPress: () => resolve() },
          {
            text: 'Enable',
            onPress: () => {
              void (async () => {
                const result = await enableBiometricLogin();
                if (!result.ok) {
                  Alert.alert('Could not enable', result.error);
                } else {
                  await loadBiometricState();
                }
                resolve();
              })();
            },
          },
        ],
        { cancelable: true, onDismiss: () => resolve() }
      );
    });
  }

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }

    await promptEnableBiometric(biometricLabel);
    router.replace('/(app)/(tabs)');
  }

  async function handleBiometricSignIn() {
    setBiometricLoading(true);
    setError(null);

    const result = await signInWithBiometrics();
    setBiometricLoading(false);

    if (!result.ok) {
      setError(result.error);
      if (result.error.includes('password')) {
        setShowBiometricSignIn(false);
        await loadBiometricState();
      }
      return;
    }

    router.replace('/(app)/(tabs)');
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        gradient: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
        scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 48 },
        headerSection: { alignItems: 'center', marginBottom: 40 },
        logo: { width: 120, height: 120, marginBottom: 24 },
        brandName: { fontSize: 32, fontWeight: '800', color: '#00D9FF', marginBottom: 8, letterSpacing: -1 },
        subtitle: { fontSize: 16, color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' },
        card: {
          borderRadius: 8,
          backgroundColor: c.card,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
          elevation: 8,
          marginHorizontal: 16,
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 24,
        },
        welcomeText: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 24, textAlign: 'center' },
        form: { gap: 18 },
        fieldWrapper: {},
        fieldLabel: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
        input: {
          borderWidth: 1.5,
          borderColor: c.border,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          height: 52,
          backgroundColor: c.inputBg,
          color: c.text,
          fontSize: 16,
          fontWeight: '500',
        },
        inputFocused: {
          borderColor: '#00D9FF',
          borderWidth: 2,
        },
        error: { color: c.error, fontSize: 13, marginTop: 6, fontWeight: '500' },
        button: {
          backgroundColor: '#00D9FF',
          borderRadius: 12,
          height: 56,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 12,
          shadowColor: '#00D9FF',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 6,
        },
        biometricButton: {
          backgroundColor: c.card,
          borderRadius: 12,
          height: 56,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: '#00D9FF',
        },
        buttonDisabled: { opacity: 0.6 },
        buttonText: { color: '#ffffff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
        biometricButtonText: { color: '#00D9FF', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
        divider: { height: 1, backgroundColor: c.border, marginVertical: 24 },
        footerText: { fontSize: 14, color: c.muted, textAlign: 'center' },
        footerLink: { fontWeight: '700', color: '#00D9FF' },
      }),
    [c]
  );

  return (
    <LinearGradient
      colors={['#0D7C8F', '#1A3A52']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.headerSection}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
          />
          <Text style={styles.brandName}>Cadenza</Text>
          <Text style={styles.subtitle}>Technician Portal</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.welcomeText}>Welcome Back, Technician</Text>

          <View style={styles.form}>
            {showBiometricSignIn && (
              <Pressable
                style={[styles.biometricButton, biometricLoading && styles.buttonDisabled]}
                onPress={() => void handleBiometricSignIn()}
                disabled={biometricLoading || loading}
              >
                {biometricLoading ? (
                  <ActivityIndicator color="#00D9FF" size="small" />
                ) : (
                  <Text style={styles.biometricButtonText}>Sign in with {biometricLabel}</Text>
                )}
              </Pressable>
            )}

            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="technician@cadenza.com"
                placeholderTextColor={c.placeholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading && !biometricLoading}
              />
            </View>

            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={c.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading && !biometricLoading}
              />
            </View>

            {error && <Text style={styles.error}>❌ {error}</Text>}

            <Pressable
              style={[styles.button, (loading || biometricLoading) && styles.buttonDisabled]}
              onPress={() => void handleSignIn()}
              disabled={loading || biometricLoading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.buttonText}>SIGN IN</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text style={styles.footerText}>
                Don't have an account?{' '}
                <Text style={styles.footerLink}>Create one</Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
