-- Legacy Caicos assets bucket policies. storage.objects is owned by Supabase;
-- RLS is already enabled on hosted projects. Skip steps that require table ownership.

DO $$
BEGIN
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'storage.objects RLS already managed by Supabase; skipping ALTER';
END $$;

DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
