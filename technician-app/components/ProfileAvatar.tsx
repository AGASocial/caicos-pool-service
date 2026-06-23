import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/Colors';
import { useI18n } from '@/lib/i18n';
import {
  getProfileAvatarSignedUrl,
  removeProfileAvatar,
  uploadProfileAvatar,
} from '@/lib/profileAvatar';

type Props = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  size?: number;
  editable?: boolean;
  onAvatarChange?: (storagePath: string | null) => void;
};

function initialsFromName(fullName: string, fallback: string): string {
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return initials || fallback;
}

export function ProfileAvatar({
  userId,
  fullName,
  avatarUrl,
  size = 128,
  editable = false,
  onAvatarChange,
}: Props) {
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];
  const { t } = useI18n();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getProfileAvatarSignedUrl(avatarUrl).then((uri) => {
      if (!cancelled) setImageUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  const applyPhoto = useCallback(
    async (localUri: string) => {
      setBusy(true);
      try {
        const path = await uploadProfileAvatar(userId, localUri);
        const signed = await getProfileAvatarSignedUrl(path);
        setImageUri(signed);
        onAvatarChange?.(path);
      } catch {
        Alert.alert(t('common.error'), t('settings.photoUploadFailed'));
      } finally {
        setBusy(false);
      }
    },
    [userId, onAvatarChange, t]
  );

  const pickFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('jobDetail.permissionNeeded'), t('jobDetail.cameraPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      await applyPhoto(result.assets[0].uri);
    }
  }, [applyPhoto, t]);

  const pickFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('jobDetail.permissionNeeded'), t('jobDetail.galleryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      await applyPhoto(result.assets[0].uri);
    }
  }, [applyPhoto, t]);

  const confirmRemove = useCallback(() => {
    Alert.alert(t('settings.removePhotoTitle'), t('settings.removePhotoMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.removePhoto'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await removeProfileAvatar(userId);
              setImageUri(null);
              onAvatarChange?.(null);
            } catch {
              Alert.alert(t('common.error'), t('settings.photoRemoveFailed'));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }, [userId, onAvatarChange, t]);

  const openPicker = useCallback(() => {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: t('settings.takePhoto'), onPress: () => void pickFromCamera() },
      { text: t('settings.chooseFromLibrary'), onPress: () => void pickFromLibrary() },
    ];
    if (avatarUrl) {
      options.push({
        text: t('settings.removePhoto'),
        style: 'destructive',
        onPress: confirmRemove,
      });
    }
    options.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(t('settings.profilePhoto'), t('settings.profilePhotoHint'), options);
  }, [avatarUrl, confirmRemove, pickFromCamera, pickFromLibrary, t]);

  const borderRadius = size / 2;
  const editBtnSize = Math.max(32, Math.round(size * 0.28));
  const initials = initialsFromName(fullName, 'T');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        outer: {
          position: 'relative',
          width: size,
          height: size,
        },
        avatar: {
          width: size,
          height: size,
          borderRadius,
          borderWidth: 4,
          borderColor: c.card,
          backgroundColor: c.progressBarBg,
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        },
        image: {
          width: size,
          height: size,
        },
        initials: {
          fontSize: size * 0.31,
          fontWeight: '700',
          color: c.muted,
          letterSpacing: -0.8,
        },
        editBtn: {
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: editBtnSize,
          height: editBtnSize,
          borderRadius: editBtnSize / 2,
          backgroundColor: c.tint,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: c.card,
        },
        editIcon: { color: '#fff', fontSize: editBtnSize * 0.44, fontWeight: '600' },
        busyOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius,
        },
      }),
    [c, size, borderRadius, editBtnSize]
  );

  const avatarContent = (
    <View style={styles.avatar}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} />
      ) : (
        <Text style={styles.initials}>{initials}</Text>
      )}
      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.outer}>
      {editable ? (
        <Pressable onPress={openPicker} disabled={busy} accessibilityRole="button">
          {avatarContent}
        </Pressable>
      ) : (
        avatarContent
      )}
      {editable && (
        <Pressable style={styles.editBtn} onPress={openPicker} disabled={busy} hitSlop={8}>
          <Text style={styles.editIcon}>+</Text>
        </Pressable>
      )}
    </View>
  );
}
