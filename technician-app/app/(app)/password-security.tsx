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
import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();

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
        Alert.alert(t('auth.couldNotEnable'), result.error);
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
      setError(t('passwordSecurity.allFieldsRequired'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('passwordSecurity.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordSecurity.passwordsDoNotMatch'));
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      setError(t('passwordSecurity.sessionVerifyFailed'));
      setSaving(false);
      return;
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInErr) {
      setError(t('passwordSecurity.currentPasswordIncorrect'));
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
          backgroundColor: c.errorBg ?? 'rgba(180, 69, 59, 0.10)',
          borderRadius: 8,
          paddingHorizontal: 14,
          paddingVertical: 10,
        },
        errorText: { fontSize: 14, color: c.error ?? '#B4453B', fontWeight: '500' },
        success: {
          backgroundColor: c.successBg ?? 'rgba(62, 125, 90, 0.12)',
          borderRadius: 8,
          paddingHorizontal: 14,
          paddingVertical: 10,
        },
        successText: { fontSize: 14, color: c.success ?? '#3E7D5A', fontWeight: '500' },
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
              <Text style={styles.sectionTitle}>{t('passwordSecurity.biometricSignIn')}</Text>
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.infoLabel}>{biometricLabel}</Text>
                <Text style={styles.infoDesc}>{t('passwordSecurity.biometricDesc')}</Text>
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
            <Text style={styles.sectionTitle}>{t('passwordSecurity.changePassword')}</Text>
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
                  {t('passwordSecurity.passwordUpdated', { label: biometricLabel })}
                </Text>
              </View>
            )}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('passwordSecurity.currentPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor={c.placeholder}
                placeholder={t('passwordSecurity.enterCurrentPassword')}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!saving}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('passwordSecurity.newPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor={c.placeholder}
                placeholder={t('passwordSecurity.atLeast8Chars')}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!saving}
              />
              <Text style={styles.hint}>{t('passwordSecurity.min8Chars')}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('passwordSecurity.confirmNewPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor={c.placeholder}
                placeholder={t('passwordSecurity.reEnterNewPassword')}
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
          <Text style={styles.saveBtnText}>
            {saving ? t('common.updating') : t('passwordSecurity.updatePassword')}
          </Text>
        </Pressable>

        <View style={styles.sectionCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>🔒</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{t('passwordSecurity.twoFactor')}</Text>
              <Text style={styles.infoDesc}>{t('passwordSecurity.twoFactorDesc')}</Text>
            </View>
          </View>
          <View style={[styles.infoRow, styles.infoRowLast]}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>✓</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{t('passwordSecurity.secureSession')}</Text>
              <Text style={styles.infoDesc}>{t('passwordSecurity.secureSessionDesc')}</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
