/**
 * Note classifier via AI SDK generateText + Output.object (strict schema).
 */
import { generateText, Output } from 'ai';
import { z } from 'zod';
import {
  getClassifierModel,
  getClassifierModelId,
  isVoiceNotesFakeProvider,
} from './models';

export const noteClassificationSchema = z.object({
  category: z.enum(['problem', 'routine']),
  urgency: z.enum(['low', 'medium', 'high']).nullable(),
  reason: z.string(),
  explanation: z.string(),
});

export type NoteClassification = z.infer<typeof noteClassificationSchema>;

export type ClassifyResult = NoteClassification & {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
};

const NO_SPEECH: NoteClassification = {
  category: 'routine',
  urgency: null,
  reason: 'no speech',
  explanation: 'The audio contained no detectable speech.',
};

export function isSilentOrEmptyTranscript(transcript: string | null | undefined): boolean {
  return !transcript || !transcript.trim();
}

export function classificationForEmptyTranscript(): ClassifyResult {
  return {
    ...NO_SPEECH,
    inputTokens: 0,
    outputTokens: 0,
    modelId: 'none',
  };
}

const SYSTEM_PROMPT = `You classify pool-service technician voice notes for an office queue.
Return JSON with:
- category: "problem" if the note reports equipment damage, chemistry out of range, blocked access, safety issues, customer complaints, billable extras that need office action, or anything that needs follow-up; otherwise "routine".
- urgency: for problems only — "low", "medium", or "high"; for routine always null.
- reason: one short line summarizing why.
- explanation: one or two short sentences of context.
Never invent customer names or addresses.`;

export async function classifyTranscript(
  transcript: string,
  opts?: { model?: ReturnType<typeof getClassifierModel> },
): Promise<ClassifyResult> {
  if (isSilentOrEmptyTranscript(transcript)) {
    return classificationForEmptyTranscript();
  }

  if (isVoiceNotesFakeProvider()) {
    const lower = transcript.toLowerCase();
    const isProblem =
      /broken|leak|damage|urgent|blocked|fail|alarm|problem|issue/.test(lower);
    return {
      category: isProblem ? 'problem' : 'routine',
      urgency: isProblem ? 'medium' : null,
      reason: isProblem ? 'possible issue flagged' : 'routine visit note',
      explanation: isProblem
        ? 'Stub classifier marked this as a problem for testing.'
        : 'Stub classifier marked this as routine for testing.',
      inputTokens: 10,
      outputTokens: 20,
      modelId: 'fake-classifier',
    };
  }

  const model = opts?.model ?? getClassifierModel();
  const modelId = getClassifierModelId();

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema: noteClassificationSchema }),
    system: SYSTEM_PROMPT,
    prompt: `Classify this technician voice note transcript:\n\n${transcript}`,
    providerOptions: {
      groq: {
        structuredOutputs: true,
        strictJsonSchema: true,
      },
    },
  });

  if (!output) {
    throw new Error('Classifier returned no structured output');
  }

  const parsed = noteClassificationSchema.parse(output);
  const urgency =
    parsed.category === 'routine' ? null : (parsed.urgency ?? 'medium');

  return {
    ...parsed,
    urgency,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    modelId,
  };
}
