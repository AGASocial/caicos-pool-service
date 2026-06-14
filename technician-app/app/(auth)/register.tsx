import { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';
import { LegalFooter } from '@/components/LegalFooter';

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const initialCode = typeof params.code === 'string' ? params.code.trim() : '';
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [invitePayload, setInvitePayload] = useState<{ company_id: string; role: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [validatingInvite, setValidatingInvite] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  const validateInviteCode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setInvitePayload(null);
      setInviteError(null);
      return;
    }

    setValidatingInvite(true);
    setInviteError(null);
    const { data, error: rpcError } = await supabase.rpc('get_invite_code_payload', { code_input: trimmed });
    setValidatingInvite(false);

    if (rpcError || !data?.length) {
      setInvitePayload(null);
      setInviteError('Invalid or expired invite code. Ask your administrator for a new invite link.');
      return;
    }

    setInvitePayload(data[0] as { company_id: string; role: string });
  }, []);

  useEffect(() => {
    if (initialCode) {
      void validateInviteCode(initialCode);
    }
  }, [initialCode, validateInviteCode]);

  const isInviteValid = !!invitePayload;

  async function handleSignUp() {
    setError(null);

    if (!isInviteValid || !invitePayload) {
      setError('A valid company invite code is required.');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setLoading(true);
    const meta = {
      full_name: fullName,
      company_id: invitePayload.company_id,
      role: invitePayload.role,
    };
    const { error: err } = await supabase.auth.signUp({ email, password, options: { data: meta } });
    if (!err && inviteCode.trim()) {
      await supabase.rpc('mark_invite_code_used', { code_input: inviteCode.trim() });
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
        scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 24 },
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
        },
        headerArea: { alignItems: 'center', marginBottom: 28 },
        title: { fontSize: 20, fontWeight: '700', color: c.text, letterSpacing: -0.5, textAlign: 'center' },
        subtitle: { fontSize: 13, color: c.muted, marginTop: 6, fontWeight: '500', textAlign: 'center', lineHeight: 18 },
        form: { gap: 16 },
        fieldLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: c.text,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
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
        inviteRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
        inviteInput: { flex: 1 },
        validateBtn: {
          backgroundColor: c.inputBgAlt,
          borderRadius: 12,
          paddingHorizontal: 16,
          height: 48,
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: c.border,
        },
        validateBtnText: { color: c.tint, fontWeight: '600', fontSize: 14 },
        hint: { fontSize: 12, color: c.success ?? '#3E7D5A', paddingHorizontal: 4, fontWeight: '500' },
        inviteError: { fontSize: 12, color: c.error, paddingHorizontal: 4, fontWeight: '500', lineHeight: 18 },
        error: { color: c.error, fontSize: 13, paddingHorizontal: 4, fontWeight: '500' },
        termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
        checkbox: {
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: c.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        },
        checkboxChecked: { backgroundColor: c.tint, borderColor: c.tint },
        checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
        termsText: { flex: 1, fontSize: 13, color: c.muted, lineHeight: 18 },
        button: {
          backgroundColor: '#C7A85F',
          borderRadius: 12,
          height: 52,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 8,
          shadowColor: '#C7A85F',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 6,
        },
        buttonDisabled: { opacity: 0.6 },
        buttonText: { color: '#1a1407', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
        divider: { height: 1, backgroundColor: c.border, marginVertical: 20 },
        footerText: { fontSize: 14, color: c.muted, textAlign: 'center' },
        footerLink: { fontWeight: '700', color: c.link },
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
          <Text style={styles.headerSubtitle}>Create Your Account</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.headerArea}>
            <Text style={styles.title}>Join Your Team</Text>
            <Text style={styles.subtitle}>
              Registration requires an invite from your company administrator. Open your invite link or enter the code
              below.
            </Text>
          </View>

          <View style={styles.form}>
            <View>
              <Text style={styles.fieldLabel}>Invite Code</Text>
              <View style={styles.inviteRow}>
                <TextInput
                  style={[styles.input, styles.inviteInput]}
                  placeholder="Paste invite code"
                  placeholderTextColor={c.placeholder}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading && !validatingInvite}
                />
                <Pressable
                  style={styles.validateBtn}
                  onPress={() => void validateInviteCode(inviteCode)}
                  disabled={validatingInvite || !inviteCode.trim()}
                >
                  {validatingInvite ? (
                    <ActivityIndicator color={c.tint} size="small" />
                  ) : (
                    <Text style={styles.validateBtnText}>Verify</Text>
                  )}
                </Pressable>
              </View>
              {isInviteValid && (
                <Text style={styles.hint}>✓ Joining as {invitePayload?.role ?? 'technician'}</Text>
              )}
              {inviteError && <Text style={styles.inviteError}>{inviteError}</Text>}
            </View>

            {isInviteValid && (
              <>
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
                    placeholder="you@cadenzaops.com"
                    placeholderTextColor={c.placeholder}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
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

                <Pressable style={styles.termsRow} onPress={() => setAcceptedTerms((v) => !v)}>
                  <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                    {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.termsText}>
                    I agree to the Terms of Service and Privacy Policy (linked below).
                  </Text>
                </Pressable>
              </>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            {isInviteValid && (
              <Pressable
                style={[styles.button, (loading || !acceptedTerms) && styles.buttonDisabled]}
                onPress={() => void handleSignUp()}
                disabled={loading || !acceptedTerms}
              >
                {loading ? (
                  <ActivityIndicator color="#1a1407" size="small" />
                ) : (
                  <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
                )}
              </Pressable>
            )}
          </View>

          <View style={styles.divider} />

          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text style={styles.footerText}>
                Already have an account? <Text style={styles.footerLink}>Sign in</Text>
              </Text>
            </Pressable>
          </Link>
        </View>

        <LegalFooter compact />
      </ScrollView>
    </LinearGradient>
  );
}
