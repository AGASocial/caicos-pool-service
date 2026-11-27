/**
 * Cost estimates for voice-note providers (list prices, Nov 2026).
 * Groq Whisper turbo bills a 10-second minimum per request.
 */

export type PricingEntry = {
  /** USD per hour of audio (transcription) */
  audioUsdPerHour?: number;
  /** Minimum billed audio seconds (transcription) */
  minBilledAudioSeconds?: number;
  /** USD per 1M input tokens */
  inputPer1M?: number;
  /** USD per 1M output tokens */
  outputPer1M?: number;
};

export const VOICE_NOTES_PRICING: Record<string, PricingEntry> = {
  'whisper-large-v3-turbo': {
    audioUsdPerHour: 0.04,
    minBilledAudioSeconds: 10,
  },
  'whisper-large-v3': {
    audioUsdPerHour: 0.111,
    minBilledAudioSeconds: 10,
  },
  'openai/gpt-oss-20b': {
    inputPer1M: 0.075,
    outputPer1M: 0.3,
  },
  'openai/gpt-oss-120b': {
    inputPer1M: 0.15,
    outputPer1M: 0.6,
  },
};

export function billedAudioSeconds(
  durationSeconds: number,
  modelId = 'whisper-large-v3-turbo',
): number {
  const pricing = VOICE_NOTES_PRICING[modelId];
  const min = pricing?.minBilledAudioSeconds ?? 10;
  return Math.max(durationSeconds, min);
}

export function estimateTranscriptionCostUsd(
  durationSeconds: number,
  modelId = 'whisper-large-v3-turbo',
): number {
  const pricing = VOICE_NOTES_PRICING[modelId];
  const perHour = pricing?.audioUsdPerHour ?? 0.04;
  const billed = billedAudioSeconds(durationSeconds, modelId);
  return (billed / 3600) * perHour;
}

export function estimateClassificationCostUsd(
  inputTokens: number,
  outputTokens: number,
  modelId = 'openai/gpt-oss-20b',
): number {
  const pricing = VOICE_NOTES_PRICING[modelId] ?? VOICE_NOTES_PRICING['openai/gpt-oss-20b'];
  const inRate = pricing.inputPer1M ?? 0.075;
  const outRate = pricing.outputPer1M ?? 0.3;
  return (inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate;
}

export function roundUsd(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
