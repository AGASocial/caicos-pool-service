/**
 * @jest-environment node
 */

jest.mock('@ai-sdk/groq', () => ({
  groq: Object.assign(jest.fn(() => ({ provider: 'mock' })), {
    transcription: jest.fn(() => ({ provider: 'mock-transcription' })),
  }),
}));

jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: { object: jest.fn((opts: unknown) => opts) },
  transcribe: jest.fn(),
}));

import {
  classificationForEmptyTranscript,
  classifyTranscript,
  isSilentOrEmptyTranscript,
  noteClassificationSchema,
} from '../classify';

describe('voice-notes classifier', () => {
  it('treats empty/silent transcripts as no speech without calling the model', async () => {
    expect(isSilentOrEmptyTranscript('')).toBe(true);
    expect(isSilentOrEmptyTranscript('   ')).toBe(true);
    expect(isSilentOrEmptyTranscript(null)).toBe(true);

    const result = await classifyTranscript('   ');
    expect(result).toMatchObject({
      category: 'routine',
      urgency: null,
      reason: 'no speech',
      modelId: 'none',
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(classificationForEmptyTranscript().reason).toBe('no speech');
  });

  it('parses valid classification schema', () => {
    const parsed = noteClassificationSchema.parse({
      category: 'problem',
      urgency: 'high',
      reason: 'pump noise',
      explanation: 'Technician reported unusual pump noise.',
    });
    expect(parsed.category).toBe('problem');
    expect(parsed.urgency).toBe('high');
  });

  it('rejects invalid category', () => {
    expect(() =>
      noteClassificationSchema.parse({
        category: 'alert',
        urgency: null,
        reason: 'x',
        explanation: 'y',
      }),
    ).toThrow();
  });
});
