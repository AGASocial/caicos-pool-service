import { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, useColorScheme } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
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
        headerArea: { paddingTop: 32, paddingBottom: 16, paddingHorizontal: 24, alignItems: 'center' },
        title: { fontSize: 24, fontWeight: '700', color: c.text, letterSpacing: -0.5, textAlign: 'center' },
        subtitle: { fontSize: 14, color: c.muted, marginTop: 8, fontWeight: '500', textAlign: 'center' },
        form: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 8, gap: 16 },
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
        hint: { fontSize: 14, color: c.muted, paddingHorizontal: 4 },
        error: { color: c.error, fontSize: 14, paddingHorizontal: 4 },
        button: {
          backgroundColor: c.buttonPrimary,
          borderRadius: 12,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 12,
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
        <View style={styles.headerArea}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join your pool service team in Caicos</Text>
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
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={c.placeholder}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          {isInvite && <Text style={styles.hint}>Joining as {invitePayload?.role ?? 'technician'}</Text>}
          <View>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Min. 6 characters"
              placeholderTextColor={c.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
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
            />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={styles.button} onPress={handleSignUp} disabled={loading}>
            {loading ? <ActivityIndicator color={c.buttonPrimaryText} /> : <Text style={styles.buttonText}>CREATE ACCOUNT</Text>}
          </Pressable>
        </View>
        <View style={styles.footer}>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text style={styles.footerText}>
                Already have an account?<Text style={styles.footerLink}> Sign in</Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}
