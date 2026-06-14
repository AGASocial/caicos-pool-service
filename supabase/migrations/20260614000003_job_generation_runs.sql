-- US-B-009: Async job generation runs

CREATE TABLE IF NOT EXISTS public.cadenza_job_generation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.cadenza_routes(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_generation_runs_route
  ON public.cadenza_job_generation_runs (route_id, created_at DESC);

ALTER TABLE public.cadenza_job_generation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_generation_runs_select ON public.cadenza_job_generation_runs
  FOR SELECT USING (
    route_id IN (
      SELECT r.id FROM public.cadenza_routes r
      WHERE r.company_id IN (
        SELECT company_id FROM public.cadenza_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY job_generation_runs_insert ON public.cadenza_job_generation_runs
  FOR INSERT WITH CHECK (
    route_id IN (
      SELECT r.id FROM public.cadenza_routes r
      WHERE r.company_id IN (
        SELECT company_id FROM public.cadenza_profiles WHERE id = auth.uid()
      )
    )
  );
