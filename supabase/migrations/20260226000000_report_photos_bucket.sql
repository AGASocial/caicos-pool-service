-- Report photos & videos storage bucket for technician app
-- Path: {company_id}/{yyyy-mm-dd}/{property_id}/{timestamp}-{random}.jpg
-- Example: 21ca3138-999e-42cf-833c-d905195dd905/2026-02-26/{property-uuid}/1739...-abc.jpg
-- Table caicos_report_photos stores metadata (report_id, company_id, storage_path).
-- Max 20MB per file; images (jpeg, png, webp) and videos (mp4, mov, avi, webm, 3gp).

-- Create bucket (private; access via RLS)
-- 20MB max; images + videos (mp4, mov, avi, webm, 3gp)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-photos',
  'report-photos',
  false,
  20971520,  -- 20MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/3gpp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow authenticated users to upload only under their company folder
CREATE POLICY "Company users can upload report photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'report-photos'
  AND (storage.foldername(name))[1] = (SELECT company_id::text FROM caicos_profiles WHERE id = auth.uid())
);

-- Allow authenticated users to read only their company's photos
CREATE POLICY "Company users can view report photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'report-photos'
  AND (storage.foldername(name))[1] = (SELECT company_id::text FROM caicos_profiles WHERE id = auth.uid())
);
