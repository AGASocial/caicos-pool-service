# KAN-165 — Decisions (ADR)

## ADR-1: AI SDK abstraction and transcription provider
- Status: Approved (Nov 23, 2026)
- Context: es/en field audio of up to 2 min; cost must stay low; want easy model/provider switching later without rewriting business logic.
- Options: Direct REST client vs Vercel AI SDK (`ai` + `@ai-sdk/groq`). Transcription models: Groq `whisper-large-v3-turbo` ($0.04/hr, ~$0.00067/min, min. 10 s billed), Groq `whisper-large-v3` ($0.111/hr), OpenAI `gpt-transcribe` ($0.0045/min), Deepgram Nova-3 multilingual ($0.0052/min).
- Decision: Use **Vercel AI SDK (`ai` + `@ai-sdk/groq`)** with **`whisper-large-v3-turbo`** (`responseFormat: 'verbose_json'`), behind a `TranscriptionProvider` wrapper and configurable model ID (`VOICE_NOTES_TRANSCRIPTION_MODEL`). Note: direct `@ai-sdk/groq` is used because AI Gateway does not expose Groq's transcription endpoint.

## ADR-2: Analysis model
- Status: Approved (Nov 23, 2026)
- Context: binary classification (`problem` | `routine`) plus urgency, reason, and explanation, as strict structured JSON; keep one vendor/key and allow effortless model swaps via Vercel AI SDK.
- Options: Groq `openai/gpt-oss-20b` ($0.075/$0.30 per 1M tokens, `strict: true`), Groq `openai/gpt-oss-120b` ($0.15/$0.60, `strict: true`), OpenAI `gpt-5.4-nano` ($0.20/$1.25), OpenAI `gpt-5.4-mini` ($0.75/$4.50).
- Decision: **Groq `openai/gpt-oss-20b`** via Vercel AI SDK (`ai` + `@ai-sdk/groq`) with strict JSON schema output, behind a `NoteClassifier` wrapper and configurable model ID (`VOICE_NOTES_CLASSIFIER_MODEL`). Shares `GROQ_API_KEY`. Escalate to `openai/gpt-oss-120b` via env var (or another AI SDK provider in the model factory) if admin correction rates show poor accuracy.

## ADR-3: Asynchronous processing via cron
- Status: Approved
- Context: an upload shouldn't wait on provider latency; retries and the cap need central control.
- Decision: a per-minute Vercel cron with `FOR UPDATE SKIP LOCKED` batching, the same pattern as KAN-148/151.

## ADR-4: Cost control and kill switch
- Status: Approved (Nov 23, 2026)
- Decision: store cost per note (respecting Groq's 10 s minimum audio billing and token usage); per-company monthly cap default **$5/month** (over the cap, the note is stored and playable with `skipped_cap`); kill switch `VOICE_NOTES_AI_ENABLED` default off.

## ADR-5: Corrections as feedback
- Status: Approved
- Decision: keep the model output (`model_*`) and the effective values (`category`, `urgency`) separately. KAN-153/154 read the effective values. The correction rate is used to evaluate the model.

## ADR-6: Notes are internal
- Status: Approved
- Decision: notes and transcripts are never included in customer reports or emails (AC-13).

## ADR-7: Audio-mode switching for recording vs playback
- Status: Approved (Nov 27, 2026)
- Context: with expo-audio on iOS, `allowsRecording: true` routes audio to the receiver/earpiece. Leaving that mode on after recording made preview playback come out of the earpiece.
- Decision: use `setAudioModeAsync` from expo-audio. Playback mode: `{ allowsRecording: false, playsInSilentMode: true, shouldRouteThroughEarpiece: false }`. Recording mode: `{ allowsRecording: true, playsInSilentMode: true }`, applied only for the duration of a take. Helpers live in `technician-app/lib/voiceNoteAudioMode.ts`.
