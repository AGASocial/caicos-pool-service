import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

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

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<{
    id: string;
    status: string;
    property_id: string;
    company_id: string;
    technician_id: string | null;
    properties?: { customer_name: string; address: string; gate_code: string | null } | null;
  } | null>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chemicals, setChemicals] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<Record<string, boolean>>({});
  const [equipment, setEquipment] = useState<Record<string, boolean>>(Object.fromEntries(EQUIPMENT.map((e) => [e.key, true])));
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    supabase
      .from('caicos_service_jobs')
      .select('id, status, property_id, company_id, technician_id, properties(customer_name, address, gate_code)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setJob(data as typeof job);
        setStarted((data as { status: string })?.status === 'in_progress' || (data as { status: string })?.status === 'completed');
      })
      .then(() => setLoading(false), () => setLoading(false));
  }, [id]);

  async function handleStart() {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('caicos_service_jobs').update({ status: 'in_progress' }).eq('id', id);
    setStarted(true);
  }

  async function handleComplete() {
    if (!id || !job) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const report: Record<string, unknown> = {
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
    const { data: reportRow, error: reportErr } = await supabase.from('caicos_service_reports').insert(report).select('id').single();
    if (reportErr) {
      setSaving(false);
      return;
    }
    await supabase.from('caicos_service_jobs').update({ status: 'completed' }).eq('id', id);
    setSaving(false);
    router.back();
  }

  if (loading || !job) {
    return (
      <View style={styles.center}>
        <Text>Loading job…</Text>
      </View>
    );
  }

  const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{prop?.customer_name ?? '—'}</Text>
        <Text style={styles.address}>{prop?.address ?? ''}</Text>
        {prop?.gate_code && <Text style={styles.gate}>Gate: {prop.gate_code}</Text>}
        <Text style={styles.status}>Status: {job.status}</Text>
      </View>

      {!started ? (
        <Pressable style={styles.startButton} onPress={handleStart}>
          <Text style={styles.startButtonText}>START</Text>
        </Pressable>
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
            multiline
          />

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 18, fontWeight: '600' },
  address: { fontSize: 14, color: '#666', marginTop: 4 },
  gate: { fontSize: 14, color: '#2563eb', marginTop: 4 },
  status: { fontSize: 12, color: '#888', marginTop: 4 },
  startButton: { backgroundColor: '#22c55e', margin: 16, padding: 16, borderRadius: 8, alignItems: 'center' },
  startButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 20, marginHorizontal: 16 },
  field: { marginHorizontal: 16, marginTop: 8 },
  label: { fontSize: 14, color: '#666' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginTop: 4 },
  textArea: { minHeight: 80 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 12 },
  taskLabel: { fontSize: 14 },
  completeButton: { backgroundColor: '#2563eb', margin: 16, padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  completeButtonText: { color: '#fff', fontWeight: '600' },
});
