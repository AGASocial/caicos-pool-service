# KAN-165 — Tasks (Jira: [KAN-165](https://agasocial.atlassian.net/browse/KAN-165))

- [x] T1. Migration: table, indexes, RLS, `voice_notes_monthly_cap_usd` default 5, private bucket and policies. Back up first, keep the rollback ready (AC-3, AC-10, AC-12)
- [x] T2. Technician app: the hold-to-record component with preview, re-record and the 120 s limit (AC-1, AC-3)
- [x] T3. Technician app: offline upload queue plus registration endpoint call (AC-2)
- [x] T4. API: register, list with signed URLs, correct, retry (AC-4, AC-8, AC-11, AC-12)
- [x] T5. AI layer via Vercel AI SDK (`ai` + `@ai-sdk/groq`): model factory with env overrides, `TranscriptionProvider` (`whisper-large-v3-turbo`, `verbose_json`), `NoteClassifier` (`openai/gpt-oss-20b`, strict JSON schema), single `GROQ_API_KEY` (AC-5, AC-6)
- [x] T6. Cron `process-voice-notes`: status machine, retries, cost (with 10 s min audio billing), $5/mo cap, `VOICE_NOTES_AI_ENABLED` kill switch (AC-6, AC-10, AC-11)
- [x] T7. Portal: VoiceNotes component on the job detail and the property history, badge, correction, search (AC-4, AC-7, AC-8, AC-9)
- [x] T8. KAN-153/154 integration on the effective category (AC-7, AC-8)
- [x] T9. Guard: notes excluded from customer reports and emails (AC-13)
- [x] T10. Tests: jest, RLS, E2E with video. PR, release, As built

## Traceability
| AC | Test |
|---|---|
| AC-1 | `technician-app/components/voice-notes/VoiceNoteRecorder.tsx` (hold/release/120s) + manual device check |
| AC-2 | `technician-app/lib/voiceNoteQueue.ts` (AsyncStorage + NetInfo flush on reconnect/start) |
| AC-3 | `VOICE_NOTE_RECORDING_OPTIONS` AAC/m4a mono 48 kbps + `e2e/fixtures/voice-note-sample.m4a` |
| AC-4 | `admin-portal/e2e/voice-notes.spec.ts` (player + transcript) |
| AC-5 | `admin-portal/src/lib/voice-notes/transcribe.ts` + process with fake provider in E2E |
| AC-6 | `admin-portal/src/lib/voice-notes/__tests__/classify.test.ts` + E2E badge |
| AC-7 | E2E problem badge + `admin-portal/src/lib/voice-notes/open-problems.ts` (`getOpenVoiceNoteProblems`) |
| AC-8 | `PATCH /api/voice-notes/[id]` + E2E correction |
| AC-9 | E2E search in `voice-notes.spec.ts` |
| AC-10 | `admin-portal/src/lib/voice-notes/__tests__/cost.test.ts`, `cap.test.ts` |
| AC-11 | `admin-portal/src/lib/voice-notes/__tests__/process.test.ts` + retry route |
| AC-12 | Migration RLS policies in `supabase/migrations/20261124120000_job_voice_notes.sql` |
| AC-13 | `admin-portal/src/lib/voice-notes/__tests__/customer-report-guard.test.ts` |
