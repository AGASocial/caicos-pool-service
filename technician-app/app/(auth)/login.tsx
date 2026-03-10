import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, useColorScheme } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace('/(app)/(tabs)');
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: c.background },
        card: {
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1,
        },
        logoRow: { alignItems: 'center', paddingTop: 32, paddingBottom: 16, paddingHorizontal: 24 },
        logoBadge: {
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: c.badgeBg,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        },
        logoBadgeText: { color: c.tint, fontWeight: '700', fontSize: 28, letterSpacing: -0.5 },
        title: { fontSize: 24, fontWeight: '700', textAlign: 'center', color: c.text, letterSpacing: -0.5 },
        subtitle: { fontSize: 14, color: c.muted, textAlign: 'center', marginTop: 8, fontWeight: '500' },
        form: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 8, gap: 20 },
        fieldLabel: { fontSize: 14, fontWeight: '500', color: c.text, marginBottom: 8 },
        input: {
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 12,
          paddingHorizontal: 16,
          height: 48,
          backgroundColor: c.inputBg,
          color: c.text,
          fontSize: 16,
        },
        error: { color: c.error, fontSize: 14 },
        button: {
          backgroundColor: c.buttonPrimary,
          borderRadius: 12,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 8,
          shadowColor: c.buttonPrimaryShadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 4,
        },
        buttonText: { color: c.buttonPrimaryText, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
        footer: {
          backgroundColor: c.background,
          borderTopWidth: 1,
          borderTopColor: c.border,
          paddingVertical: 16,
          alignItems: 'center',
        },
        footerText: { fontSize: 14, color: c.muted },
        footerLink: { fontWeight: '600', color: c.tint, marginLeft: 4 },
      }),
    [c]
  );

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>C</Text>
          </View>
          <Text style={styles.title}>Technician Sign In</Text>
          <Text style={styles.subtitle}>Welcome back to Caicos</Text>
        </View>
        <View style={styles.form}>
          <View>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="technician@caicos.com"
              placeholderTextColor={c.placeholder}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={c.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={styles.button} onPress={handleSignIn} disabled={loading}>
            {loading ? <ActivityIndicator color={c.buttonPrimaryText} /> : <Text style={styles.buttonText}>SIGN IN</Text>}
          </Pressable>
        </View>
        <View style={styles.footer}>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text style={styles.footerText}>
                Don&apos;t have an account?<Text style={styles.footerLink}> Create one</Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}
