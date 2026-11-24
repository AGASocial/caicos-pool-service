# KAN-165 — Tasks (Jira: [KAN-165](https://agasocial.atlassian.net/browse/KAN-165))

- [ ] T1. Migration: table, indexes, RLS, `voice_notes_monthly_cap_usd` default 5, private bucket and policies. Back up first, keep the rollback ready (AC-3, AC-10, AC-12)
- [ ] T2. Technician app: the hold-to-record component with preview, re-record and the 120 s limit (AC-1, AC-3)
- [ ] T3. Technician app: offline upload queue plus registration endpoint call (AC-2)
- [ ] T4. API: register, list with signed URLs, correct, retry (AC-4, AC-8, AC-11, AC-12)
- [ ] T5. AI layer via Vercel AI SDK (`ai` + `@ai-sdk/groq`): model factory with env overrides, `TranscriptionProvider` (`whisper-large-v3-turbo`, `verbose_json`), `NoteClassifier` (`openai/gpt-oss-20b`, strict JSON schema), single `GROQ_API_KEY` (AC-5, AC-6)
- [ ] T6. Cron `process-voice-notes`: status machine, retries, cost (with 10 s min audio billing), $5/mo cap, `VOICE_NOTES_AI_ENABLED` kill switch (AC-6, AC-10, AC-11)
- [ ] T7. Portal: VoiceNotes component on the job detail and the property history, badge, correction, search (AC-4, AC-7, AC-8, AC-9)
- [ ] T8. KAN-153/154 integration on the effective category (AC-7, AC-8)
- [ ] T9. Guard: notes excluded from customer reports and emails (AC-13)
- [ ] T10. Tests: jest, RLS, E2E with video. PR, release, As built

## Traceability
| AC | Test |
|---|---|
| AC-1 | technician-app recorder unit test + manual device check |
| AC-2 | technician-app queue test (offline -> online, restart) |
| AC-3 | recorder preset test + fixture size check |
| AC-4 | E2E portal player and transcript |
| AC-5 | Vercel AI SDK Groq transcription adapter tests with es and en fixtures |
| AC-6 | Vercel AI SDK Groq classifier parse/strict-schema tests + E2E badge |
| AC-7 | E2E problem flag + KAN-153/154 query tests |
| AC-8 | API correction test + E2E correction |
| AC-9 | E2E search |
| AC-10 | cost/cap unit tests (including 10 s minimum billing) |
| AC-11 | cron retry test with failing provider stub |
| AC-12 | RLS test with two companies |
| AC-13 | customer-report builder test excludes notes |
