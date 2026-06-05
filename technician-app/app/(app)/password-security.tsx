import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';
import {
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricCapability,
  isBiometricLoginEnabled,
} from '@/lib/biometric-auth';

export default function PasswordSecurityScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Face ID');
  const [biometricUpdating, setBiometricUpdating] = useState(false);
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  const loadBiometricSettings = useCallback(async () => {
    const [{ available, label }, enabled] = await Promise.all([
      getBiometricCapability(),
      isBiometricLoginEnabled(),
    ]);
    setBiometricAvailable(available);
    setBiometricLabel(label);
    setBiometricEnabled(enabled);
  }, []);

  useEffect(() => {
    void loadBiometricSettings();
  }, [loadBiometricSettings]);

  async function handleBiometricToggle(nextValue: boolean) {
    if (biometricUpdating) return;

    setBiometricUpdating(true);

    if (nextValue) {
      const result = await enableBiometricLogin();
      setBiometricUpdating(false);

      if (!result.ok) {
        Alert.alert('Could not enable', result.error);
        return;
      }

      setBiometricEnabled(true);
      return;
    }

    await disableBiometricLogin();
    setBiometricUpdating(false);
    setBiometricEnabled(false);
  }

  async function handleChangePassword() {
    setError(null);
    setSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      setError('Unable to verify current session.');
      setSaving(false);
      return;
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInErr) {
      setError('Current password is incorrect.');
      setSaving(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });

    setSaving(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    await disableBiometricLogin();
    setBiometricEnabled(false);
    setSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: c.background },
        content: { flex: 1, paddingHorizontal: 16, paddingTop: 16, gap: 16, paddingBottom: 32 },
        sectionCard: {
          backgroundColor: c.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
        sectionHeader: {
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: c.borderSubtle,
        },
        sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text },
        sectionBody: { padding: 20, gap: 20 },
        fieldGroup: { gap: 6 },
        label: { fontSize: 14, fontWeight: '500', color: c.muted },
        input: {
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 8,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: c.inputBgAlt,
          color: c.text,
          fontSize: 16,
        },
        hint: { fontSize: 12, color: c.mutedSecondary, marginTop: 2 },
        error: {
          backgroundColor: c.errorBg ?? '#FEE2E2',
          borderRadius: 8,
          paddingHorizontal: 14,
          paddingVertical: 10,
        },
        errorText: { fontSize: 14, color: c.error ?? '#DC2626', fontWeight: '500' },
        success: {
          backgroundColor: c.successBg ?? '#DCFCE7',
          borderRadius: 8,
          paddingHorizontal: 14,
          paddingVertical: 10,
        },
        successText: { fontSize: 14, color: c.success ?? '#16A34A', fontWeight: '500' },
        saveBtn: {
          backgroundColor: c.buttonPrimary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          shadowColor: c.buttonPrimaryShadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 4,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
        },
        saveBtnDisabled: { opacity: 0.6 },
        saveBtnText: { color: c.buttonPrimaryText, fontWeight: '600', fontSize: 16 },
        infoRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: c.borderSubtle,
        },
        infoRowLast: { borderBottomWidth: 0 },
        infoIcon: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: c.sectionIconBlueBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        infoIconText: { fontSize: 16, color: c.tint },
        infoContent: { flex: 1, gap: 2 },
        infoLabel: { fontSize: 14, fontWeight: '600', color: c.text },
        infoDesc: { fontSize: 13, color: c.muted, lineHeight: 18 },
        toggleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 16,
        },
        toggleText: { flex: 1, gap: 4 },
      }),
    [c]
  );

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        {biometricAvailable && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Biometric Sign-In</Text>
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.infoLabel}>{biometricLabel}</Text>
                <Text style={styles.infoDesc}>
                  Sign in faster and lock the app when you switch away from Neura Pool.
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={(value) => void handleBiometricToggle(value)}
                disabled={biometricUpdating}
                trackColor={{ false: c.border, true: c.tint }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Change Password</Text>
          </View>
          <View style={styles.sectionBody}>
            {error && (
              <View style={styles.error}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {success && (
              <View style={styles.success}>
                <Text style={styles.successText}>
                  Password updated successfully. Re-enable {biometricLabel} if you want biometric sign-in again.
                </Text>
              </View>
            )}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Current Password</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor={c.placeholder}
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!saving}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor={c.placeholder}
                placeholder="At least 8 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!saving}
              />
              <Text style={styles.hint}>Minimum 8 characters</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor={c.placeholder}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!saving}
              />
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={() => void handleChangePassword()}
          disabled={saving}
        >
          {saving && <ActivityIndicator color={c.buttonPrimaryText} size="small" />}
          <Text style={styles.saveBtnText}>{saving ? 'Updating...' : 'Update Password'}</Text>
        </Pressable>

        <View style={styles.sectionCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>🔒</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Two-Factor Authentication</Text>
              <Text style={styles.infoDesc}>
                Managed through your account email. Contact your administrator to enable.
              </Text>
            </View>
          </View>
          <View style={[styles.infoRow, styles.infoRowLast]}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>✓</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Secure Session</Text>
              <Text style={styles.infoDesc}>
                Your session is encrypted and secured with Supabase Auth.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
