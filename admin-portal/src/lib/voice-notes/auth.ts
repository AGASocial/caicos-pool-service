/**
 * Auth helper for voice-note API routes.
 * Supports cookie session (portal) or Authorization: Bearer <access_token> (technician app).
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { Database } from '@/lib/supabase';

const SUPABASE_FETCH_TIMEOUT_MS = 10_000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal;
  return fetch(input, { ...init, signal }).finally(() => clearTimeout(timeoutId));
}

export async function createVoiceNotesRouteClient(
  request: Request,
): Promise<{ supabase: SupabaseClient<Database>; user: User | null }> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          global: {
            fetch: fetchWithTimeout,
            headers: { Authorization: `Bearer ${token}` },
          },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      return { supabase, user };
    }
  }

  return createAuthenticatedRouteClient();
}
