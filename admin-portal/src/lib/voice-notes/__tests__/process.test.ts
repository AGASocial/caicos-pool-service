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

const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

jest.mock('@/lib/supabase-admin', () => {
  const updateEq = (patch: Record<string, unknown>) => ({
    eq: jest.fn((_col: string, id: string) => {
      updates.push({ id, patch });
      // Awaitable, and also chainable for the guarded `.is('follow_up_status', null)` update.
      return Object.assign(Promise.resolve({ data: null, error: null }), {
        is: jest.fn(async () => ({ data: null, error: null })),
      });
    }),
  });

  return {
    supabaseAdmin: {
      from: (table: string) => {
        if (table === 'cadenza_companies') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { voice_notes_monthly_cap_usd: 5 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'cadenza_job_voice_notes') {
          return {
            select: () => ({
              eq: () => ({
                gte: () => ({
                  not: async () => ({ data: [], error: null }),
                }),
              }),
            }),
            update: (patch: Record<string, unknown>) => updateEq(patch),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      },
      storage: {
        from: () => ({
          download: jest.fn(async () => ({
            data: new Blob([new Uint8Array([1, 2, 3])]),
            error: null,
          })),
        }),
      },
    },
  };
});

jest.mock('../transcribe', () => ({
  transcribeVoiceNoteAudio: jest.fn(async () => ({
    text: 'The filter looked fine.',
    language: 'en',
    durationInSeconds: 12,
    modelId: 'fake-transcription',
  })),
}));

jest.mock('../classify', () => ({
  classifyTranscript: jest.fn(async () => ({
    category: 'routine',
    urgency: null,
    reason: 'routine visit note',
    explanation: 'No issues.',
    inputTokens: 10,
    outputTokens: 20,
    modelId: 'fake-classifier',
  })),
}));

function makeNote() {
  return {
    id: 'note-1',
    company_id: 'co-1',
    job_id: 'job-1',
    property_id: null,
    created_by: 'user-1',
    storage_path: 'co-1/job-1/note-1.m4a',
    duration_ms: 12000,
    size_bytes: 1000,
    mime_type: 'audio/mp4',
    status: 'uploaded' as const,
    transcript: null,
    language: null,
    transcribed_at: null,
    model_category: null,
    model_urgency: null,
    model_reason: null,
    model_explanation: null,
    category: null,
    urgency: null,
    corrected_by: null,
    corrected_at: null,
    cost_audio_seconds: null,
    cost_input_tokens: null,
    cost_output_tokens: null,
    cost_usd: null,
    providers: null,
    attempts: 0,
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('voice-notes process status machine', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    updates.length = 0;
    process.env = { ...originalEnv };
    process.env.VOICE_NOTES_AI_ENABLED = 'true';
    process.env.VOICE_NOTES_FAKE_PROVIDER = '1';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('moves uploaded → transcribing → classifying → done', async () => {
    const { processVoiceNote } = await import('../process');
    const result = await processVoiceNote(makeNote());

    expect(result.status).toBe('done');
    const statuses = updates.map((u) => u.patch.status).filter(Boolean);
    expect(statuses).toEqual(['transcribing', 'classifying', 'done']);
  });

  it('KAN-153: a note classified as problem is marked follow_up_status = open', async () => {
    const { classifyTranscript } = jest.requireMock('../classify') as { classifyTranscript: jest.Mock };
    classifyTranscript.mockResolvedValueOnce({
      category: 'problem',
      urgency: 'high',
      reason: 'pump leaking',
      explanation: 'Pump seal is leaking.',
      inputTokens: 10,
      outputTokens: 20,
      modelId: 'fake-classifier',
    });
    const { processVoiceNote } = await import('../process');
    const result = await processVoiceNote(makeNote());

    expect(result.status).toBe('done');
    const followUp = updates.filter((u) => u.patch.follow_up_status !== undefined);
    expect(followUp).toEqual([{ id: 'note-1', patch: { follow_up_status: 'open' } }]);
  });

  it('KAN-153: a routine note does not get a follow_up_status', async () => {
    const { processVoiceNote } = await import('../process');
    await processVoiceNote(makeNote());
    expect(updates.some((u) => u.patch.follow_up_status !== undefined)).toBe(false);
  });
});
