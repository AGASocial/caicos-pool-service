import { useEffect, useState, useLayoutEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, Image, Alert, Modal, useColorScheme } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getPhotoOverlayInfo, type PhotoOverlayInfo } from '@/lib/photoOverlay';
import { PhotoWithOverlay } from '@/components/PhotoWithOverlay';
import { getUploadBodyFromUri } from '@/lib/uploadPhoto';
import Colors from '@/constants/Colors';

const CHEMICAL_READINGS = [
  { key: 'ph_level', label: 'pH', ideal: '7.2-7.6' },
  { key: 'chlorine_level', label: 'Free Chlorine (ppm)', ideal: '1-3' },
  { key: 'alkalinity', label: 'Total Alkalinity (ppm)', ideal: '80-120' },
  { key: 'calcium_hardness', label: 'Calcium Hardness (ppm)', ideal: '200-400' },
  { key: 'cyanuric_acid', label: 'CYA (ppm)', ideal: '30-100' },
  { key: 'salt_level', label: 'Salt (ppm)', ideal: '2700-3400' },
  { key: 'water_temp_f', label: 'Water temp (°F)', ideal: '78-86' },
] as const;

const TASKS = [
  { key: 'skimmed', label: 'Skimmed surface' },
  { key: 'vacuumed', label: 'Vacuumed floor' },
  { key: 'brushed', label: 'Brushed walls' },
  { key: 'emptied_baskets', label: 'Emptied baskets' },
  { key: 'backwashed', label: 'Backwashed filter' },
  { key: 'cleaned_filter', label: 'Cleaned filter' },
] as const;

const EQUIPMENT = [
  { key: 'pump_ok', label: 'Pump' },
  { key: 'filter_ok', label: 'Filter' },
  { key: 'heater_ok', label: 'Heater' },
  { key: 'cleaner_ok', label: 'Cleaner' },
] as const;

