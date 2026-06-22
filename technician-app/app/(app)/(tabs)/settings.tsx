import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { disableBiometricLogin } from '@/lib/biometric-auth';
import { LegalFooter } from '@/components/LegalFooter';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { getLocaleDisplayName } from '@/components/LanguageSelector';
import { useI18n } from '@/lib/i18n';

export default function SettingsScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { colors: c } = useAppColors();
  const { t, locale } = useI18n();

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setEmail(user.email ?? '');
    setUserId(user.id);
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

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  async function handleSignOut() {
    await disableBiometricLogin();
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: c.background },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
        profileHeader: {
          alignItems: 'center',
          paddingVertical: 24,
          paddingHorizontal: 16,
        },
        avatarOuter: {
          position: 'relative',
          marginBottom: 16,
          alignItems: 'center',
        },
        name: {
          fontSize: 24,
          fontWeight: '700',
          color: c.text,
          letterSpacing: -0.5,
          marginBottom: 4,
        },
        emailText: {
          fontSize: 14,
          color: c.muted,
        },
        roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
        roleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.mutedSecondary },
        roleChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 9999,
          backgroundColor: c.badgeBg,
        },
        roleChipText: { fontSize: 12, fontWeight: '600', color: c.tint },
        content: {
          flex: 1,
          paddingHorizontal: 16,
          gap: 16,
          paddingBottom: 24,
        },
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
        menuItem: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: c.borderSubtle,
        },
        menuItemLast: { borderBottomWidth: 0 },
        menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
        menuIcon: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: c.sectionIconBlueBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        menuIconText: { fontSize: 16, color: c.tint },
        menuLabel: { fontSize: 16, fontWeight: '500', color: c.text },
        menuValue: { fontSize: 14, fontWeight: '500', color: c.muted, flexShrink: 1 },
        menuChevron: { fontSize: 20, color: c.mutedSecondary },
        menuRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, maxWidth: '45%' },
        actions: { gap: 12, marginTop: 8 },
        logoutBtn: {
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          borderWidth: 1,
          borderColor: c.buttonOutline,
        },
        logoutBtnText: { color: c.buttonOutlineText, fontWeight: '600', fontSize: 16 },
        footer: { paddingVertical: 24, alignItems: 'center' },
        footerText: { fontSize: 12, color: c.mutedSecondary, textAlign: 'center' },
      }),
    [c]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.text }}>{t('common.loading')}</Text>
      </View>
    );
  }

  const profileSummary = fullName.trim() || t('common.technician');

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarOuter}>
          {userId ? (
            <ProfileAvatar
              userId={userId}
              fullName={fullName}
              avatarUrl={avatarUrl}
              size={128}
            />
          ) : null}
        </View>
        <Text style={styles.name}>{fullName || t('common.technician')}</Text>
        <Text style={styles.emailText}>{email || t('common.signedIn')}</Text>
        <View style={styles.roleRow}>
          <Text style={styles.emailText}>{t('common.technician')}</Text>
          <View style={styles.roleDot} />
          <View style={styles.roleChip}>
            <Text style={styles.roleChipText}>{t('common.active')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionCard}>
          <Pressable style={styles.menuItem} onPress={() => router.push('/(app)/personal-information')}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIcon}>
                <Text style={styles.menuIconText}>P</Text>
              </View>
              <Text style={styles.menuLabel}>{t('settings.personalInformation')}</Text>
            </View>
            <View style={styles.menuRight}>
              <Text style={styles.menuValue} numberOfLines={1}>
                {profileSummary}
              </Text>
              <Text style={styles.menuChevron}>{'>'}</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/(app)/password-security')}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIcon}>
                <Text style={styles.menuIconText}>S</Text>
              </View>
              <Text style={styles.menuLabel}>{t('settings.passwordSecurity')}</Text>
            </View>
            <Text style={styles.menuChevron}>{'>'}</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => router.push('/(app)/language')}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIcon}>
                <Text style={styles.menuIconText}>L</Text>
              </View>
              <Text style={styles.menuLabel}>{t('settings.language')}</Text>
            </View>
            <View style={styles.menuRight}>
              <Text style={styles.menuValue}>{getLocaleDisplayName(locale)}</Text>
              <Text style={styles.menuChevron}>{'>'}</Text>
            </View>
          </Pressable>
          <Pressable style={[styles.menuItem, styles.menuItemLast]} onPress={() => router.push('/(app)/notifications')}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIcon}>
                <Text style={styles.menuIconText}>N</Text>
              </View>
              <Text style={styles.menuLabel}>{t('settings.notifications')}</Text>
            </View>
            <Text style={styles.menuChevron}>{'>'}</Text>
          </Pressable>
          
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.logoutBtn} onPress={handleSignOut}>
            <Text style={styles.logoutBtnText}>{t('settings.logout')}</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('common.appVersion')}</Text>
          <LegalFooter compact />
        </View>
      </View>
    </ScrollView>
  );
}
