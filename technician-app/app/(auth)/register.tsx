import { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, useColorScheme, Image, ScrollView } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const code = params.code;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [invitePayload, setInvitePayload] = useState<{ company_id: string; role: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  useEffect(() => {
    if (!code) return;
    supabase.rpc('get_invite_code_payload', { code_input: code }).then(({ data }) => {
      if (data?.length) setInvitePayload(data[0] as { company_id: string; role: string });
    });
  }, [code]);

  const isInvite = !!invitePayload;

  async function handleSignUp() {
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const meta = isInvite && invitePayload
      ? { full_name: fullName, company_id: invitePayload.company_id, role: invitePayload.role }
      : { full_name: fullName, company_name: 'My Company' };
    const { error: err } = await supabase.auth.signUp({ email, password, options: { data: meta } });
    if (!err && isInvite && code) {
      await supabase.rpc('mark_invite_code_used', { code_input: code });
    }
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
        container: { flex: 1 },
        gradient: { flex: 1 },
        scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 24 },
        headerSection: { alignItems: 'center', marginBottom: 32 },
        logo: { width: 100, height: 100, marginBottom: 16 },
        brandName: { fontSize: 28, fontWeight: '800', color: '#00D9FF', marginBottom: 4, letterSpacing: -0.5 },
        headerSubtitle: { fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' },
        card: {
          borderRadius: 20,
          backgroundColor: c.card,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
          elevation: 8,
          paddingHorizontal: 24,
          paddingTop: 28,
          paddingBottom: 20,
        },
        headerArea: { alignItems: 'center', marginBottom: 28 },
        title: { fontSize: 20, fontWeight: '700', color: c.text, letterSpacing: -0.5, textAlign: 'center' },
        subtitle: { fontSize: 13, color: c.muted, marginTop: 6, fontWeight: '500', textAlign: 'center' },
        form: { gap: 16 },
        fieldLabel: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
        input: {
          borderWidth: 1.5,
          borderColor: c.border,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          height: 48,
          backgroundColor: c.inputBg,
          color: c.text,
          fontSize: 16,
          fontWeight: '500',
        },
        hint: { fontSize: 12, color: c.muted, paddingHorizontal: 4, fontWeight: '500', marginTop: -12, marginBottom: 4 },
        error: { color: c.error, fontSize: 13, paddingHorizontal: 4, fontWeight: '500', marginTop: -12 },
        button: {
          backgroundColor: '#00D9FF',
          borderRadius: 12,
          height: 52,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 8,
          shadowColor: '#00D9FF',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 6,
        },
        buttonDisabled: { opacity: 0.6 },
        buttonText: { color: '#ffffff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
        divider: { height: 1, backgroundColor: c.border, marginVertical: 20 },
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
          <Text style={styles.brandName}>Neura Pool</Text>
          <Text style={styles.headerSubtitle}>Create Your Account</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.headerArea}>
            <Text style={styles.title}>Get Started</Text>
            <Text style={styles.subtitle}>Join your pool service team</Text>
          </View>

          <View style={styles.form}>
            <View>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your full name"
                placeholderTextColor={c.placeholder}
                value={fullName}
                onChangeText={setFullName}
                editable={!loading}
              />
            </View>

            <View>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@neurapool.com"
                placeholderTextColor={c.placeholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            {isInvite && (
              <Text style={styles.hint}>
                ✓ Joining as {invitePayload?.role ?? 'technician'}
              </Text>
            )}

            <View>
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Min. 6 characters"
                placeholderTextColor={c.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <View>
              <Text style={styles.fieldLabel}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                placeholderTextColor={c.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            {error && <Text style={styles.error}>❌ {error}</Text>}

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text style={styles.footerText}>
                Already have an account?{' '}
                <Text style={styles.footerLink}>Sign in</Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
