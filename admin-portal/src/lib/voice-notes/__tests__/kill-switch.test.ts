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

const mockFrom = jest.fn();

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: {
      from: () => ({
        download: jest.fn(),
      }),
    },
  },
}));

const mockTranscribe = jest.fn();
const mockClassify = jest.fn();

jest.mock('../transcribe', () => ({
  transcribeVoiceNoteAudio: (...args: unknown[]) => mockTranscribe(...args),
}));

jest.mock('../classify', () => ({
  classifyTranscript: (...args: unknown[]) => mockClassify(...args),
}));

describe('voice-notes kill switch', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    mockFrom.mockReset();
    mockTranscribe.mockReset();
    mockClassify.mockReset();
    process.env = { ...originalEnv };
    delete process.env.VOICE_NOTES_AI_ENABLED;
    delete process.env.VOICE_NOTES_FAKE_PROVIDER;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not call providers when VOICE_NOTES_AI_ENABLED is off', async () => {
    process.env.VOICE_NOTES_AI_ENABLED = 'false';
    delete process.env.VOICE_NOTES_FAKE_PROVIDER;

    const { processPendingVoiceNotes } = await import('../process');
    const result = await processPendingVoiceNotes(5);

    expect(result.skippedKillSwitch).toBe(true);
    expect(result.processed).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockTranscribe).not.toHaveBeenCalled();
    expect(mockClassify).not.toHaveBeenCalled();
  });
});
