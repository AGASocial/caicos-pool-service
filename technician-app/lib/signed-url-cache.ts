import { supabase } from '@/lib/supabase';

const REFRESH_WINDOW_MS = 5 * 60 * 1000;
const SIGNED_URL_TTL_SEC = 3600;

type CachedEntry = { signedUrl: string; expiresAt: number };

const cache = new Map<string, CachedEntry>();

function needsRefresh(entry: CachedEntry): boolean {
  return Date.now() >= entry.expiresAt - REFRESH_WINDOW_MS;
}

/** Batch-resolve signed URLs; cache hits skip network, stale entries refresh within 5min of expiry. */
export async function getSignedUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];

  const result: string[] = new Array(paths.length);
  const toRefresh: { path: string; index: number }[] = [];

  paths.forEach((path, index) => {
    const entry = cache.get(path);
    if (entry && !needsRefresh(entry)) {
      result[index] = entry.signedUrl;
    } else {
      toRefresh.push({ path, index });
    }
  });

  if (toRefresh.length > 0) {
    const { data, error } = await supabase.storage
      .from('report-photos')
      .createSignedUrls(
        toRefresh.map((r) => r.path),
        SIGNED_URL_TTL_SEC
      );
    if (error || !data) {
      toRefresh.forEach(({ index }) => {
        result[index] = '';
      });
    } else {
      const expiresAt = Date.now() + SIGNED_URL_TTL_SEC * 1000;
      toRefresh.forEach(({ path, index }, i) => {
        const signedUrl = data[i]?.signedUrl ?? '';
        result[index] = signedUrl;
        if (signedUrl) {
          cache.set(path, { signedUrl, expiresAt });
        }
      });
    }
  }

  return result;
}
