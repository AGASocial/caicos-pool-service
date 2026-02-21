import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <TextInput style={styles.input} placeholder="Full name" value={fullName} onChangeText={setFullName} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      {isInvite && <Text style={styles.hint}>Joining as {invitePayload?.role ?? 'technician'}</Text>}
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={handleSignUp} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register</Text>}
      </Pressable>
      <Link href="/(auth)/login" asChild>
        <Pressable>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginTop: 12 },
  hint: { fontSize: 14, color: '#666', marginTop: 8 },
  error: { color: 'red', marginTop: 8, fontSize: 14 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, marginTop: 24, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { color: '#2563eb', marginTop: 16, textAlign: 'center' },
});
