import { useState, useMemo } from 'react';
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
  Platform,
  Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';
import { LegalFooter } from '@/components/LegalFooter';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  async function handleReset() {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Email required', 'Enter the email address for your account.');
      return;
    }

    setLoading(true);
    const redirectTo = Linking.createURL('/(auth)/login');
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
    setLoading(false);

    if (error) {
      Alert.alert('Could not send reset email', error.message);
      return;
    }

    setSent(true);
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 48 },
        headerSection: { alignItems: 'center', marginBottom: 32 },
        logo: { width: 100, height: 100, marginBottom: 16 },
        brandName: {
          fontSize: 30,
          fontWeight: '500',
          color: '#F3EEE4',
          marginBottom: 10,
          letterSpacing: 0.3,
          fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
        },
        brassRule: { width: 54, height: 2, backgroundColor: '#C7A85F', borderRadius: 2, marginBottom: 10 },
        headerSubtitle: { fontSize: 14, color: 'rgba(243, 238, 228, 0.78)', fontWeight: '500' },
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
          marginHorizontal: 16,
        },
        title: { fontSize: 20, fontWeight: '700', color: c.text, textAlign: 'center', marginBottom: 8 },
        subtitle: { fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
        fieldLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: c.text,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
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
        button: {
          backgroundColor: '#C7A85F',
          borderRadius: 12,
          height: 56,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 20,
        },
        buttonDisabled: { opacity: 0.6 },
        buttonText: { color: '#1a1407', fontWeight: '700', fontSize: 16 },
        success: { fontSize: 14, color: c.success ?? '#3E7D5A', textAlign: 'center', lineHeight: 20 },
        backLink: { fontSize: 14, color: c.muted, textAlign: 'center', marginTop: 20 },
        backLinkBold: { fontWeight: '700', color: c.link },
      }),
    [c]
  );

  return (
    <LinearGradient colors={['#15191F', '#0F1419']} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.headerSection}>
          <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
          <Text style={styles.brandName}>Cadenza</Text>
          <View style={styles.brassRule} />
          <Text style={styles.headerSubtitle}>Reset Password</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Forgot your password?</Text>
          <Text style={styles.subtitle}>
            Enter your account email and we&apos;ll send a link to reset your password.
          </Text>

          {sent ? (
            <Text style={styles.success}>
              If an account exists for {email.trim()}, you will receive a reset link shortly. Check your inbox and spam
              folder.
            </Text>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="technician@cadenzaops.com"
                placeholderTextColor={c.placeholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
              <Pressable
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={() => void handleReset()}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1a1407" size="small" />
                ) : (
                  <Text style={styles.buttonText}>SEND RESET LINK</Text>
                )}
              </Pressable>
            </>
          )}

          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text style={styles.backLink}>
                Back to <Text style={styles.backLinkBold}>Sign in</Text>
              </Text>
            </Pressable>
          </Link>
        </View>

        <LegalFooter compact />
      </ScrollView>
    </LinearGradient>
  );
}
