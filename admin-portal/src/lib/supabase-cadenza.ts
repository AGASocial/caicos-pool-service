import type { SupabaseClient } from '@supabase/supabase-js';

/** Minimal table shape for Cadenza tables so we can type the client without full codegen. */
type TableShape = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
};

/**
 * Supabase client type that can query Cadenza tables when the main Database type does not include them.
 */
export type CadenzaSupabaseClient = SupabaseClient<{
  public: {
    Tables: {
      cadenza_routes: TableShape;
      cadenza_route_stops: TableShape;
      cadenza_route_stop_schedules: TableShape;
      cadenza_properties: TableShape;
      cadenza_profiles: TableShape;
      cadenza_service_jobs: TableShape;
      cadenza_service_reports: TableShape;
      cadenza_report_photos: TableShape;
      cadenza_job_generation_runs: TableShape;
      cadenza_invite_codes: TableShape;
      cadenza_visit_reasons: TableShape;
      cadenza_cant_service_reasons: TableShape;
    };
  };
}>;