/** Distance in meters between two WGS84 points (Haversine). */
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useColorScheme() ?? 'light';
  const themeColors = Colors[theme];
  const [job, setJob] = useState<{
    id: string;
    status: string;
    property_id: string;
    company_id: string;
    technician_id: string | null;
    scheduled_date?: string;
    caicos_properties?: { customer_name: string; address: string; gate_code: string | null; lat: number | null; lng: number | null } | null;
  } | null>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationChecking, setLocationChecking] = useState(false);
  const [chemicals, setChemicals] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<Record<string, boolean>>({});
  const [equipment, setEquipment] = useState<Record<string, boolean>>(Object.fromEntries(EQUIPMENT.map((e) => [e.key, true])));
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [photos, setPhotos] = useState<{ uri: string; id?: string; storage_path?: string }[]>([]);
  const [existingReportId, setExistingReportId] = useState<string | null>(null);
  const [jobMenuVisible, setJobMenuVisible] = useState(false);
  const [pendingOverlay, setPendingOverlay] = useState<{
    uri: string;
    width: number;
    height: number;
    overlay: PhotoOverlayInfo;
  } | null>(null);
  const [photoFullScreenIndex, setPhotoFullScreenIndex] = useState<number | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: themeColors.background },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background },
        header: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          padding: 16,
          backgroundColor: themeColors.headerBg,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.border,
        },
        headerContent: { flex: 1 },
        menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 56, paddingRight: 16 },
        menuCard: {
          backgroundColor: themeColors.card,
          borderRadius: 12,
          minWidth: 200,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 5,
        },
        menuOption: { paddingVertical: 14, paddingHorizontal: 20 },
        menuOptionText: { fontSize: 16, fontWeight: '500', color: themeColors.text },
        menuOptionCancel: { color: themeColors.muted },
        title: { fontSize: 18, fontWeight: '600', color: themeColors.text },
        address: { fontSize: 14, color: themeColors.muted, marginTop: 4 },
        gate: { fontSize: 14, color: themeColors.link, marginTop: 4 },
        status: { fontSize: 12, color: themeColors.mutedSecondary, marginTop: 4 },
        locationWarning: {
          marginHorizontal: 16,
          marginTop: 16,
          marginBottom: 12,
          padding: 12,
          backgroundColor: themeColors.warningBg,
          borderRadius: 8,
          borderLeftWidth: 4,
          borderLeftColor: themeColors.warningBorder,
        },
        locationWarningText: { fontSize: 14, color: themeColors.warningText },
        startButton: { backgroundColor: themeColors.buttonSuccess, margin: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
        startButtonText: { color: themeColors.buttonSuccessText, fontWeight: '700', fontSize: 16 },
        cantServiceButton: { backgroundColor: themeColors.buttonDanger, marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
        cantServiceButtonText: { color: themeColors.buttonDangerText, fontWeight: '600', fontSize: 16 },
        sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 20, marginHorizontal: 16, color: themeColors.text },
        field: { marginHorizontal: 16, marginTop: 8 },
        label: { fontSize: 14, color: themeColors.muted },
        input: {
          borderWidth: 1,
          borderColor: themeColors.border,
          borderRadius: 8,
          padding: 12,
          marginTop: 4,
          backgroundColor: themeColors.inputBg,
          color: themeColors.text,
        },
        textArea: { minHeight: 80 },
        row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 12 },
        taskLabel: { fontSize: 14, color: themeColors.text },
        completeButton: { backgroundColor: themeColors.buttonPrimary, margin: 16, padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 24 },
        completeButtonText: { color: themeColors.buttonPrimaryText, fontWeight: '600' },
        photoActions: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 8 },
        photoButton: { flex: 1, backgroundColor: themeColors.photoButtonBg, padding: 12, borderRadius: 8, alignItems: 'center' },
        photoButtonText: { fontSize: 14, fontWeight: '500', color: themeColors.text },
        photoThumbs: { marginTop: 12, marginHorizontal: 16 },
        photoThumbsContent: { gap: 8, paddingRight: 16 },
        thumbWrap: { position: 'relative' },
        thumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: themeColors.thumbBg },
        removeThumb: { position: 'absolute', top: 2, right: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
        removeThumbText: { color: '#fff', fontSize: 20, lineHeight: 22, fontWeight: '600' },
        photoFullScreenBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
        photoFullScreenImage: { width: '100%', height: '100%' },
        photoFullScreenClose: { position: 'absolute', top: 48, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
        photoFullScreenCloseText: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },
      }),
    [theme]
  );

  useEffect(() => {
    if (!id) return;
    supabase
      .from('caicos_service_jobs')
      .select('id, status, property_id, company_id, technician_id, scheduled_date, caicos_properties(customer_name, address, gate_code, lat, lng)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setJob(data as typeof job);
        const status = (data as { status?: string })?.status;
        setStarted(status === 'in_progress' || status === 'completed');
      })
      .then(() => setLoading(false), () => setLoading(false));
  }, [id]);

  // When job is started (in_progress or completed), load existing report and photos if any
  useEffect(() => {
    if (!id || !job || !started) return;
    let cancelled = false;
    (async () => {
      const { data: reportRow } = await supabase
        .from('caicos_service_reports')
        .select('id, ph_level, chlorine_level, alkalinity, calcium_hardness, cyanuric_acid, salt_level, water_temp_f, skimmed, vacuumed, brushed, emptied_baskets, backwashed, cleaned_filter, pump_ok, filter_ok, heater_ok, cleaner_ok, notes, follow_up_needed, follow_up_notes')
        .eq('job_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!reportRow) {
        setExistingReportId(null);
        setPhotos([]);
        return;
      }
      const r = reportRow as Record<string, unknown>;
      setExistingReportId(r.id as string);
      setChemicals({
        ph_level: r.ph_level != null ? String(r.ph_level) : '',
        chlorine_level: r.chlorine_level != null ? String(r.chlorine_level) : '',
        alkalinity: r.alkalinity != null ? String(r.alkalinity) : '',
        calcium_hardness: r.calcium_hardness != null ? String(r.calcium_hardness) : '',
        cyanuric_acid: r.cyanuric_acid != null ? String(r.cyanuric_acid) : '',
        salt_level: r.salt_level != null ? String(r.salt_level) : '',
        water_temp_f: r.water_temp_f != null ? String(r.water_temp_f) : '',
      });
      setTasks({
        skimmed: Boolean(r.skimmed),
        vacuumed: Boolean(r.vacuumed),
        brushed: Boolean(r.brushed),
        emptied_baskets: Boolean(r.emptied_baskets),
        backwashed: Boolean(r.backwashed),
        cleaned_filter: Boolean(r.cleaned_filter),
      });
      setEquipment({
        pump_ok: r.pump_ok !== false,
        filter_ok: r.filter_ok !== false,
        heater_ok: r.heater_ok !== false,
        cleaner_ok: r.cleaner_ok !== false,
      });
      setNotes((r.notes as string) ?? '');
      setFollowUp(Boolean(r.follow_up_needed));
      setFollowUpNotes((r.follow_up_notes as string) ?? '');

      const { data: photoRows } = await supabase
        .from('caicos_report_photos')
        .select('id, storage_path')
        .eq('report_id', r.id);
      if (cancelled) return;
      if (!photoRows?.length) {
        setPhotos([]);
        return;
      }
      const paths = photoRows.map((p: { storage_path: string }) => p.storage_path);
      const { data: signedData, error: signedError } = await supabase.storage
        .from('report-photos')
        .createSignedUrls(paths, 3600);
      if (cancelled) return;
      if (signedError || !signedData?.length) {
        setPhotos([]);
        return;
      }
      const photoList = photoRows.map((p: { id: string; storage_path: string }, i: number) => ({
        uri: signedData[i]?.signedUrl ?? '',
        id: p.id,
        storage_path: p.storage_path,
      })).filter((x) => x.uri);
      setPhotos(photoList);
    })();
    return () => { cancelled = true; };
  }, [id, job?.id, started]);

  // Put "Can't service" menu in the stack header (top right) when job is started
  useLayoutEffect(() => {
    if (!started) {
      navigation.setOptions({ headerRight: undefined });
      return;
    }
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={openJobMenu} style={{ padding: 8 }} hitSlop={12}>
          <Ionicons name="ellipsis-vertical" size={24} color={themeColors.text} />
        </Pressable>
      ),
    });
  }, [started, navigation, themeColors.text]);

  // When job has property lat/lng, get user location and compute distance for warning
  useEffect(() => {
    if (!job || started) return;
    const prop = Array.isArray(job.caicos_properties) ? job.caicos_properties[0] : job.caicos_properties;
    const lat = prop?.lat ?? null;
    const lng = prop?.lng ?? null;
    if (lat == null || lng == null) return;

    let cancelled = false;
    setLocationError(null);
    setLocationChecking(true);
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) {
          if (!cancelled) {
            setLocationError('Location permission denied');
            setLocationChecking(false);
          }
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const meters = haversineMeters(loc.coords.latitude, loc.coords.longitude, lat, lng);
        setDistanceMeters(meters);
      } catch (e) {
        if (!cancelled) setLocationError('Location unavailable');
      } finally {
        if (!cancelled) setLocationChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [job, started]);

  async function handleStart() {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('caicos_service_jobs').update({ status: 'in_progress' }).eq('id', id);
    setStarted(true);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const overlay = await getPhotoOverlayInfo();
      const w = asset.width ?? 1080;
      const h = asset.height ?? 1920;
      setPendingOverlay({ uri: asset.uri, width: w, height: h, overlay });
    }
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery permission is required to select photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri }))]);
    }
  }

  async function removePhoto(index: number) {
    const photo = photos[index];
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    if (photoFullScreenIndex === index) setPhotoFullScreenIndex(null);
    else if (photoFullScreenIndex != null && photoFullScreenIndex > index) setPhotoFullScreenIndex(photoFullScreenIndex - 1);
    if (photo.id) {
      if (photo.storage_path) {
        await supabase.storage.from('report-photos').remove([photo.storage_path]);
      }
      const { error } = await supabase.from('caicos_report_photos').delete().eq('id', photo.id);
      if (error) {
        Alert.alert('Could not remove photo', error.message ?? 'Delete failed. The photo was removed from the list—you may need to add a policy for deleting report photos.');
      }
    }
  }

  function confirmRemovePhoto(index: number) {
    Alert.alert(
      'Delete photo?',
      'Remove this photo from the report?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removePhoto(index) },
      ]
    );
  }

  async function handleComplete() {
    if (!id || !job) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    try {
      const reportPayload = {
        job_id: id,
        company_id: job.company_id,
        technician_id: user.id,
        ph_level: chemicals.ph_level ? parseFloat(chemicals.ph_level) : null,
        chlorine_level: chemicals.chlorine_level ? parseFloat(chemicals.chlorine_level) : null,
        alkalinity: chemicals.alkalinity ? parseFloat(chemicals.alkalinity) : null,
        calcium_hardness: chemicals.calcium_hardness ? parseFloat(chemicals.calcium_hardness) : null,
        cyanuric_acid: chemicals.cyanuric_acid ? parseFloat(chemicals.cyanuric_acid) : null,
        salt_level: chemicals.salt_level ? parseFloat(chemicals.salt_level) : null,
        water_temp_f: chemicals.water_temp_f ? parseFloat(chemicals.water_temp_f) : null,
        skimmed: tasks.skimmed ?? false,
        vacuumed: tasks.vacuumed ?? false,
        brushed: tasks.brushed ?? false,
        emptied_baskets: tasks.emptied_baskets ?? false,
        backwashed: tasks.backwashed ?? false,
        cleaned_filter: tasks.cleaned_filter ?? false,
        pump_ok: equipment.pump_ok ?? true,
        filter_ok: equipment.filter_ok ?? true,
        heater_ok: equipment.heater_ok ?? true,
        cleaner_ok: equipment.cleaner_ok ?? true,
        notes: notes || null,
        follow_up_needed: followUp,
        follow_up_notes: followUp ? followUpNotes : null,
      };

      let reportId: string;
      if (existingReportId) {
        const { error: updateErr } = await supabase
          .from('caicos_service_reports')
          .update(reportPayload)
          .eq('id', existingReportId);
        if (updateErr) {
          Alert.alert('Error', updateErr.message ?? 'Failed to update report');
          return;
        }
        reportId = existingReportId;
      } else {
        const { data: reportRow, error: reportErr } = await supabase
          .from('caicos_service_reports')
          .insert(reportPayload)
          .select('id')
          .single();
        if (reportErr) {
          Alert.alert('Error', reportErr.message ?? 'Failed to save report');
          return;
        }
        reportId = reportRow.id;
      }

      const { error: updateJobErr } = await supabase.from('caicos_service_jobs').update({ status: 'completed' }).eq('id', id);
      if (updateJobErr) {
        Alert.alert('Error', updateJobErr.message ?? 'Failed to update job status');
        return;
      }

      const dateStr =
        job.scheduled_date != null
          ? String(job.scheduled_date).slice(0, 10)
          : new Date().toISOString().slice(0, 10);

      let photoErrors = 0;
      for (const photo of photos) {
        if (photo.storage_path) continue;
        try {
          const fileName = `${job.company_id}/${dateStr}/${job.property_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
          const body = await getUploadBodyFromUri(photo.uri);
          const { error: uploadErr } = await supabase.storage
            .from('report-photos')
            .upload(fileName, body, { contentType: 'image/jpeg' });
          if (!uploadErr) {
            await supabase.from('caicos_report_photos').insert({
              report_id: reportId,
              company_id: job.company_id,
              storage_path: fileName,
              photo_type: 'general',
            });
          } else {
            photoErrors += 1;
          }
        } catch (_err) {
          photoErrors += 1;
        }
      }

      if (photoErrors > 0) {
        Alert.alert('Report saved', `${photoErrors} photo(s) could not be uploaded. The report and job are saved.`);
      }
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save report');
    } finally {
      setSaving(false);
    }
  }

  function openJobMenu() {
    setJobMenuVisible(true);
  }

  function closeJobMenu() {
    setJobMenuVisible(false);
  }

  function handleCantServiceFromMenu() {
    closeJobMenu();
    if (id) router.push(`/(app)/job/${id}/cant-service`);
  }

  async function handlePutOnHold() {
    closeJobMenu();
    if (!id) return;
    const { error } = await supabase.from('caicos_service_jobs').update({ status: 'pending' }).eq('id', id);
    if (error) {
      Alert.alert('Error', error.message ?? 'Failed to update job');
      return;
    }
    router.back();
  }

  if (loading || !job) {
    return (
      <View style={styles.center}>
        <Text>Loading job…</Text>
      </View>
    );
  }

  const prop = Array.isArray(job.caicos_properties) ? job.caicos_properties[0] : job.caicos_properties;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{prop?.customer_name ?? '—'}</Text>
          <Text style={styles.address}>{prop?.address ?? ''}</Text>
          {prop?.gate_code && <Text style={styles.gate}>Gate: {prop.gate_code}</Text>}
          <Text style={styles.status}>Status: {job.status}</Text>
        </View>
      </View>

      <Modal visible={jobMenuVisible} transparent animationType="fade">
        <Pressable style={styles.menuBackdrop} onPress={closeJobMenu}>
          <Pressable style={styles.menuCard} onPress={() => {}}>
            <Pressable style={styles.menuOption} onPress={handleCantServiceFromMenu}>
              <Text style={styles.menuOptionText}>Can't service</Text>
            </Pressable>
            <Pressable style={styles.menuOption} onPress={handlePutOnHold}>
              <Text style={styles.menuOptionText}>Put visit on hold</Text>
            </Pressable>
            <Pressable style={styles.menuOption} onPress={closeJobMenu}>
              <Text style={[styles.menuOptionText, styles.menuOptionCancel]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {!started ? (
        <>
          {locationChecking && (
            <View style={styles.locationWarning}>
              <Text style={styles.locationWarningText}>Checking your location…</Text>
            </View>
          )}
          {distanceMeters != null && distanceMeters > 500 && (
            <View style={styles.locationWarning}>
              <Text style={styles.locationWarningText}>
                You're about {(() => {
                  const ft = distanceMeters * 3.28084;
                  return ft >= 5280 ? `${(ft / 5280).toFixed(1)} miles` : `${Math.round(ft)} ft`;
                })()} from this address. Make sure you're at the right location before starting.
              </Text>
            </View>
          )}
          {locationError && (
            <View style={styles.locationWarning}>
              <Text style={styles.locationWarningText}>{locationError}. Distance check skipped.</Text>
            </View>
          )}
          <Pressable style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>START</Text>
          </Pressable>
          <Pressable style={styles.cantServiceButton} onPress={() => id && router.push(`/(app)/job/${id}/cant-service`)}>
            <Text style={styles.cantServiceButtonText}>Can't service</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Chemical readings</Text>
          {CHEMICAL_READINGS.map(({ key, label, ideal }) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label} ({ideal})</Text>
              <TextInput
                style={styles.input}
                value={chemicals[key] ?? ''}
                onChangeText={(v) => setChemicals((c) => ({ ...c, [key]: v }))}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={themeColors.placeholder}
              />
            </View>
          ))}

          <Text style={styles.sectionTitle}>Tasks</Text>
          {TASKS.map(({ key, label }) => (
            <View key={key} style={styles.row}>
              <Text style={styles.taskLabel}>{label}</Text>
              <Switch value={tasks[key] ?? false} onValueChange={(v) => setTasks((t) => ({ ...t, [key]: v }))} />
            </View>
          ))}

          <Text style={styles.sectionTitle}>Equipment</Text>
          {EQUIPMENT.map(({ key, label }) => (
            <View key={key} style={styles.row}>
              <Text style={styles.taskLabel}>{label}</Text>
              <Switch value={equipment[key] ?? true} onValueChange={(v) => setEquipment((e) => ({ ...e, [key]: v }))} />
            </View>
          ))}

          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Service notes…"
            placeholderTextColor={themeColors.placeholder}
            multiline
          />

          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.photoActions}>
            <Pressable style={styles.photoButton} onPress={takePhoto}>
              <Text style={styles.photoButtonText}>📷 Take photo</Text>
            </Pressable>
            <Pressable style={styles.photoButton} onPress={pickFromGallery}>
              <Text style={styles.photoButtonText}>🖼️ Add Photo(s)</Text>
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
            <ScrollView horizontal style={styles.photoThumbs} contentContainerStyle={styles.photoThumbsContent}>
              {photos.map((photo, index) => (
                <View key={photo.id ?? `new-${index}`} style={styles.thumbWrap}>
                  <Pressable onPress={() => setPhotoFullScreenIndex(index)}>
                    <Image source={{ uri: photo.uri }} style={styles.thumb} />
                  </Pressable>
                  <Pressable style={styles.removeThumb} onPress={() => confirmRemovePhoto(index)}>
                    <Text style={styles.removeThumbText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <Modal visible={photoFullScreenIndex !== null} transparent animationType="fade">
            <View style={styles.photoFullScreenBackdrop}>
              {photoFullScreenIndex !== null && photos[photoFullScreenIndex] && (
                <Image
                  source={{ uri: photos[photoFullScreenIndex].uri }}
                  style={styles.photoFullScreenImage}
                  resizeMode="contain"
                />
              )}
              <Pressable
                style={styles.photoFullScreenClose}
                onPress={() => setPhotoFullScreenIndex(null)}
                hitSlop={16}
              >
                <Text style={styles.photoFullScreenCloseText}>×</Text>
              </Pressable>
            </View>
          </Modal>

          <View style={styles.row}>
            <Text style={styles.taskLabel}>Follow-up needed?</Text>
            <Switch value={followUp} onValueChange={setFollowUp} />
          </View>
          {followUp && (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={followUpNotes}
              onChangeText={setFollowUpNotes}
              placeholder="Follow-up notes…"
              placeholderTextColor={themeColors.placeholder}
              multiline
            />
          )}

          <Pressable style={styles.completeButton} onPress={handleComplete} disabled={saving}>
            <Text style={styles.completeButtonText}>{saving ? 'Saving…' : 'Complete & save report'}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

