import { useEffect, useState, useLayoutEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, Image, Alert, Modal, useColorScheme } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getCachedUserId } from '@/lib/auth-session';
import { getSignedUrls } from '@/lib/signed-url-cache';
import { getPhotoOverlayInfo, type PhotoOverlayInfo } from '@/lib/photoOverlay';
import { PhotoWithOverlay } from '@/components/PhotoWithOverlay';
import { getUploadBodyFromUri } from '@/lib/uploadPhoto';
import Colors from '@/constants/Colors';
import {
  CHEMICAL_READINGS,
  EQUIPMENT,
  ISSUE_CATEGORY_OPTIONS,
  VISIT_EXTRAS,
  type IssueCategoryKey,
} from '@/lib/visitForm';

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
  const cc = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * cc;
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
    cadenza_properties?: { customer_name: string; address: string; gate_code: string | null; lat: number | null; lng: number | null } | null;
  } | null>(null);
  const [started, setStarted] = useState(false);
  const [jobLoaded, setJobLoaded] = useState(false);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationChecking, setLocationChecking] = useState(false);
  const [chemicals, setChemicals] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<Record<string, boolean>>({});
  const [issueCategories, setIssueCategories] = useState<IssueCategoryKey[]>([]);
  const [otherChemicals, setOtherChemicals] = useState('');
  const [equipment, setEquipment] = useState<Record<string, boolean>>(Object.fromEntries(EQUIPMENT.map((e) => [e.key, true])));
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [photos, setPhotos] = useState<{ uri: string; id?: string; storage_path?: string }[]>([]);
  const [existingReportId, setExistingReportId] = useState<string | null>(null);
  const [jobMenuVisible, setJobMenuVisible] = useState(false);
  const [chemExpanded, setChemExpanded] = useState(false);
  const [equipExpanded, setEquipExpanded] = useState(false);
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
        content: { padding: 16, gap: 16 },
        // Customer info card
        customerCard: {
          backgroundColor: themeColors.card,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: themeColors.borderSubtle,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
        customerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
        customerInfo: { flex: 1, gap: 4 },
        title: { fontSize: 20, fontWeight: '700', color: themeColors.text, letterSpacing: -0.3 },
        gateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        gateCode: {
          fontSize: 14,
          fontWeight: '500',
          color: themeColors.text,
          backgroundColor: themeColors.inputBgAlt,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 4,
          overflow: 'hidden',
        },
        address: { fontSize: 14, color: themeColors.muted, fontWeight: '500' },
        status: { fontSize: 13, color: themeColors.mutedSecondary },
        directionsBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          height: 36,
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: themeColors.inputBgAlt,
          marginTop: 8,
          alignSelf: 'flex-start',
        },
        directionsBtnText: { fontSize: 14, fontWeight: '500', color: themeColors.text },
        // Menu modal
        menuBackdrop: { flex: 1, backgroundColor: themeColors.overlay, justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 56, paddingRight: 20 },
        menuCard: {
          backgroundColor: themeColors.card,
          borderRadius: 12,
          minWidth: 220,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        },
        menuOption: { paddingVertical: 16, paddingHorizontal: 20 },
        menuOptionText: { fontSize: 16, fontWeight: '500', color: themeColors.text },
        menuOptionCancel: { color: themeColors.muted },
        // Location warning
        locationWarning: {
          padding: 16,
          backgroundColor: themeColors.warningBg,
          borderRadius: 12,
          borderLeftWidth: 4,
          borderLeftColor: themeColors.warningBorder,
        },
        locationWarningText: { fontSize: 14, color: themeColors.warningText },
        // Start/action buttons
        startButton: {
          backgroundColor: themeColors.buttonPrimary,
          padding: 18,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 12,
          shadowColor: themeColors.buttonPrimaryShadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 4,
        },
        startButtonText: { color: themeColors.buttonPrimaryText, fontWeight: '700', fontSize: 18, letterSpacing: 0.5 },
        cantServiceButton: {
          borderWidth: 1,
          borderColor: themeColors.buttonDanger,
          borderRadius: 12,
          padding: 16,
          alignItems: 'center',
        },
        cantServiceButtonText: { color: themeColors.buttonDanger, fontWeight: '600', fontSize: 16 },
        // Section cards
        sectionCard: {
          backgroundColor: themeColors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: themeColors.borderSubtle,
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
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.borderSubtle,
          backgroundColor: themeColors.sectionHeaderBg,
        },
        sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        sectionIcon: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sectionIconText: { fontSize: 16 },
        sectionTitle: { fontSize: 16, fontWeight: '700', color: themeColors.text },
        // Chemical readings grid
        chemGrid: {
          padding: 16,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 16,
        },
        chemField: { width: '46%' },
        chemFieldFull: { width: '100%' },
        chemLabel: {
          fontSize: 11,
          fontWeight: '600',
          color: themeColors.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 6,
        },
        chemInput: {
          borderWidth: 1,
          borderColor: themeColors.border,
          borderRadius: 8,
          paddingHorizontal: 12,
          height: 48,
          backgroundColor: themeColors.inputBg,
          color: themeColors.text,
          fontSize: 18,
          fontVariant: ['tabular-nums'],
        },
        // Task toggle rows
        taskRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.divider,
        },
        taskRowLast: { borderBottomWidth: 0 },
        taskLabel: { fontSize: 16, fontWeight: '500', color: themeColors.text },
        sectionHint: {
          fontSize: 13,
          color: themeColors.muted,
          paddingHorizontal: 16,
          paddingBottom: 12,
          lineHeight: 18,
        },
        chipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 16,
        },
        chip: {
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: themeColors.border,
          backgroundColor: themeColors.chipBgAlt,
        },
        chipSelected: {
          backgroundColor: themeColors.chipBg,
          borderColor: themeColors.tint,
        },
        chipText: { fontSize: 14, fontWeight: '600', color: themeColors.chipText },
        chipTextSelected: { color: themeColors.text },
        chemicalNoteInput: {
          marginHorizontal: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: themeColors.border,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          color: themeColors.text,
          backgroundColor: themeColors.inputBg,
        },
        photoHint: {
          fontSize: 13,
          color: themeColors.muted,
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 8,
        },
        // Equipment section
        equipmentRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 12,
        },
        equipmentBody: { padding: 16, gap: 12 },
        // Notes
        notesCard: {
          backgroundColor: themeColors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: themeColors.borderSubtle,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
        notesInput: {
          padding: 16,
          minHeight: 88,
          fontSize: 16,
          color: themeColors.text,
          textAlignVertical: 'top',
        },
        // Photos section
        photoActions: { flexDirection: 'row', gap: 12, padding: 16 },
        photoButton: {
          flex: 1,
          height: 48,
          backgroundColor: themeColors.photoButtonBg,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: themeColors.border,
        },
        photoButtonText: { fontSize: 14, fontWeight: '600', color: themeColors.muted },
        photoThumbs: { paddingHorizontal: 16, paddingBottom: 16 },
        photoThumbsContent: { gap: 12, paddingRight: 20 },
        thumbWrap: { position: 'relative' },
        thumb: { width: 90, height: 90, borderRadius: 12, backgroundColor: themeColors.thumbBg },
        removeThumb: { position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
        removeThumbText: { color: '#fff', fontSize: 14, lineHeight: 16 },
        photoFullScreenBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
        photoFullScreenImage: { width: '100%', height: '100%' },
        photoFullScreenClose: { position: 'absolute', top: 48, right: 24, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
        photoFullScreenCloseText: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },
        // Follow-up
        followUpRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: themeColors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: themeColors.borderSubtle,
          paddingHorizontal: 16,
          paddingVertical: 14,
        },
        followUpInput: {
          backgroundColor: themeColors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: themeColors.borderSubtle,
          padding: 16,
          minHeight: 88,
          fontSize: 16,
          color: themeColors.text,
          textAlignVertical: 'top',
        },
        // Complete button
        completeButton: {
          backgroundColor: themeColors.buttonPrimary,
          borderRadius: 12,
          padding: 18,
          alignItems: 'center',
          marginTop: 8,
          marginBottom: 32,
          shadowColor: themeColors.buttonPrimaryShadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 4,
        },
        completeButtonText: { color: themeColors.buttonPrimaryText, fontWeight: '700', fontSize: 16 },
      }),
    [theme]
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setJobLoaded(false);
    setReportLoaded(false);

    (async () => {
      const [jobRes, reportRes] = await Promise.all([
        supabase
          .from('cadenza_service_jobs')
          .select('id, status, property_id, company_id, technician_id, scheduled_date, cadenza_properties(customer_name, address, gate_code, lat, lng)')
          .eq('id', id)
          .single(),
        supabase
          .from('cadenza_service_reports')
          .select('id, ph_level, chlorine_level, alkalinity, calcium_hardness, cyanuric_acid, salt_level, water_temp_f, skimmed, vacuumed, brushed, emptied_baskets, backwashed, cleaned_filter, pump_ok, filter_ok, heater_ok, cleaner_ok, notes, follow_up_needed, follow_up_notes, issue_categories, other_chemicals')
          .eq('job_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const jobData = jobRes.data;
      if (jobData) {
        setJob(jobData as typeof job);
        const status = (jobData as { status?: string }).status;
        setStarted(status === 'in_progress' || status === 'completed');
      }
      setJobLoaded(true);

      const reportRow = reportRes.data;
      if (!reportRow) {
        setExistingReportId(null);
        setPhotos([]);
        setReportLoaded(true);
        return;
      }

      const r = reportRow as Record<string, unknown>;
      const reportId = r.id as string;
      setExistingReportId(reportId);
      setChemicals({
        ph_level: r.ph_level != null ? String(r.ph_level) : '',
        chlorine_level: r.chlorine_level != null ? String(r.chlorine_level) : '',
        alkalinity: r.alkalinity != null ? String(r.alkalinity) : '',
        calcium_hardness: r.calcium_hardness != null ? String(r.calcium_hardness) : '',
        cyanuric_acid: r.cyanuric_acid != null ? String(r.cyanuric_acid) : '',
        salt_level: r.salt_level != null ? String(r.salt_level) : '',
        water_temp_f: r.water_temp_f != null ? String(r.water_temp_f) : '',
      });
      setExtras({
        cleaned_filter: Boolean(r.cleaned_filter),
        vacuumed: Boolean(r.vacuumed),
        salt_chemicals: Boolean(r.other_chemicals),
        low_water: false,
      });
      const loadedIssues = Array.isArray(r.issue_categories)
        ? (r.issue_categories as string[]).filter((k): k is IssueCategoryKey =>
            ISSUE_CATEGORY_OPTIONS.some((o) => o.key === k)
          )
        : [];
      setIssueCategories(loadedIssues);
      setOtherChemicals((r.other_chemicals as string) ?? '');
      setEquipment({
        pump_ok: r.pump_ok !== false,
        filter_ok: r.filter_ok !== false,
        heater_ok: r.heater_ok !== false,
        cleaner_ok: r.cleaner_ok !== false,
      });
      setNotes((r.notes as string) ?? '');
      setFollowUp(Boolean(r.follow_up_needed));
      setFollowUpNotes((r.follow_up_notes as string) ?? '');
      setReportLoaded(true);

      const { data: photoRows } = await supabase
        .from('cadenza_report_photos')
        .select('id, storage_path')
        .eq('report_id', reportId);
      if (cancelled) return;
      if (!photoRows?.length) {
        setPhotos([]);
        return;
      }

      const paths = photoRows.map((p: { storage_path: string }) => p.storage_path);
      const signedUrls = await getSignedUrls(paths);
      if (cancelled) return;

      const photoList = photoRows
        .map((p: { id: string; storage_path: string }, i: number) => ({
          uri: signedUrls[i] ?? '',
          id: p.id,
          storage_path: p.storage_path,
        }))
        .filter((x) => x.uri);
      setPhotos(photoList);
    })();

    return () => { cancelled = true; };
  }, [id]);

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

  useEffect(() => {
    if (!job || started) return;
    const prop = Array.isArray(job.cadenza_properties) ? job.cadenza_properties[0] : job.cadenza_properties;
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
    if (!getCachedUserId()) return;
    const { error } = await supabase
      .from('cadenza_service_jobs')
      .update({ status: 'in_progress' })
      .eq('id', id);
    if (error) {
      Alert.alert('Could not start job', error.message ?? 'You may not be assigned to this job.');
      return;
    }
    setStarted(true);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.4,
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
      quality: 0.4,
      allowsMultipleSelection: true,
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
      const { error } = await supabase
        .from('cadenza_report_photos')
        .update({ is_deleted: true })
        .eq('id', photo.id)
        .eq('is_deleted', false);
      if (error) {
        Alert.alert('Could not remove photo', error.message ?? 'Delete failed. The photo was removed from the list\u2014you may need to add a policy for updating report photos.');
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
    if (photos.length === 0) {
      Alert.alert('Photo required', 'Add at least one photo before completing this visit.');
      return;
    }
    const userId = getCachedUserId();
    if (!userId) return;
    const needsFollowUp = followUp || issueCategories.length > 0 || Boolean(extras.low_water);
    setSaving(true);
    try {
      const reportPayload = {
        job_id: id,
        company_id: job.company_id,
        technician_id: userId,
        ph_level: chemicals.ph_level ? parseFloat(chemicals.ph_level) : null,
        chlorine_level: chemicals.chlorine_level ? parseFloat(chemicals.chlorine_level) : null,
        alkalinity: chemicals.alkalinity ? parseFloat(chemicals.alkalinity) : null,
        calcium_hardness: chemicals.calcium_hardness ? parseFloat(chemicals.calcium_hardness) : null,
        cyanuric_acid: chemicals.cyanuric_acid ? parseFloat(chemicals.cyanuric_acid) : null,
        salt_level: chemicals.salt_level ? parseFloat(chemicals.salt_level) : null,
        water_temp_f: chemicals.water_temp_f ? parseFloat(chemicals.water_temp_f) : null,
        skimmed: false,
        vacuumed: extras.vacuumed ?? false,
        brushed: false,
        emptied_baskets: false,
        backwashed: extras.cleaned_filter ?? false,
        cleaned_filter: extras.cleaned_filter ?? false,
        pump_ok: equipment.pump_ok ?? true,
        filter_ok: equipment.filter_ok ?? true,
        heater_ok: equipment.heater_ok ?? true,
        cleaner_ok: equipment.cleaner_ok ?? true,
        issue_categories: issueCategories,
        other_chemicals: extras.salt_chemicals && otherChemicals.trim() ? otherChemicals.trim() : null,
        notes: notes || null,
        follow_up_needed: needsFollowUp,
        follow_up_notes: needsFollowUp ? followUpNotes || null : null,
      };

      let reportId: string;
      if (existingReportId) {
        const { error: updateErr } = await supabase
          .from('cadenza_service_reports')
          .update(reportPayload)
          .eq('id', existingReportId);
        if (updateErr) {
          Alert.alert('Error', updateErr.message ?? 'Failed to update report');
          return;
        }
        reportId = existingReportId;
      } else {
        const { data: reportRow, error: reportErr } = await supabase
          .from('cadenza_service_reports')
          .insert(reportPayload)
          .select('id')
          .single();
        if (reportErr) {
          Alert.alert('Error', reportErr.message ?? 'Failed to save report');
          return;
        }
        reportId = reportRow.id;
      }

      const { error: updateJobErr } = await supabase.from('cadenza_service_jobs').update({ status: 'completed' }).eq('id', id);
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
            await supabase.from('cadenza_report_photos').insert({
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
    const { error } = await supabase.from('cadenza_service_jobs').update({ status: 'pending' }).eq('id', id);
    if (error) {
      Alert.alert('Error', error.message ?? 'Failed to update job');
      return;
    }
    router.back();
  }

  if (!jobLoaded || !job) {
    return (
      <View style={styles.center}>
        <Text style={{ color: themeColors.text }}>Loading job...</Text>
      </View>
    );
  }

  const prop = Array.isArray(job.cadenza_properties) ? job.cadenza_properties[0] : job.cadenza_properties;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Customer Info Card */}
        <View style={styles.customerCard}>
          <View style={styles.customerInfo}>
            <Text style={styles.title}>{prop?.customer_name ?? '\u2014'}</Text>
            {prop?.gate_code && (
              <View style={styles.gateRow}>
                <Text style={styles.address}>Gate:</Text>
                <Text style={styles.gateCode}>{prop.gate_code}</Text>
              </View>
            )}
            <Text style={styles.address}>{prop?.address ?? ''}</Text>
            <Text style={styles.status}>Status: {job.status}</Text>
            <View style={styles.directionsBtn}>
              <Text style={styles.directionsBtnText}>DIRECTIONS</Text>
            </View>
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
                <Text style={styles.locationWarningText}>Checking your location...</Text>
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
              <Text style={styles.startButtonText}>START SERVICE</Text>
            </Pressable>
            <Pressable style={styles.cantServiceButton} onPress={() => id && router.push(`/(app)/job/${id}/cant-service`)}>
              <Text style={styles.cantServiceButtonText}>Can't service</Text>
            </Pressable>
          </>
        ) : !reportLoaded ? (
          <View style={styles.center}>
            <Text style={{ color: themeColors.text }}>Loading report...</Text>
          </View>
        ) : (
          <>
            {/* Photos — primary proof of visit (WhatsApp workflow) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIcon, { backgroundColor: themeColors.sectionIconPurpleBg }]}>
                    <Text style={[styles.sectionIconText, { color: themeColors.sectionIconPurpleText }]}>P</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Photos</Text>
                </View>
              </View>
              <Text style={styles.photoHint}>Add as many photos as you need — pool, filter, equipment, etc.</Text>
              <View style={styles.photoActions}>
                <Pressable style={styles.photoButton} onPress={takePhoto}>
                  <Text style={styles.photoButtonText}>Take Photo</Text>
                </Pressable>
                <Pressable style={styles.photoButton} onPress={pickFromGallery}>
                  <Text style={styles.photoButtonText}>From Gallery</Text>
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
                        <Text style={styles.removeThumbText}>{'\u00d7'}</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

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
                  <Text style={styles.photoFullScreenCloseText}>{'\u00d7'}</Text>
                </Pressable>
              </View>
            </Modal>

            {/* Issue category — exceptions drive office follow-up */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIcon, { backgroundColor: themeColors.sectionIconAmberBg }]}>
                    <Text style={[styles.sectionIconText, { color: themeColors.sectionIconAmberText }]}>!</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Issue Found</Text>
                </View>
              </View>
              <Text style={styles.sectionHint}>Tap all that apply. Leave empty if no issues.</Text>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, issueCategories.length === 0 && styles.chipSelected]}
                  onPress={() => setIssueCategories([])}
                >
                  <Text style={[styles.chipText, issueCategories.length === 0 && styles.chipTextSelected]}>
                    No issues
                  </Text>
                </Pressable>
                {ISSUE_CATEGORY_OPTIONS.map(({ key, label }) => {
                  const selected = issueCategories.includes(key);
                  return (
                    <Pressable
                      key={key}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => {
                        setIssueCategories((prev) =>
                          prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                        );
                        if (!selected) setFollowUp(true);
                      }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Visit extras — only when beyond standard weekly service */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIcon, { backgroundColor: themeColors.sectionIconGreenBg }]}>
                    <Text style={[styles.sectionIconText, { color: themeColors.sectionIconGreenText }]}>+</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Visit Extras</Text>
                </View>
              </View>
              <Text style={styles.sectionHint}>Optional. Standard skim/vacuum is assumed unless noted.</Text>
              {VISIT_EXTRAS.map(({ key, label, promptsFollowUp }, idx) => (
                <View key={key} style={[styles.taskRow, idx === VISIT_EXTRAS.length - 1 && !extras.salt_chemicals && styles.taskRowLast]}>
                  <Text style={styles.taskLabel}>{label}</Text>
                  <Switch
                    value={extras[key] ?? false}
                    onValueChange={(v) => {
                      setExtras((prev) => ({ ...prev, [key]: v }));
                      if (v && promptsFollowUp) setFollowUp(true);
                    }}
                    trackColor={{ false: themeColors.switchTrack, true: themeColors.switchTrackActive }}
                  />
                </View>
              ))}
              {extras.salt_chemicals && (
                <TextInput
                  style={styles.chemicalNoteInput}
                  value={otherChemicals}
                  onChangeText={setOtherChemicals}
                  placeholder="e.g. 1 bag salt, pastillero, shock..."
                  placeholderTextColor={themeColors.placeholder}
                />
              )}
            </View>

            {/* Service Notes */}
            <View style={styles.notesCard}>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes for the office (water level, circulation, client request)..."
                placeholderTextColor={themeColors.placeholder}
                multiline
              />
            </View>

            {/* Equipment Status */}
            <View style={styles.sectionCard}>
              <Pressable style={styles.sectionHeader} onPress={() => setEquipExpanded((v) => !v)}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIcon, { backgroundColor: themeColors.sectionIconAmberBg }]}>
                    <Text style={[styles.sectionIconText, { color: themeColors.sectionIconAmberText }]}>E</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Equipment Status</Text>
                </View>
                <Ionicons
                  name={equipExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={themeColors.muted}
                />
              </Pressable>
              {equipExpanded && (
                <View style={styles.equipmentBody}>
                  {EQUIPMENT.map(({ key, label }) => (
                    <View key={key} style={styles.equipmentRow}>
                      <Text style={styles.taskLabel}>{label}</Text>
                      <Switch
                        value={equipment[key] ?? true}
                        onValueChange={(v) => setEquipment((e) => ({ ...e, [key]: v }))}
                        trackColor={{ false: themeColors.switchTrack, true: themeColors.switchTrackActive }}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Chemical Readings (collapsible) */}
            <View style={styles.sectionCard}>
              <Pressable style={styles.sectionHeader} onPress={() => setChemExpanded((v) => !v)}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIcon, { backgroundColor: themeColors.sectionIconBlueBg }]}>
                    <Text style={[styles.sectionIconText, { color: themeColors.sectionIconBlueText }]}>S</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Chemical Readings</Text>
                </View>
                <Ionicons
                  name={chemExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={themeColors.muted}
                />
              </Pressable>
              {chemExpanded && (
                <View style={styles.chemGrid}>
                  {CHEMICAL_READINGS.map(({ key, label }, idx) => (
                    <View key={key} style={idx >= CHEMICAL_READINGS.length - 1 ? styles.chemFieldFull : styles.chemField}>
                      <Text style={styles.chemLabel}>{label}</Text>
                      <TextInput
                        style={styles.chemInput}
                        value={chemicals[key] ?? ''}
                        onChangeText={(v) => setChemicals((prev) => ({ ...prev, [key]: v }))}
                        keyboardType="decimal-pad"
                        placeholder=""
                        placeholderTextColor={themeColors.placeholder}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Follow-up */}
            <View style={styles.followUpRow}>
              <Text style={styles.taskLabel}>Follow-up needed?</Text>
              <Switch
                value={followUp || issueCategories.length > 0 || Boolean(extras.low_water)}
                onValueChange={setFollowUp}
                trackColor={{ false: themeColors.switchTrack, true: themeColors.switchTrackActive }}
              />
            </View>
            {(followUp || issueCategories.length > 0 || extras.low_water) && (
              <TextInput
                style={styles.followUpInput}
                value={followUpNotes}
                onChangeText={setFollowUpNotes}
                placeholder="What should the office do next?"
                placeholderTextColor={themeColors.placeholder}
                multiline
              />
            )}

            <Pressable style={styles.completeButton} onPress={handleComplete} disabled={saving}>
              <Text style={styles.completeButtonText}>{saving ? 'Saving...' : 'Complete & Save Report'}</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}
