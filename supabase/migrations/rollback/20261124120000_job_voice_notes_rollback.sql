-- Rollback for 20261124120000_job_voice_notes.sql (KAN-165)
-- Safe to run when the feature must be removed. Does not delete other buckets.

DROP POLICY IF EXISTS "Company users can delete job voice notes objects" ON storage.objects;
DROP POLICY IF EXISTS "Company users can update job voice notes objects" ON storage.objects;
DROP POLICY IF EXISTS "Company users can view job voice notes objects" ON storage.objects;
DROP POLICY IF EXISTS "Company users can upload job voice notes objects" ON storage.objects;

DELETE FROM storage.objects WHERE bucket_id = 'job-voice-notes';
DELETE FROM storage.buckets WHERE id = 'job-voice-notes';

DROP TRIGGER IF EXISTS set_updated_at ON public.cadenza_job_voice_notes;

DROP POLICY IF EXISTS "Office staff can update voice notes" ON public.cadenza_job_voice_notes;
DROP POLICY IF EXISTS "Technicians and office can insert voice notes" ON public.cadenza_job_voice_notes;
DROP POLICY IF EXISTS "Company users can view voice notes" ON public.cadenza_job_voice_notes;

DROP TABLE IF EXISTS public.cadenza_job_voice_notes;

ALTER TABLE public.cadenza_companies
  DROP COLUMN IF EXISTS voice_notes_monthly_cap_usd;
