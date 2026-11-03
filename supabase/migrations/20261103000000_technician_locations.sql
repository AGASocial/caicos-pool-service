-- Real-time technician map: latest position per technician (one row each).
-- NOTE: already applied manually to Supabase project ejhrfnauifgvopshnnuv on 2026-11-02
-- (shared prod/develop DB). Kept here for history; statements are idempotent where possible.
-- Never apply migrations from CI.

CREATE TABLE IF NOT EXISTS public.cadenza_technician_locations (
  technician_id UUID PRIMARY KEY REFERENCES public.cadenza_profiles(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  heading DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  current_job_id UUID REFERENCES public.cadenza_service_jobs(id) ON DELETE SET NULL,
  is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cadenza_tech_locations_company
  ON public.cadenza_technician_locations(company_id, updated_at DESC);

ALTER TABLE public.cadenza_technician_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view technician locations"
  ON public.cadenza_technician_locations FOR SELECT
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Technicians upsert own location"
  ON public.cadenza_technician_locations FOR INSERT
  WITH CHECK (technician_id = auth.uid() AND company_id = public.get_my_company_id());

CREATE POLICY "Technicians update own location"
  ON public.cadenza_technician_locations FOR UPDATE
  USING (technician_id = auth.uid())
  WITH CHECK (technician_id = auth.uid() AND company_id = public.get_my_company_id());

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public'
      AND tablename='cadenza_technician_locations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cadenza_technician_locations;
  END IF;
END $$;
