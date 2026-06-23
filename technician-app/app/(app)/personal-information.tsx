import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { useI18n } from '@/lib/i18n';
import Colors from '@/constants/Colors';

export default function PersonalInformationScreen() {
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];
  const { t } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);
    setEmail(user.email ?? '');
    const { data } = await supabase
      .from('cadenza_profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();
    setFullName((data?.full_name as string) ?? '');
    setAvatarUrl((data?.avatar_url as string | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    await supabase.from('cadenza_profiles').update({ full_name: fullName }).eq('id', userId);
    setSaving(false);
    router.back();
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: c.background },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
        content: { padding: 16, paddingBottom: 40, gap: 16 },
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
        avatarSection: { alignItems: 'center', gap: 8 },
        avatarHint: { fontSize: 13, color: c.muted, textAlign: 'center', lineHeight: 18 },
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
        inputDisabled: { backgroundColor: c.inputBgDisabled, color: c.mutedSecondary },
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
        },
        saveBtnText: { color: c.buttonPrimaryText, fontWeight: '600', fontSize: 16 },
      }),
    [c]
  );

  if (loading || !userId) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.text }}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('settings.personalInformation')}</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.avatarSection}>
              <ProfileAvatar
                userId={userId}
                fullName={fullName}
                avatarUrl={avatarUrl}
                editable
                onAvatarChange={setAvatarUrl}
              />
              <Text style={styles.avatarHint}>{t('settings.profilePhotoHint')}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('settings.fullName')}</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor={c.placeholder}
                value={fullName}
                onChangeText={setFullName}
                editable={!saving}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('settings.email')}</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                placeholderTextColor={c.placeholder}
                value={email}
                editable={false}
              />
            </View>
          </View>
        </View>

        <Pressable style={styles.saveBtn} onPress={() => void handleSave()} disabled={saving}>
          <Text style={styles.saveBtnText}>
            {saving ? t('common.saving') : t('common.savingChanges')}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
