-- Profile photos for technicians (plain JPEG in assets bucket at {user_id}/avatar.jpg).
-- avatar_url on cadenza_profiles stores the storage object path.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets',
  'assets',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Colleagues in the same company can view profile avatars (admin portal / team views).
DROP POLICY IF EXISTS "Company members can view profile avatars" ON storage.objects;
CREATE POLICY "Company members can view profile avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'assets'
  AND name ~ '/avatar\.(jpg|jpeg|png|webp)$'
  AND EXISTS (
    SELECT 1
    FROM public.cadenza_profiles viewer
    JOIN public.cadenza_profiles owner
      ON owner.id = (storage.foldername(name))[1]::uuid
    WHERE viewer.id = auth.uid()
      AND viewer.company_id = owner.company_id
  )
);

COMMENT ON COLUMN public.cadenza_profiles.avatar_url IS
  'Storage path in assets bucket (e.g. {user_id}/avatar.jpg) or external URL from OAuth.';
