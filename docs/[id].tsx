import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useJobDetail } from '@/hooks/useJobs';
import {
  CHEMICAL_READINGS,
  SERVICE_TASKS,
  EQUIPMENT_CHECKS,
  JOB_STATUS_COLORS,
  JOB_STATUS_LABELS,
} from '@/constants/readings';

type PhotoItem = {
  uri: string;
  type: 'before' | 'after' | 'issue' | 'equipment' | 'general';
  caption: string;
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { job, report: existingReport, isLoading } = useJobDetail(id);

  // Form state
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<Record<string, boolean>>({});
  const [equipment, setEquipment] = useState<Record<string, boolean>>({});
  const [chemicals, setChemicals] = useState({ chlorine_added: '', acid_added: '', other_chemicals: '' });
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Populate form if editing existing report
  useEffect(() => {
    if (existingReport) {
      const existingReadings: Record<string, string> = {};
      CHEMICAL_READINGS.forEach((r) => {
        const val = existingReport[r.key];
        if (val != null) existingReadings[r.key] = String(val);
      });
      setReadings(existingReadings);

      const existingTasks: Record<string, boolean> = {};
      SERVICE_TASKS.forEach((t) => {
        existingTasks[t.key] = existingReport[t.key] ?? false;
      });
      setTasks(existingTasks);

      const existingEquip: Record<string, boolean> = {};
      EQUIPMENT_CHECKS.forEach((e) => {
        existingEquip[e.key] = existingReport[e.key] ?? true;
      });
      setEquipment(existingEquip);

      setChemicals({
        chlorine_added: existingReport.chlorine_added ?? '',
        acid_added: existingReport.acid_added ?? '',
        other_chemicals: existingReport.other_chemicals ?? '',
      });
      setNotes(existingReport.notes ?? '');
      setFollowUp(existingReport.follow_up_needed);
      setFollowUpNotes(existingReport.follow_up_notes ?? '');
    }
  }, [existingReport]);

  const takePhoto = async () => {
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
      setPhotos((prev) => [
        ...prev,
        { uri: result.assets[0].uri, type: 'general', caption: '' },
      ]);
    }
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });

    if (!result.canceled) {
      const newPhotos: PhotoItem[] = result.assets.map((a) => ({
        uri: a.uri,
        type: 'general' as const,
        caption: '',
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartJob = async () => {
    if (!job) return;
    try {
      await supabase
        .from('caicos_service_jobs')
        .update({ status: 'in_progress' })
        .eq('id', job.id);
      Alert.alert('Job Started', 'You can now fill out the service report.');
    } catch {
      Alert.alert('Error', 'Failed to start job');
    }
  };

  const handleSaveReport = async () => {
    if (!job || !profile) return;

    setIsSaving(true);

    try {
      // Build report data
      const reportData: Record<string, any> = {
        job_id: job.id,
        company_id: profile.company_id,
        technician_id: profile.id,
        arrival_time: existingReport?.arrival_time ?? new Date().toISOString(),
        departure_time: new Date().toISOString(),
        notes,
        follow_up_needed: followUp,
        follow_up_notes: followUp ? followUpNotes : null,
        chlorine_added: chemicals.chlorine_added || null,
        acid_added: chemicals.acid_added || null,
        other_chemicals: chemicals.other_chemicals || null,
      };

      // Add readings
      CHEMICAL_READINGS.forEach((r) => {
        reportData[r.key] = readings[r.key] ? parseFloat(readings[r.key]) : null;
      });

      // Add tasks
      SERVICE_TASKS.forEach((t) => {
        reportData[t.key] = tasks[t.key] ?? false;
      });

      // Add equipment checks
      EQUIPMENT_CHECKS.forEach((e) => {
        reportData[e.key] = equipment[e.key] ?? true;
      });

      let reportId: string;

      if (existingReport) {
        // Update existing
        const { error } = await supabase
          .from('caicos_service_reports')
          .update(reportData)
          .eq('id', existingReport.id);
        if (error) throw error;
        reportId = existingReport.id;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('caicos_service_reports')
          .insert(reportData)
          .select('id')
          .single();
        if (error) throw error;
        reportId = data.id;
      }

      // Upload photos
      for (const photo of photos) {
        if (photo.uri.startsWith('http')) continue; // Already uploaded

        const fileName = `${profile.company_id}/${reportId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

        const formData = new FormData();
        formData.append('file', {
          uri: photo.uri,
          name: fileName,
          type: 'image/jpeg',
        } as any);

        const { error: uploadError } = await supabase.storage
          .from('report-photos')
          .upload(fileName, formData);

        if (!uploadError) {
          await supabase.from('caicos_report_photos').insert({
            report_id: reportId,
            company_id: profile.company_id,
            storage_path: fileName,
            caption: photo.caption || null,
            photo_type: photo.type,
          });
        }
      }

      // Mark job as completed
      await supabase
        .from('caicos_service_jobs')
        .update({ status: 'completed' })
        .eq('id', job.id);

      Alert.alert('Success', 'Service report saved!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save report');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !job) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0891B2" />
      </View>
    );
  }

  const property = job.properties;
  const isEditable = job.status === 'in_progress' || job.status === 'completed';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Property info header */}
      <View style={styles.propertyHeader}>
        <Text style={styles.customerName}>{property.customer_name}</Text>
        <Text style={styles.address}>{property.address}</Text>
        {property.gate_code && (
          <View style={styles.gateRow}>
            <Ionicons name="key" size={14} color="#F59E0B" />
            <Text style={styles.gateCode}>Gate code: {property.gate_code}</Text>
          </View>
        )}
        <View style={[styles.statusBar, { backgroundColor: JOB_STATUS_COLORS[job.status] + '15' }]}>
          <Text style={[styles.statusLabel, { color: JOB_STATUS_COLORS[job.status] }]}>
            {JOB_STATUS_LABELS[job.status]}
          </Text>
        </View>
      </View>

      {/* Start job button if pending */}
      {job.status === 'pending' && (
        <TouchableOpacity style={styles.startButton} onPress={handleStartJob}>
          <Ionicons name="play-circle" size={22} color="#fff" />
          <Text style={styles.startButtonText}>Start Service</Text>
        </TouchableOpacity>
      )}

      {isEditable && (
        <>
          {/* Chemical Readings Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💧 Chemical Readings</Text>
            {CHEMICAL_READINGS.map((reading) => (
              <View key={reading.key} style={styles.readingRow}>
                <View style={styles.readingInfo}>
                  <Text style={styles.readingLabel}>{reading.label}</Text>
                  <Text style={styles.readingRange}>
                    Ideal: {reading.idealMin}–{reading.idealMax} {reading.unit}
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.readingInput,
                    readings[reading.key] &&
                      (parseFloat(readings[reading.key]) < reading.idealMin ||
                        parseFloat(readings[reading.key]) > reading.idealMax) &&
                      styles.readingInputWarning,
                  ]}
                  value={readings[reading.key] ?? ''}
                  onChangeText={(val) => setReadings((prev) => ({ ...prev, [reading.key]: val }))}
                  placeholder={reading.placeholder}
                  keyboardType="numeric"
                  placeholderTextColor="#CBD5E1"
                />
              </View>
            ))}
          </View>

          {/* Service Tasks */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✅ Service Tasks</Text>
            {SERVICE_TASKS.map((task) => (
              <View key={task.key} style={styles.switchRow}>
                <Text style={styles.switchLabel}>{task.label}</Text>
                <Switch
                  value={tasks[task.key] ?? false}
                  onValueChange={(val) => setTasks((prev) => ({ ...prev, [task.key]: val }))}
                  trackColor={{ false: '#E2E8F0', true: '#67E8F9' }}
                  thumbColor={tasks[task.key] ? '#0891B2' : '#94A3B8'}
                />
              </View>
            ))}
          </View>

          {/* Equipment Checks */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔧 Equipment Status</Text>
            {EQUIPMENT_CHECKS.map((equip) => (
              <View key={equip.key} style={styles.switchRow}>
                <Text style={styles.switchLabel}>{equip.label}</Text>
                <View style={styles.equipButtons}>
                  <TouchableOpacity
                    style={[styles.equipBtn, equipment[equip.key] === true && styles.equipBtnOk]}
                    onPress={() => setEquipment((prev) => ({ ...prev, [equip.key]: true }))}
                  >
                    <Text style={[styles.equipBtnText, equipment[equip.key] === true && styles.equipBtnTextActive]}>
                      OK
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.equipBtn, equipment[equip.key] === false && styles.equipBtnIssue]}
                    onPress={() => setEquipment((prev) => ({ ...prev, [equip.key]: false }))}
                  >
                    <Text style={[styles.equipBtnText, equipment[equip.key] === false && styles.equipBtnTextIssue]}>
                      Issue
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Chemicals Added */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧪 Chemicals Added</Text>
            <TextInput
              style={styles.textInput}
              value={chemicals.chlorine_added}
              onChangeText={(v) => setChemicals((p) => ({ ...p, chlorine_added: v }))}
              placeholder="Chlorine (e.g., 2 tabs, 1 lb shock)"
              placeholderTextColor="#CBD5E1"
            />
            <TextInput
              style={styles.textInput}
              value={chemicals.acid_added}
              onChangeText={(v) => setChemicals((p) => ({ ...p, acid_added: v }))}
              placeholder="Acid (e.g., 8 oz muriatic)"
              placeholderTextColor="#CBD5E1"
            />
            <TextInput
              style={styles.textInput}
              value={chemicals.other_chemicals}
              onChangeText={(v) => setChemicals((p) => ({ ...p, other_chemicals: v }))}
              placeholder="Other chemicals added"
              placeholderTextColor="#CBD5E1"
            />
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📷 Photos</Text>
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                <Ionicons name="camera" size={20} color="#0891B2" />
                <Text style={styles.photoBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                <Ionicons name="images" size={20} color="#0891B2" />
                <Text style={styles.photoBtnText}>From Gallery</Text>
              </TouchableOpacity>
            </View>
            {photos.length > 0 && (
              <ScrollView horizontal style={styles.photoScroll} showsHorizontalScrollIndicator={false}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoThumb}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => removePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={22} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Notes</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Service notes, observations, issues..."
              placeholderTextColor="#CBD5E1"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Follow-up */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>⚠️ Follow-up Needed</Text>
              <Switch
                value={followUp}
                onValueChange={setFollowUp}
                trackColor={{ false: '#E2E8F0', true: '#FCA5A5' }}
                thumbColor={followUp ? '#EF4444' : '#94A3B8'}
              />
            </View>
            {followUp && (
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={followUpNotes}
                onChangeText={setFollowUpNotes}
                placeholder="What needs follow-up?"
                placeholderTextColor="#CBD5E1"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSaveReport}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.saveButtonText}>Complete & Save Report</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertyHeader: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  address: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  gateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  gateCode: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
  },
  statusBar: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 12,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  readingInfo: {
    flex: 1,
  },
  readingLabel: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
  readingRange: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  readingInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: 'center',
    color: '#0F172A',
    backgroundColor: '#F9FAFB',
  },
  readingInputWarning: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  switchLabel: {
    fontSize: 15,
    color: '#0F172A',
  },
  equipButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  equipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  equipBtnOk: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  equipBtnIssue: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  equipBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  equipBtnTextActive: {
    color: '#10B981',
  },
  equipBtnTextIssue: {
    color: '#EF4444',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  textArea: {
    minHeight: 80,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#0891B2',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  photoBtnText: {
    color: '#0891B2',
    fontWeight: '600',
    fontSize: 14,
  },
  photoScroll: {
    flexDirection: 'row',
  },
  photoThumb: {
    position: 'relative',
    marginRight: 10,
  },
  photoImage: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 11,
  },
  saveButton: {
    backgroundColor: '#0891B2',
    borderRadius: 14,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
