import { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, useColorScheme } from 'react-native';
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
        },
        avatar: {
          width: 128,
          height: 128,
          borderRadius: 64,
          borderWidth: 4,
          borderColor: c.card,
          backgroundColor: c.progressBarBg,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        },
        avatarInitials: {
          fontSize: 40,
          fontWeight: '700',
          color: c.muted,
          letterSpacing: -0.8,
        },
        editAvatarBtn: {
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: c.tint,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: c.card,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.15,
          shadowRadius: 3,
          elevation: 2,
        },
        editAvatarIcon: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
        sectionHeader: {
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: c.borderSubtle,
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: c.text,
        },
        sectionBody: {
          padding: 20,
          gap: 20,
        },
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
        menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
        menuChevron: { fontSize: 20, color: c.mutedSecondary },
        actions: { gap: 12, marginTop: 8 },
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
        <Text style={{ color: c.text }}>Loading...</Text>
      </View>
    );
  }

  const initials =
    fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'T';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarOuter}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <View style={styles.editAvatarBtn}>
            <Text style={styles.editAvatarIcon}>E</Text>
          </View>
        </View>
        <Text style={styles.name}>{fullName || 'Technician'}</Text>
        <Text style={styles.emailText}>{email || 'Signed in'}</Text>
        <View style={styles.roleRow}>
          <Text style={styles.emailText}>Technician</Text>
          <View style={styles.roleDot} />
          <View style={styles.roleChip}>
            <Text style={styles.roleChipText}>Active</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor={c.placeholder}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                placeholderTextColor={c.placeholder}
                value={email}
                editable={false}
              />
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIcon}>
                <Text style={styles.menuIconText}>N</Text>
              </View>
              <Text style={styles.menuLabel}>Notifications</Text>
            </View>
            <Text style={styles.menuChevron}>{'>'}</Text>
          </Pressable>
          <Pressable style={[styles.menuItem, styles.menuItemLast]}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIcon}>
                <Text style={styles.menuIconText}>S</Text>
              </View>
              <Text style={styles.menuLabel}>Password & Security</Text>
            </View>
            <Text style={styles.menuChevron}>{'>'}</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </Pressable>
          <Pressable style={styles.logoutBtn} onPress={handleSignOut}>
            <Text style={styles.logoutBtnText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Caicos Technician App{'\n'}Version 1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}
