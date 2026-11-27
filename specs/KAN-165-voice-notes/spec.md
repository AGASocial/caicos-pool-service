# KAN-165 — Voice notes on jobs, with transcription and classification

- Jira: [KAN-165](https://agasocial.atlassian.net/browse/KAN-165) (customer details stay in Jira)
- Status: Built (provider and cap decisions approved Nov 23, 2026; spec written before code)
- Apps: technician-app (Expo), admin-portal (Next.js), Supabase
- Related: KAN-153 (open-issue carry-forward), KAN-154 (Monday digest)

## Problem
Technicians can only leave typed notes on a job. Typing in the field is slow, so useful details (damaged equipment, chemistry out of range, blocked access, billable extras) get lost. The office also has no quick way to tell which notes need action and which are routine.

## Scope (v1)
1. Hold-to-record voice notes on a job in the technician app (WhatsApp style), up to 2 minutes, compressed m4a/AAC.
2. Preview, re-record, and delete a note before it is uploaded.
3. Offline-safe upload queue to Supabase Storage. Notes appear in the portal once the device reconnects.
4. Automatic transcription (Spanish and English, language auto-detected).
5. Automatic classification of each transcript as **problem** or **routine**, with a one-line reason, an urgency level (problems only), and a short explanation.
6. Portal: audio player plus transcript and classification on the job detail and in the property history. A visible flag for problems.
7. The admin can correct the classification (and the urgency). The correction is stored as feedback.
8. Problems feed the KAN-153 open-issue list and the KAN-154 Monday digest. Routine notes are archived and searchable, with no alert.
9. Cost per note is measured and stored, with a per-company monthly cap ($5/month default) and an environment kill switch (`VOICE_NOTES_AI_ENABLED`, off by default).

Out of scope: sending notes or transcripts to end customers (notes are internal), live/streaming transcription, speaker diarization, translation.

## Requirements
- R1. Recording starts on press-and-hold of the mic button and stops on release. Sliding away cancels it. Hard stop at 120 s.
- R2. Audio is saved as AAC in an .m4a container, mono, 32–64 kbps.
- R3. Each note belongs to one job and one company. RLS isolates companies.
- R4. Upload is retried with backoff until it succeeds. A note recorded offline is never lost when the app restarts.
- R5. After upload, the server transcribes the note, then classifies the transcript. Each step updates the note status.
- R6. Provider failures are retried up to 3 times. After that the note is shown with "transcription unavailable", and the audio stays playable.
- R7. Cost (audio seconds, tokens, USD estimate) is recorded per note. When a company exceeds its monthly cap ($5 default), new notes are stored and playable, but not transcribed, and the admin sees why.
- R8. Admin corrections overwrite the effective classification and keep the model's original output for comparison.
- R9. Notes never go into customer reports or customer emails.

## Acceptance criteria
- AC-1. A technician can hold to record, release to stop, preview, re-record or discard, and save a note of up to 120 s on a job. Recording stops by itself at 120 s.
- AC-2. A note saved without connectivity is uploaded automatically once connectivity returns, including after an app restart.
- AC-3. The saved file is m4a/AAC, and a 120 s note is under 1.5 MB.
- AC-4. In the portal, the job detail and the property history show the note with an audio player and its transcript.
- AC-5. Spanish and English notes are transcribed in their own language, and the detected language is stored.
- AC-6. Every transcribed note has a classification (problem or routine) with a one-line reason and a short explanation. Problems also have an urgency (low, medium, high).
- AC-7. Problems are flagged visibly in the portal and appear in the KAN-153 open-issue list and the KAN-154 Monday digest. Routine notes create no alert.
- AC-8. An admin can change problem/routine and the urgency. The change is saved with who made it and when, the model's original output is kept, and KAN-153/154 follow the corrected value.
- AC-9. Routine and problem notes are searchable by transcript text in the portal.
- AC-10. Each note stores audio seconds, provider, model, tokens, and estimated USD cost. Over the company's monthly cap, new notes skip transcription and show the reason.
- AC-11. Provider failure leaves the note playable with status "transcription unavailable" after 3 retries, and the admin can retry manually.
- AC-12. A user of another company cannot read, play, or list another company's notes (RLS and signed URLs).
- AC-13. Notes never appear in customer-facing reports or emails.

## Data model (proposed)
New table `cadenza_job_voice_notes`:
- `id uuid pk`, `company_id uuid fk`, `job_id uuid fk`, `property_id uuid null`, `created_by uuid` (technician)
- `storage_path text`, `duration_ms int`, `size_bytes int`, `mime_type text`
- `status text` CHECK in (`uploaded`, `transcribing`, `classifying`, `done`, `failed`, `skipped_cap`)
- `transcript text`, `language text`, `transcribed_at timestamptz`
- `model_category text` CHECK in (`problem`, `routine`), `model_urgency text` CHECK in (`low`, `medium`, `high`) null, `model_reason text`, `model_explanation text`
- `category text`, `urgency text` (effective values, after any correction)
- `corrected_by uuid null`, `corrected_at timestamptz null`
- `cost_audio_seconds numeric`, `cost_input_tokens int`, `cost_output_tokens int`, `cost_usd numeric(10,6)`, `providers jsonb`
- `attempts int default 0`, `last_error text`, `created_at`, `updated_at`
- `search tsvector` generated from transcript (simple config, works for es and en), with a GIN index

Company setting: `voice_notes_monthly_cap_usd numeric default 5` (approved Nov 23, 2026).

Storage: private bucket `job-voice-notes`, path `{company_id}/{job_id}/{note_id}.m4a`. Playback goes through short-lived signed URLs.

## API (proposed)
- `POST /api/jobs/{id}/voice-notes`: technician registers an uploaded note and enqueues processing.
- `POST /api/cron/process-voice-notes` (CRON_SECRET): picks pending notes, transcribes, classifies, records cost.
- `GET /api/jobs/{id}/voice-notes`: list with signed URLs (admin, technician of the job).
- `PATCH /api/voice-notes/{id}`: admin correction of category and urgency.
- `POST /api/voice-notes/{id}/retry`: admin manual retry.

## Edge cases
- Empty or silent audio: the transcript is empty (or `no_speech_prob` indicates silence), it's classified routine with the reason "no speech", and there's no alert.
- Mixed Spanish and English in one note: one transcript in the dominant language.
- A job deleted after the note: the note cascades with the job, and the storage object is removed by the cleanup job.
- A duplicate upload after a retry: idempotent on the client-generated note id.
- A cap reached in the middle of the month: the note gets `skipped_cap` and the admin can still listen.

## As built
- PR: [#37](https://github.com/AGASocial/caicos-pool-service/pull/37) (develop)
- Jira: [KAN-165](https://agasocial.atlassian.net/browse/KAN-165)
- Migration: `supabase/migrations/20261124120000_job_voice_notes.sql` (applied; rollback in `supabase/migrations/rollback/20261124120000_job_voice_notes_rollback.sql`)
- AI layer: Vercel AI SDK (`ai` + `@ai-sdk/groq`), default `whisper-large-v3-turbo` + `openai/gpt-oss-20b`, `$5/mo` per-company cap, `VOICE_NOTES_AI_ENABLED` off by default.
- Cron: `GET /api/cron/process-voice-notes` (`* * * * *` in `admin-portal/vercel.json`, Bearer `CRON_SECRET`).
- Verification: `admin-portal` lint/tsc/jest (49 suites, 239 tests), `technician-app` tsc, Playwright E2E (`e2e/voice-notes.spec.ts`) with recording on `e2e-media`.
