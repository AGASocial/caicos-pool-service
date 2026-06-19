import { supabase } from '@/lib/supabase';

/** Cached auth user id — avoids getUser() round-trip per fetch (US-M-002). */
let cachedUserId: string | null = null;
let initialized = false;

export function getCachedUserId(): string | null {
  return cachedUserId;
}

/** Subscribe once to auth state; call from root layout. */
export function initAuthSessionCache(): void {
  if (initialized) return;
  initialized = true;

  void supabase.auth.getSession().then(({ data }) => {
    cachedUserId = data.session?.user?.id ?? null;
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    cachedUserId = session?.user?.id ?? null;
  });
}
