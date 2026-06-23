import { supabase } from '@/lib/supabase';
import { getUploadBodyFromUri } from '@/lib/uploadPhoto';

export const PROFILE_AVATAR_BUCKET = 'assets';

export function profileAvatarStoragePath(userId: string): string {
  return `${userId}/avatar.jpg`;
}

export function isStorageAvatarPath(value: string): boolean {
  return !/^https?:\/\//i.test(value);
}

export async function getProfileAvatarSignedUrl(avatarUrl: string | null): Promise<string | null> {
  if (!avatarUrl) return null;
  if (!isStorageAvatarPath(avatarUrl)) return avatarUrl;

  const { data, error } = await supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .createSignedUrl(avatarUrl, 3600);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function uploadProfileAvatar(userId: string, localUri: string): Promise<string> {
  const path = profileAvatarStoragePath(userId);
  const body = await getUploadBodyFromUri(localUri);
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) throw uploadError;

  const { error: profileError } = await supabase
    .from('cadenza_profiles')
    .update({ avatar_url: path })
    .eq('id', userId);

  if (profileError) throw profileError;
  return path;
}

export async function removeProfileAvatar(userId: string): Promise<void> {
  const path = profileAvatarStoragePath(userId);
  await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([path]);
  const { error } = await supabase
    .from('cadenza_profiles')
    .update({ avatar_url: null })
    .eq('id', userId);
  if (error) throw error;
}
