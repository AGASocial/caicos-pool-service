import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, useColorScheme, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';

export default function PasswordSecurityScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

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

    // Re-authenticate with current password first
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
        checkmark: { fontSize: 16, color: c.success ?? '#16A34A' },
      }),
    [c]
  );

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        {/* Change Password */}
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
                <Text style={styles.successText}>Password updated successfully.</Text>
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
          onPress={handleChangePassword}
          disabled={saving}
        >
          {saving && <ActivityIndicator color={c.buttonPrimaryText} size="small" />}
          <Text style={styles.saveBtnText}>{saving ? 'Updating...' : 'Update Password'}</Text>
        </Pressable>

        {/* Security Info */}
        <View style={styles.sectionCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>🔒</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Two-Factor Authentication</Text>
              <Text style={styles.infoDesc}>Managed through your account email. Contact your administrator to enable.</Text>
            </View>
          </View>
          <View style={[styles.infoRow, styles.infoRowLast]}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>✓</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Secure Session</Text>
              <Text style={styles.infoDesc}>Your session is encrypted and secured with Supabase Auth.</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
