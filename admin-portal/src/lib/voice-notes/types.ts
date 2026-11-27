export type VoiceNoteStatus =
  | 'uploaded'
  | 'transcribing'
  | 'classifying'
  | 'done'
  | 'failed'
  | 'skipped_cap';

export type VoiceNoteCategory = 'problem' | 'routine';
export type VoiceNoteUrgency = 'low' | 'medium' | 'high';

export type VoiceNoteRow = {
  id: string;
  company_id: string;
  job_id: string;
  property_id: string | null;
  created_by: string;
  storage_path: string;
  duration_ms: number | null;
  size_bytes: number | null;
  mime_type: string | null;
  status: VoiceNoteStatus;
  transcript: string | null;
  language: string | null;
  transcribed_at: string | null;
  model_category: VoiceNoteCategory | null;
  model_urgency: VoiceNoteUrgency | null;
  model_reason: string | null;
  model_explanation: string | null;
  category: VoiceNoteCategory | null;
  urgency: VoiceNoteUrgency | null;
  corrected_by: string | null;
  corrected_at: string | null;
  cost_audio_seconds: number | null;
  cost_input_tokens: number | null;
  cost_output_tokens: number | null;
  cost_usd: number | null;
  providers: Record<string, unknown> | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export const VOICE_NOTES_BUCKET = 'job-voice-notes';
export const MAX_VOICE_NOTE_ATTEMPTS = 3;
