/**
 * Voice-notes model factory (KAN-165).
 * Single vendor via @ai-sdk/groq; model IDs overridable by env.
 * Groq is loaded lazily so unit tests that only touch kill-switch / cost
 * do not need to transform the ESM provider package.
 */

export const DEFAULT_TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo';
export const DEFAULT_CLASSIFIER_MODEL = 'openai/gpt-oss-20b';

export function getTranscriptionModelId(): string {
  return (
    process.env.VOICE_NOTES_TRANSCRIPTION_MODEL?.trim() ||
    DEFAULT_TRANSCRIPTION_MODEL
  );
}

export function getClassifierModelId(): string {
  return (
    process.env.VOICE_NOTES_CLASSIFIER_MODEL?.trim() || DEFAULT_CLASSIFIER_MODEL
  );
}

export function getTranscriptionModel() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { groq } = require('@ai-sdk/groq') as typeof import('@ai-sdk/groq');
  return groq.transcription(getTranscriptionModelId());
}

export function getClassifierModel() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { groq } = require('@ai-sdk/groq') as typeof import('@ai-sdk/groq');
  return groq(getClassifierModelId());
}

export function isVoiceNotesAiEnabled(): boolean {
  return process.env.VOICE_NOTES_AI_ENABLED?.trim().toLowerCase() === 'true';
}

/** Stub provider for E2E / unit tests — never in production. */
export function isVoiceNotesFakeProvider(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.VOICE_NOTES_FAKE_PROVIDER?.trim() === '1'
  );
}
