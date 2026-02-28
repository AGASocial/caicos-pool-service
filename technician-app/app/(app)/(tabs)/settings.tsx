import { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';

export default function SettingsScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email ?? '');
        supabase.from('caicos_profiles').select('full_name').eq('id', user.id).single().then(({ data }) => {
          setFullName((data?.full_name as string) ?? '');
        });
      }
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    await supabase.from('caicos_profiles').update({ full_name: fullName }).eq('id', user.id);
    setSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, padding: 16, backgroundColor: c.background },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
        title: { fontSize: 18, fontWeight: '600', marginBottom: 16, color: c.text },
        label: { fontSize: 14, fontWeight: '500', marginTop: 12, color: c.text },
        input: {
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 8,
          padding: 12,
          marginTop: 4,
          backgroundColor: c.inputBg,
          color: c.text,
        },
        inputDisabled: { backgroundColor: c.inputBgDisabled },
        button: { backgroundColor: c.buttonPrimary, borderRadius: 8, padding: 14, marginTop: 24, alignItems: 'center' },
        buttonText: { color: c.buttonPrimaryText, fontWeight: '600' },
        logoutButton: { marginTop: 16, alignItems: 'center' },
        logoutText: { color: c.muted },
      }),
    [c]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.text }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.label}>Full name</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={c.placeholder}
        value={fullName}
        onChangeText={setFullName}
      />
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={[styles.input, styles.inputDisabled]}
        placeholderTextColor={c.placeholder}
        value={email}
        editable={false}
      />
      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
      </Pressable>
      <Pressable style={styles.logoutButton} onPress={handleSignOut}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}
