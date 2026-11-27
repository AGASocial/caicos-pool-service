# KAN-165 — Plan

## Architecture
1. **Technician app:** an `expo-audio` recorder with an AAC/m4a preset (mono, 44.1 kHz, 48 kbps) and a hold-to-record button on the job detail. Each note gets a client UUID and is saved in a local queue (file plus metadata in AsyncStorage). The uploader sends it to Storage with a resumable/standard upload, then calls `POST /api/jobs/{id}/voice-notes`. It retries with backoff on reconnect, using NetInfo.
2. **AI layer (Vercel AI SDK):** implemented in `admin-portal` using `ai` + `@ai-sdk/groq` behind a single provider/model factory (`lib/ai/voice-notes-models.ts`), so models or providers can be swapped cleanly via config or env overrides without rewriting call sites:
   - **Transcription:** AI SDK `transcribe` (verified against installed `node_modules/ai/docs/`) with `groq.transcription(modelId)` (default `whisper-large-v3-turbo`) and `providerOptions: { groq: { responseFormat: 'verbose_json' } }`, returning transcript, detected `language`, `durationInSeconds`, and segments.
   - **Classification:** AI SDK `generateText` with structured schema output (verified against installed `node_modules/ai/docs/`) using `groq(modelId)` (default `openai/gpt-oss-20b`), returning `{category, urgency, reason, explanation}`.
3. **Processing:** a Vercel cron `process-voice-notes` runs every minute (same pattern and `CRON_SECRET` as KAN-148/151). It takes a batch with `FOR UPDATE SKIP LOCKED`, checks `VOICE_NOTES_AI_ENABLED` and the company monthly cap, downloads the audio with the service role, transcribes and classifies through the AI SDK layer, stores results and cost (accounting for Groq's 10 s minimum billed audio duration plus input/output tokens), and sets the effective category and urgency.
4. **Portal:** a `VoiceNotes` component on the job detail and the property history (player, transcript, badge, correction menu), a search box over `search`, and KAN-153/154 queries that read the effective `category = 'problem'`.
5. **Kill switch:** `VOICE_NOTES_AI_ENABLED` (default off, the same pattern as ADR-5 of KAN-151). When it is unset or not `"true"`, notes are stored and playable but not sent to providers.

## Provider options and cost per note
Prices are list, pay-as-you-go prices from each provider's official pricing/docs page, checked Nov 23, 2026. Cost assumes an average note of 30 s and the maximum of 120 s.

### Transcription
| Option | Price | 30 s note | 120 s note | Notes |
|---|---|---|---|---|
| **Groq `whisper-large-v3-turbo` via `@ai-sdk/groq` (selected)** | $0.04/hour (~$0.00067/min), min. 10 s billed | $0.00033 | $0.00133 | Selected Nov 23, 2026. Lowest cost, multilingual es/en, 12% WER on Groq's table, up to 25 MB (free) / 100 MB (dev) |
| Groq `whisper-large-v3` | $0.111/hour (~$0.00185/min), min. 10 s billed | $0.00093 | $0.00370 | Same vendor/key drop-in upgrade if field audio needs lower WER (10.3%) |
| OpenAI `gpt-transcribe` | $0.0045/min | $0.00225 | $0.0090 | Alternative provider behind Vercel AI SDK |
| Deepgram Nova-3 multilingual (pre-recorded) | $0.0052/min | $0.0026 | $0.0104 | Alternative provider behind Vercel AI SDK |
| OpenAI `gpt-4o-mini-transcribe` | ~$0.003/min | $0.0015 | $0.0060 | **Deprecated**, shuts down Feb 26, 2027. Not for new work |

### Analysis (classification)
Prompt about 700 input tokens (instructions plus a transcript of <= 2 min) and about 150–300 output tokens (including low reasoning tokens on reasoning models).
| Option | Price per 1M tokens (in/out) | Per note | Notes |
|---|---|---|---|
| **Groq `openai/gpt-oss-20b` via `@ai-sdk/groq` (selected)** | $0.075 / $0.30 | ~$0.00010–$0.00014 | Production model on Groq, supports Structured Outputs (`strict: true`), same `GROQ_API_KEY` |
| Groq `openai/gpt-oss-120b` | $0.15 / $0.60 | ~$0.00020–$0.00029 | In-vendor escalation if correction rate warrants a larger model; supports `strict: true` |
| OpenAI `gpt-5.4-nano` | $0.20 / $1.25 | ~$0.00033 | Alternative provider behind Vercel AI SDK (requires `OPENAI_API_KEY`) |
| OpenAI `gpt-5.4-mini` | $0.75 / $4.50 | ~$0.0012 | Higher cost, second vendor |
| OpenAI `gpt-5-nano` | $0.05 / $0.40 | ~$0.00010 | **Deprecated** |

### Selected stack (approved Nov 23, 2026)
- **Vercel AI SDK (`ai` + `@ai-sdk/groq`) — single vendor, swappable models:**
  - Transcription: `groq.transcription('whisper-large-v3-turbo')` (overridable via `VOICE_NOTES_TRANSCRIPTION_MODEL`).
  - Classification: `groq('openai/gpt-oss-20b')` with strict JSON schema (overridable via `VOICE_NOTES_CLASSIFIER_MODEL`).
  - Both run through `@ai-sdk/groq` using one key (`GROQ_API_KEY`), with no `OPENAI_API_KEY` required. Switching to another Groq model is an env change; switching to another AI SDK provider is a one-file change in the model factory.
  - Combined cost: about **$0.00043–$0.00047** for an average 30 s note (~$0.45 per 1,000 average notes), and about **$0.00147** for a max 120 s note.
- **Monthly cap:** **$5/month per company** (default, configurable per company) — roughly 10,000–11,000 average 30 s notes per company per month.
- **Kill switch:** `VOICE_NOTES_AI_ENABLED` off by default.

## Migration
`supabase/migrations/2026112xxxxxxx_job_voice_notes.sql`: the table, indexes, RLS, the company cap column (`voice_notes_monthly_cap_usd numeric default 5`), the private storage bucket and its policies.
- Before applying: back up the affected objects. The change is additive only.
- Rollback: drop the table, the bucket policies, the bucket (if it's empty), and the cap column.
- Apply manually (never from CI), and verify afterward.

## Testing
- Jest: the cap and cost calculation (including Groq's 10 s minimum billed audio rule), parsing/validating the classification output, the status machine, and the Vercel AI SDK adapters with mocked models.
- RLS tests through the service role with two ephemeral companies.
- Technician app: unit tests for the queue and its retry.
- Playwright E2E with a recorded video, on an ephemeral `qa-billing-*` tenant: upload a fixture m4a, run the cron with stub providers, check the portal player, transcript, badge, correction, and search.

## Environment variables (Vercel)
Gabriel sets production variables directly in Vercel (never changed by the assistant):
- `GROQ_API_KEY` (required, secret — Preview and Production): read automatically by `@ai-sdk/groq` for both transcription and classification. **`OPENAI_API_KEY` is not needed.**
- `VOICE_NOTES_AI_ENABLED` (kill switch, default off): leave unset or `"false"` until ready to process notes; set to `"true"` to enable AI transcription and classification.
- `VOICE_NOTES_TRANSCRIPTION_MODEL` (optional, default `whisper-large-v3-turbo`): override Groq transcription model without code changes.
- `VOICE_NOTES_CLASSIFIER_MODEL` (optional, default `openai/gpt-oss-20b`): override Groq classification model without code changes.
- `CRON_SECRET`: reuses the existing Vercel cron secret already configured for scheduled jobs.
