-- Allow authenticated users to delete report photos only under their company folder
-- (used when removing a photo from the technician app so storage is cleaned up)
CREATE POLICY "Company users can delete report photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'report-photos'
  AND (storage.foldername(name))[1] = (SELECT company_id::text FROM caicos_profiles WHERE id = auth.uid())
);
