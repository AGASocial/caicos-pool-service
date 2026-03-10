import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, Alert, useColorScheme } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { getPhotoOverlayInfo, type PhotoOverlayInfo } from '@/lib/photoOverlay';
import { PhotoWithOverlay } from '@/components/PhotoWithOverlay';
import { getUploadBodyFromUri } from '@/lib/uploadPhoto';
import Colors from '@/constants/Colors';

export default function CantServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<{ company_id: string; property_id: string; scheduled_date?: string } | null>(null);
  const [pendingOverlay, setPendingOverlay] = useState<{
    uri: string;
    width: number;
    height: number;
    overlay: PhotoOverlayInfo;
  } | null>(null);
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];

  useEffect(() => {
    if (!id) return;
    supabase
      .from('caicos_service_jobs')
      .select('company_id, property_id, scheduled_date')
      .eq('id', id)
      .single()
      .then(({ data }) => setJob(data as { company_id: string; property_id: string; scheduled_date?: string } | null));
  }, [id]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: c.background },
        header: {
          padding: 20,
          backgroundColor: c.warningBg,
          borderBottomWidth: 1,
          borderBottomColor: c.warningBorder,
        },
        headerIconRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginBottom: 8,
        },
        headerIcon: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: c.warningText,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.15,
        },
        headerIconText: {
          fontSize: 18,
          color: c.warningText,
          fontWeight: '700',
        },
        title: { fontSize: 20, fontWeight: '700', color: c.warningText, letterSpacing: -0.5 },
        subtitle: { fontSize: 14, color: c.warningText, marginTop: 8, opacity: 0.9, lineHeight: 20 },
        content: { padding: 16, gap: 16 },
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
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: c.borderSubtle,
        },
        sectionIconAmber: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: c.sectionIconAmberBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sectionIconAmberText: { fontSize: 13, color: c.sectionIconAmberText, fontWeight: '600' },
        sectionIconPurple: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: c.sectionIconPurpleBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sectionIconPurpleText: { fontSize: 13, color: c.sectionIconPurpleText, fontWeight: '600' },
        sectionTitle: { fontSize: 15, fontWeight: '700', color: c.text },
        sectionBody: { padding: 16, gap: 12 },
        label: { fontSize: 13, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
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
        textArea: { minHeight: 100, textAlignVertical: 'top' },
        photoRow: { flexDirection: 'row', gap: 12 },
        photoButton: {
          flex: 1,
          height: 48,
          borderRadius: 8,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: c.border,
          backgroundColor: c.inputBgAlt,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
        },
        photoButtonText: { fontSize: 14, fontWeight: '600', color: c.muted },
        thumbs: { marginTop: 4 },
        thumbsContent: { gap: 10, paddingRight: 4 },
        thumbWrap: { position: 'relative' },
        thumb: { width: 90, height: 90, borderRadius: 8, backgroundColor: c.progressBarBg },
        removeThumb: {
          position: 'absolute',
          top: 4,
          right: 4,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: 'rgba(0,0,0,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        removeThumbText: { color: '#fff', fontSize: 16, lineHeight: 18, fontWeight: '600' },
        actions: { gap: 12, marginTop: 8 },
        closeButton: {
          backgroundColor: c.buttonDanger,
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: c.buttonDanger,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 4,
        },
        closeButtonText: { color: c.buttonDangerText, fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
        cancelButton: {
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: c.buttonOutline,
        },
        cancelButtonText: { color: c.buttonOutlineText, fontWeight: '600', fontSize: 16 },
      }),
    [c]
  );

  async function addPhotoFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.4, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const overlay = await getPhotoOverlayInfo();
      const w = asset.width ?? 1080;
      const h = asset.height ?? 1920;
      setPendingOverlay({ uri: asset.uri, width: w, height: h, overlay });
    }
  }

  async function addPhotoFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery permission is required to select photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.4,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri }))]);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCloseJob() {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setLoading(true);
    try {
      let jobData = job;
      if (!jobData) {
        const { data } = await supabase.from('caicos_service_jobs').select('company_id, property_id, scheduled_date').eq('id', id).single();
        jobData = data as typeof job;
      }
      if (!jobData) {
        Alert.alert('Error', 'Job not found.');
        return;
      }

      const report = {
        job_id: id,
        company_id: jobData.company_id,
        technician_id: user.id,
        notes: comment.trim() || 'Unable to service — no comment provided.',
      };
      const { data: reportRow, error: reportErr } = await supabase.from('caicos_service_reports').insert(report).select('id').single();
      if (reportErr) {
        Alert.alert('Error', reportErr.message ?? 'Failed to save report');
        return;
      }
      const reportId = reportRow.id;

      const { error: updateJobErr } = await supabase.from('caicos_service_jobs').update({ status: 'skipped' }).eq('id', id);
      if (updateJobErr) {
        Alert.alert('Error', updateJobErr.message ?? 'Failed to update job status');
        return;
      }

      const dateStr = jobData.scheduled_date != null ? String(jobData.scheduled_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
      let photoErrors = 0;
      for (const photo of photos) {
        try {
          const fileName = `${jobData.company_id}/${dateStr}/${jobData.property_id}/cant-service-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
          const body = await getUploadBodyFromUri(photo.uri);
          const { error: uploadErr } = await supabase.storage.from('report-photos').upload(fileName, body, { contentType: 'image/jpeg' });
          if (!uploadErr) {
            await supabase.from('caicos_report_photos').insert({
              report_id: reportId,
              company_id: jobData.company_id,
              storage_path: fileName,
              photo_type: 'issue',
            });
          } else {
            photoErrors += 1;
          }
        } catch {
          photoErrors += 1;
        }
      }

      if (photoErrors > 0) {
        Alert.alert('Job closed', `${photoErrors} photo(s) could not be uploaded. The report was saved.`);
      }
      router.replace('/(app)/(tabs)');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to close job');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Can't Service This Job</Text>
        <Text style={styles.subtitle}>
          Add a photo and/or comment explaining why, then close the job. The status will be set to "skipped".
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconAmber}>
              <Text style={styles.sectionIconAmberText}>!</Text>
            </View>
            <Text style={styles.sectionTitle}>Reason</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.label}>Comment (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={comment}
              onChangeText={setComment}
              placeholder="e.g. Gate locked, dog in yard, customer not home..."
              placeholderTextColor={c.placeholder}
              multiline
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconPurple}>
              <Text style={styles.sectionIconPurpleText}>P</Text>
            </View>
            <Text style={styles.sectionTitle}>Photos</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.photoRow}>
              <Pressable style={styles.photoButton} onPress={addPhotoFromCamera}>
                <Text style={styles.photoButtonText}>Camera</Text>
              </Pressable>
              <Pressable style={styles.photoButton} onPress={addPhotoFromGallery}>
                <Text style={styles.photoButtonText}>Gallery</Text>
              </Pressable>
            </View>
            {pendingOverlay != null && (
              <PhotoWithOverlay
                uri={pendingOverlay.uri}
                width={pendingOverlay.width}
                height={pendingOverlay.height}
                overlay={pendingOverlay.overlay}
                onCaptured={(uri) => {
                  setPhotos((prev) => [...prev, { uri }]);
                  setPendingOverlay(null);
                }}
                onError={() => {
                  setPhotos((prev) => [...prev, { uri: pendingOverlay.uri }]);
                  setPendingOverlay(null);
                }}
              />
            )}
            {photos.length > 0 && (
              <ScrollView horizontal style={styles.thumbs} contentContainerStyle={styles.thumbsContent}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.thumbWrap}>
                    <Image source={{ uri: photo.uri }} style={styles.thumb} />
                    <Pressable style={styles.removeThumb} onPress={() => removePhoto(index)}>
                      <Text style={styles.removeThumbText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.closeButton} onPress={handleCloseJob} disabled={loading}>
            <Text style={styles.closeButtonText}>{loading ? 'Closing...' : 'CLOSE JOB (MARK AS SKIPPED)'}</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
