-- KAN-165: Job voice notes (transcription + classification)
-- Additive only. Idempotent. Do not run against shared prod/develop from agent tooling —
-- apply via your normal migration process.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK (also in migrations/rollback/20261124120000_job_voice_notes_rollback.sql)
-- ---------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "Company users can delete job voice notes objects" ON storage.objects;
-- DROP POLICY IF EXISTS "Company users can update job voice notes objects" ON storage.objects;
-- DROP POLICY IF EXISTS "Company users can view job voice notes objects" ON storage.objects;
-- DROP POLICY IF EXISTS "Company users can upload job voice notes objects" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'job-voice-notes';
-- DROP TRIGGER IF EXISTS set_updated_at ON public.cadenza_job_voice_notes;
-- DROP POLICY IF EXISTS "Office staff can update voice notes" ON public.cadenza_job_voice_notes;
-- DROP POLICY IF EXISTS "Technicians and office can insert voice notes" ON public.cadenza_job_voice_notes;
-- DROP POLICY IF EXISTS "Company users can view voice notes" ON public.cadenza_job_voice_notes;
-- DROP TABLE IF EXISTS public.cadenza_job_voice_notes;
-- ALTER TABLE public.cadenza_companies DROP COLUMN IF EXISTS voice_notes_monthly_cap_usd;

-- ---------------------------------------------------------------------------
-- Company monthly AI cap (USD)
-- ---------------------------------------------------------------------------
ALTER TABLE public.cadenza_companies
  ADD COLUMN IF NOT EXISTS voice_notes_monthly_cap_usd NUMERIC NOT NULL DEFAULT 5;

COMMENT ON COLUMN public.cadenza_companies.voice_notes_monthly_cap_usd IS
  'Monthly USD budget for voice-note transcription/classification per company (default 5).';

-- ---------------------------------------------------------------------------
-- Voice notes table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cadenza_job_voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.cadenza_service_jobs(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.cadenza_properties(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.cadenza_profiles(id),
  storage_path TEXT NOT NULL,
  duration_ms INTEGER,
  size_bytes INTEGER,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'transcribing', 'classifying', 'done', 'failed', 'skipped_cap')),
  transcript TEXT,
  language TEXT,
  transcribed_at TIMESTAMPTZ,
  model_category TEXT CHECK (model_category IS NULL OR model_category IN ('problem', 'routine')),
  model_urgency TEXT CHECK (model_urgency IS NULL OR model_urgency IN ('low', 'medium', 'high')),
  model_reason TEXT,
  model_explanation TEXT,
  category TEXT CHECK (category IS NULL OR category IN ('problem', 'routine')),
  urgency TEXT CHECK (urgency IS NULL OR urgency IN ('low', 'medium', 'high')),
  corrected_by UUID REFERENCES public.cadenza_profiles(id),
  corrected_at TIMESTAMPTZ,
  cost_audio_seconds NUMERIC,
  cost_input_tokens INTEGER,
  cost_output_tokens INTEGER,
  cost_usd NUMERIC(10, 6),
  providers JSONB,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(transcript, ''))
  ) STORED
);

COMMENT ON TABLE public.cadenza_job_voice_notes IS
  'Internal technician voice notes on jobs: audio, transcript, and problem/routine classification.';

CREATE INDEX IF NOT EXISTS idx_cadenza_job_voice_notes_company_created
  ON public.cadenza_job_voice_notes (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cadenza_job_voice_notes_job
  ON public.cadenza_job_voice_notes (job_id);

CREATE INDEX IF NOT EXISTS idx_cadenza_job_voice_notes_status
  ON public.cadenza_job_voice_notes (status);

CREATE INDEX IF NOT EXISTS idx_cadenza_job_voice_notes_search
  ON public.cadenza_job_voice_notes USING GIN (search);

DROP TRIGGER IF EXISTS set_updated_at ON public.cadenza_job_voice_notes;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.cadenza_job_voice_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.cadenza_job_voice_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company users can view voice notes"
  ON public.cadenza_job_voice_notes;
CREATE POLICY "Company users can view voice notes"
  ON public.cadenza_job_voice_notes FOR SELECT
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "Technicians and office can insert voice notes"
  ON public.cadenza_job_voice_notes;
CREATE POLICY "Technicians and office can insert voice notes"
  ON public.cadenza_job_voice_notes FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND (
      public.get_my_role() IN ('owner', 'admin', 'operations')
      OR (
        created_by = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.cadenza_service_jobs j
          WHERE j.id = job_id
            AND j.company_id = company_id
            AND j.technician_id = auth.uid()
            AND COALESCE(j.is_deleted, false) = false
        )
      )
    )
  );

DROP POLICY IF EXISTS "Office staff can update voice notes"
  ON public.cadenza_job_voice_notes;
CREATE POLICY "Office staff can update voice notes"
  ON public.cadenza_job_voice_notes FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
  )
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
  );

-- ---------------------------------------------------------------------------
-- Private storage bucket
-- Path: {company_id}/{job_id}/{note_id}.m4a
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-voice-notes',
  'job-voice-notes',
  false,
  5242880,
  ARRAY[
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/mpeg'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = EXCLUDED.public;

DROP POLICY IF EXISTS "Company users can upload job voice notes objects"
  ON storage.objects;
CREATE POLICY "Company users can upload job voice notes objects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-voice-notes'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.cadenza_profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Company users can view job voice notes objects"
  ON storage.objects;
CREATE POLICY "Company users can view job voice notes objects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-voice-notes'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.cadenza_profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Company users can update job voice notes objects"
  ON storage.objects;
CREATE POLICY "Company users can update job voice notes objects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'job-voice-notes'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.cadenza_profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'job-voice-notes'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.cadenza_profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Company users can delete job voice notes objects"
  ON storage.objects;
CREATE POLICY "Company users can delete job voice notes objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'job-voice-notes'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.cadenza_profiles WHERE id = auth.uid()
  )
);
