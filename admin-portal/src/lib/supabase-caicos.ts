import type { SupabaseClient } from '@supabase/supabase-js';

/** Minimal table shape for Caicos tables so we can type the client without full codegen. */
type TableShape = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
};

/**
 * Supabase client type that can query Caicos tables when the main Database type does not include them.
 */
export type CaicosSupabaseClient = SupabaseClient<{
  public: {
    Tables: {
      caicos_routes: TableShape;
      caicos_route_stops: TableShape;
      caicos_properties: TableShape;
      caicos_profiles: TableShape;
      caicos_service_jobs: TableShape;
      caicos_invite_codes: TableShape;
    };
  };
}>;
