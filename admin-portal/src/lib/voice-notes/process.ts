/**
 * Batch processor for pending voice notes (KAN-165 cron).
 * Status machine: uploaded → transcribing → classifying → done
 * Cap → skipped_cap; failures after MAX attempts → failed.
 */
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCompanyVoiceNotesCapStatus } from './cap';
import { classifyTranscript } from './classify';
import {
  estimateClassificationCostUsd,
  estimateTranscriptionCostUsd,
  billedAudioSeconds,
  roundUsd,
} from './cost';
import { markVoiceNoteProblemOpen } from './open-problems';
import { isVoiceNotesAiEnabled, isVoiceNotesFakeProvider } from './models';
import { transcribeVoiceNoteAudio } from './transcribe';
import {
  MAX_VOICE_NOTE_ATTEMPTS,
  VOICE_NOTES_BUCKET,
  type VoiceNoteRow,
} from './types';

export type ProcessVoiceNotesResult = {
  processed: number;
  skippedKillSwitch: boolean;
  results: Array<{
    id: string;
    status: string;
    error?: string;
  }>;
};

async function downloadAudio(storagePath: string): Promise<Uint8Array> {
  const { data, error } = await supabaseAdmin.storage
    .from(VOICE_NOTES_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(error?.message || 'Failed to download voice note audio');
  }

  const buffer = await data.arrayBuffer();
  return new Uint8Array(buffer);
}

async function markFailed(id: string, attempts: number, message: string) {
  const nextAttempts = attempts + 1;
  const status = nextAttempts >= MAX_VOICE_NOTE_ATTEMPTS ? 'failed' : 'uploaded';
  await supabaseAdmin
    .from('cadenza_job_voice_notes')
    .update({
      status,
      attempts: nextAttempts,
      last_error: message.slice(0, 2000),
    })
    .eq('id', id);
}

export async function processVoiceNote(
  note: VoiceNoteRow,
): Promise<{ status: string; error?: string }> {
  const cap = await getCompanyVoiceNotesCapStatus(note.company_id);
  if (cap.overCap) {
    await supabaseAdmin
      .from('cadenza_job_voice_notes')
      .update({
        status: 'skipped_cap',
        last_error: 'Monthly voice notes AI cap reached',
      })
      .eq('id', note.id);
    return { status: 'skipped_cap' };
  }

  try {
    await supabaseAdmin
      .from('cadenza_job_voice_notes')
      .update({ status: 'transcribing', last_error: null })
      .eq('id', note.id);

    const audio = await downloadAudio(note.storage_path);
    const transcription = await transcribeVoiceNoteAudio(audio);

    const durationSeconds =
      transcription.durationInSeconds ??
      (note.duration_ms != null ? note.duration_ms / 1000 : 10);

    const transcriptionCost = estimateTranscriptionCostUsd(
      durationSeconds,
      transcription.modelId.startsWith('fake')
        ? 'whisper-large-v3-turbo'
        : transcription.modelId,
    );

    await supabaseAdmin
      .from('cadenza_job_voice_notes')
      .update({
        status: 'classifying',
        transcript: transcription.text,
        language: transcription.language ?? null,
        transcribed_at: new Date().toISOString(),
        cost_audio_seconds: billedAudioSeconds(durationSeconds),
      })
      .eq('id', note.id);

    const classification = await classifyTranscript(transcription.text);

    const classificationCost = estimateClassificationCostUsd(
      classification.inputTokens,
      classification.outputTokens,
      classification.modelId.startsWith('fake')
        ? 'openai/gpt-oss-20b'
        : classification.modelId,
    );

    const costUsd = roundUsd(transcriptionCost + classificationCost);

    await supabaseAdmin
      .from('cadenza_job_voice_notes')
      .update({
        status: 'done',
        model_category: classification.category,
        model_urgency: classification.urgency,
        model_reason: classification.reason,
        model_explanation: classification.explanation,
        category: classification.category,
        urgency: classification.urgency,
        cost_input_tokens: classification.inputTokens,
        cost_output_tokens: classification.outputTokens,
        cost_usd: costUsd,
        providers: {
          transcription: transcription.modelId,
          classification: classification.modelId,
          fake: isVoiceNotesFakeProvider(),
        },
        attempts: note.attempts,
        last_error: null,
      })
      .eq('id', note.id);

    if (classification.category === 'problem') {
      await markVoiceNoteProblemOpen(note.id);
    }

    return { status: 'done' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    console.error('voice-notes: process failed:', note.id, message);
    await markFailed(note.id, note.attempts, message);
    return { status: 'failed', error: message };
  }
}

/**
 * Pick pending notes and process a batch.
 * Does nothing to providers unless VOICE_NOTES_AI_ENABLED === 'true'
 * (except the fake provider path when VOICE_NOTES_FAKE_PROVIDER=1 in non-production).
 */
export async function processPendingVoiceNotes(
  limit = 20,
): Promise<ProcessVoiceNotesResult> {
  const aiEnabled = isVoiceNotesAiEnabled() || isVoiceNotesFakeProvider();
  if (!aiEnabled) {
    return { processed: 0, skippedKillSwitch: true, results: [] };
  }

  const { data, error } = await supabaseAdmin
    .from('cadenza_job_voice_notes')
    .select('*')
    .in('status', ['uploaded', 'failed'])
    .lt('attempts', MAX_VOICE_NOTE_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('voice-notes: pending scan failed:', error.message);
    return { processed: 0, skippedKillSwitch: false, results: [] };
  }

  const results: ProcessVoiceNotesResult['results'] = [];
  for (const row of data ?? []) {
    const note = row as unknown as VoiceNoteRow;
    // failed rows with attempts still < max are retried as uploaded
    if (note.status === 'failed') {
      await supabaseAdmin
        .from('cadenza_job_voice_notes')
        .update({ status: 'uploaded' })
        .eq('id', note.id);
      note.status = 'uploaded';
    }
    const result = await processVoiceNote(note);
    results.push({ id: note.id, ...result });
  }

  return {
    processed: results.length,
    skippedKillSwitch: false,
    results,
  };
}
