-- Create cadenza_report_videos table for video uploads (Pro plan feature)

CREATE TABLE IF NOT EXISTS public.cadenza_report_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  service_job_id uuid NOT NULL,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error_message text,
  raw_path text,
  file_path text,
  thumb_path text,
  duration_seconds integer,
  size_bytes bigint,
  compressed_size_bytes bigint,
  width integer,
  height integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_report_videos_job ON public.cadenza_report_videos(service_job_id);
CREATE INDEX IF NOT EXISTS idx_report_videos_company ON public.cadenza_report_videos(company_id);
CREATE INDEX IF NOT EXISTS idx_report_videos_status ON public.cadenza_report_videos(status) WHERE status IN ('pending', 'processing');

-- Add RLS policies
ALTER TABLE public.cadenza_report_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view videos from their company"
  ON public.cadenza_report_videos FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.cadenza_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert videos for their company"
  ON public.cadenza_report_videos FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.cadenza_profiles WHERE id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their own videos"
  ON public.cadenza_report_videos FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own videos"
  ON public.cadenza_report_videos FOR DELETE
  USING (created_by = auth.uid());

COMMENT ON TABLE public.cadenza_report_videos IS 'Video uploads for service reports (Pro plan only)';
COMMENT ON COLUMN public.cadenza_report_videos.status IS 'Video processing status: pending, processing, ready, failed';
COMMENT ON COLUMN public.cadenza_report_videos.raw_path IS 'Path to raw uploaded video';
COMMENT ON COLUMN public.cadenza_report_videos.file_path IS 'Path to compressed video';
COMMENT ON COLUMN public.cadenza_report_videos.duration_seconds IS 'Video duration in seconds (max 60 for Pro plan)';
