/**
 * Transcription via AI SDK transcribe + Groq whisper.
 */
import { transcribe } from 'ai';
import {
  getTranscriptionModel,
  getTranscriptionModelId,
  isVoiceNotesFakeProvider,
} from './models';

export type TranscriptionResult = {
  text: string;
  language: string | undefined;
  durationInSeconds: number | undefined;
  modelId: string;
};

export async function transcribeVoiceNoteAudio(
  audio: Uint8Array | ArrayBuffer | Buffer,
  opts?: { model?: ReturnType<typeof getTranscriptionModel> },
): Promise<TranscriptionResult> {
  if (isVoiceNotesFakeProvider()) {
    return {
      text: 'Stub transcript: filter looked fine, all clear.',
      language: 'en',
      durationInSeconds: 12,
      modelId: 'fake-transcription',
    };
  }

  const model = opts?.model ?? getTranscriptionModel();
  const modelId = getTranscriptionModelId();

  const result = await transcribe({
    model,
    audio,
    providerOptions: {
      groq: {
        responseFormat: 'verbose_json',
      },
    },
  });

  return {
    text: result.text ?? '',
    language: result.language,
    durationInSeconds: result.durationInSeconds,
    modelId,
  };
}
