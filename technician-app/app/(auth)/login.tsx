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
        container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: c.background },
        title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: c.text },
        subtitle: { fontSize: 14, color: c.muted, textAlign: 'center', marginTop: 4 },
        input: {
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 8,
          padding: 12,
          marginTop: 16,
          backgroundColor: c.inputBg,
          color: c.text,
        },
        error: { color: c.error, marginTop: 8, fontSize: 14 },
        button: { backgroundColor: c.buttonPrimary, borderRadius: 8, padding: 14, marginTop: 24, alignItems: 'center' },
        buttonText: { color: c.buttonPrimaryText, fontWeight: '600' },
        link: { color: c.link, marginTop: 16, textAlign: 'center' },
      }),
    [c]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CAICOS</Text>
      <Text style={styles.subtitle}>Technician app</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={c.placeholder}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={c.placeholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={handleSignIn} disabled={loading}>
        {loading ? <ActivityIndicator color={c.buttonPrimaryText} /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
      <Link href="/(auth)/register" asChild>
        <Pressable>
          <Text style={styles.link}>Don&apos;t have an account? Create one</Text>
        </Pressable>
      </Link>
    </View>
  );
}
