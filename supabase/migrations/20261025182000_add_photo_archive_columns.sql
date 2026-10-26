-- Add archive-related columns to cadenza_report_photos for R2 archival support

ALTER TABLE public.cadenza_report_photos
  ADD COLUMN IF NOT EXISTS storage_tier text DEFAULT 'hot' CHECK (storage_tier IN ('hot', 'archive')),
  ADD COLUMN IF NOT EXISTS archive_key text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS thumb_path text;

COMMENT ON COLUMN public.cadenza_report_photos.storage_tier IS 'Storage tier: hot (Supabase) or archive (R2)';
COMMENT ON COLUMN public.cadenza_report_photos.archive_key IS 'R2 object key when archived';
COMMENT ON COLUMN public.cadenza_report_photos.archived_at IS 'Timestamp when photo was moved to archive';
COMMENT ON COLUMN public.cadenza_report_photos.size_bytes IS 'File size in bytes';
COMMENT ON COLUMN public.cadenza_report_photos.thumb_path IS 'Path to thumbnail image';

-- Create index for archive job queries (find photos older than N days in hot storage)
CREATE INDEX IF NOT EXISTS idx_report_photos_hot_old
  ON public.cadenza_report_photos (company_id, created_at)
  WHERE storage_tier = 'hot';

-- Create index for cleanup job queries (find photos beyond retention)
CREATE INDEX IF NOT EXISTS idx_report_photos_archive_old
  ON public.cadenza_report_photos (company_id, archived_at)
  WHERE storage_tier = 'archive';
