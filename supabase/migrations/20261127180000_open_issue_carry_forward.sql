-- KAN-153: Open-issue carry-forward (review columns, voice-note follow-up status, review RPC)
-- Additive only. Idempotent. Do not run against shared prod/develop from agent tooling —
-- apply via your normal migration process.
--
-- Prod and develop share one database. Every column reference in the RPC below is
-- table-qualified so that no predicate (e.g. company_id) can become an always-true comparison.
--
-- Rollback: migrations/rollback/20261127180000_open_issue_carry_forward_rollback.sql
-- The backup table public._backup_kan153_voice_note_problems is intentionally left in place by
-- the rollback; drop it manually once the change is confirmed stable.

-- ---------------------------------------------------------------------------
-- Service reports: review columns (days open is computed from created_at, no opened_at column)
-- ---------------------------------------------------------------------------
ALTER TABLE public.cadenza_service_reports
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;

ALTER TABLE public.cadenza_service_reports
  ADD COLUMN IF NOT EXISTS last_reviewed_job_id UUID
    REFERENCES public.cadenza_service_jobs(id) ON DELETE SET NULL;

ALTER TABLE public.cadenza_service_reports
  ADD COLUMN IF NOT EXISTS last_reviewed_by UUID
    REFERENCES public.cadenza_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cadenza_service_reports.last_reviewed_at IS
  'KAN-153: when a carry-forward review (resolved or still open) was last recorded.';
COMMENT ON COLUMN public.cadenza_service_reports.last_reviewed_job_id IS
  'KAN-153: the later job during which the issue was reviewed.';
COMMENT ON COLUMN public.cadenza_service_reports.last_reviewed_by IS
  'KAN-153: profile that recorded the latest review.';

-- ---------------------------------------------------------------------------
-- Voice notes: follow-up status + review columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.cadenza_job_voice_notes
  ADD COLUMN IF NOT EXISTS follow_up_status TEXT;

ALTER TABLE public.cadenza_job_voice_notes
  DROP CONSTRAINT IF EXISTS cadenza_job_voice_notes_follow_up_status_allowed;

ALTER TABLE public.cadenza_job_voice_notes
  ADD CONSTRAINT cadenza_job_voice_notes_follow_up_status_allowed CHECK (
    follow_up_status IS NULL OR follow_up_status IN ('open', 'resolved')
  );

ALTER TABLE public.cadenza_job_voice_notes
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;

ALTER TABLE public.cadenza_job_voice_notes
  ADD COLUMN IF NOT EXISTS last_reviewed_job_id UUID
    REFERENCES public.cadenza_service_jobs(id) ON DELETE SET NULL;

ALTER TABLE public.cadenza_job_voice_notes
  ADD COLUMN IF NOT EXISTS last_reviewed_by UUID
    REFERENCES public.cadenza_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cadenza_job_voice_notes.follow_up_status IS
  'KAN-153: open | resolved for problem notes; NULL for routine/unclassified notes.';
COMMENT ON COLUMN public.cadenza_job_voice_notes.last_reviewed_at IS
  'KAN-153: when a carry-forward review (resolved or still open) was last recorded.';
COMMENT ON COLUMN public.cadenza_job_voice_notes.last_reviewed_job_id IS
  'KAN-153: the later job during which the note was reviewed.';
COMMENT ON COLUMN public.cadenza_job_voice_notes.last_reviewed_by IS
  'KAN-153: profile that recorded the latest review.';

-- ---------------------------------------------------------------------------
-- Follow-up actions: allow 'still_open'
-- (inline CHECK created in 20260619120000 gets the default generated name)
-- ---------------------------------------------------------------------------
ALTER TABLE public.cadenza_job_follow_up_actions
  DROP CONSTRAINT IF EXISTS cadenza_job_follow_up_actions_action_type_check;

ALTER TABLE public.cadenza_job_follow_up_actions
  ADD CONSTRAINT cadenza_job_follow_up_actions_action_type_check CHECK (
    action_type IN ('note', 'email_sent', 'resolved', 'call', 'still_open')
  );

-- ---------------------------------------------------------------------------
-- Backup, then backfill existing done problem voice notes as 'open'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public._backup_kan153_voice_note_problems (
  id UUID PRIMARY KEY,
  follow_up_status TEXT,
  last_reviewed_at TIMESTAMPTZ,
  last_reviewed_job_id UUID,
  last_reviewed_by UUID,
  created_at TIMESTAMPTZ,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Internal backup: RLS on with no policies, so it is not readable through the API.
ALTER TABLE public._backup_kan153_voice_note_problems ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public._backup_kan153_voice_note_problems IS
  'KAN-153 backup of problem voice notes before follow_up_status backfill. Safe to drop once the change is stable.';

INSERT INTO public._backup_kan153_voice_note_problems (
  id, follow_up_status, last_reviewed_at, last_reviewed_job_id, last_reviewed_by, created_at
)
SELECT
  n.id,
  n.follow_up_status,
  n.last_reviewed_at,
  n.last_reviewed_job_id,
  n.last_reviewed_by,
  n.created_at
FROM public.cadenza_job_voice_notes n
WHERE n.category = 'problem'
  AND n.status = 'done'
  AND n.follow_up_status IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE public.cadenza_job_voice_notes
SET follow_up_status = 'open'
WHERE cadenza_job_voice_notes.category = 'problem'
  AND cadenza_job_voice_notes.status = 'done'
  AND cadenza_job_voice_notes.follow_up_status IS NULL;

-- ---------------------------------------------------------------------------
-- Indexes for the open-issue queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cadenza_service_reports_open_follow_up
  ON public.cadenza_service_reports (company_id, created_at)
  WHERE follow_up_status = 'open' AND is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_cadenza_job_voice_notes_open_problems
  ON public.cadenza_job_voice_notes (company_id, created_at)
  WHERE category = 'problem' AND status = 'done';

-- ---------------------------------------------------------------------------
-- RPC: review_open_issue
-- Narrow write path so a later-job technician can answer "Resolved? Yes/No" without broader
-- UPDATE policies on reports / voice notes. Touches review/follow-up columns only.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.review_open_issue(TEXT, UUID, UUID, BOOLEAN, TEXT);

CREATE FUNCTION public.review_open_issue(
  p_source TEXT,
  p_id UUID,
  p_review_job_id UUID,
  p_resolved BOOLEAN,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company_id UUID;
  v_role TEXT;
  v_review_property_id UUID;
  v_review_technician_id UUID;
  v_origin_job_id UUID;
  v_origin_property_id UUID;
  v_origin_company_id UUID;
  v_origin_deleted BOOLEAN;
  v_action_type TEXT;
  v_action_id UUID;
  v_new_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'review_open_issue: not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_source IS NULL OR p_source NOT IN ('service_report', 'voice_note') THEN
    RAISE EXCEPTION 'review_open_issue: invalid_source' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL OR p_review_job_id IS NULL OR p_resolved IS NULL THEN
    RAISE EXCEPTION 'review_open_issue: invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT cadenza_profiles.company_id, cadenza_profiles.role
  INTO v_company_id, v_role
  FROM public.cadenza_profiles
  WHERE cadenza_profiles.id = v_uid;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'review_open_issue: forbidden' USING ERRCODE = '42501';
  END IF;

  -- Review job: must exist, be live, and belong to the caller's company.
  SELECT j.property_id, j.technician_id
  INTO v_review_property_id, v_review_technician_id
  FROM public.cadenza_service_jobs j
  WHERE j.id = p_review_job_id
    AND j.company_id = v_company_id
    AND COALESCE(j.is_deleted, FALSE) = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'review_open_issue: review_job_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Caller: office role, or the technician assigned to the review job.
  IF NOT (
    v_role IN ('owner', 'admin', 'operations')
    OR v_review_technician_id = v_uid
  ) THEN
    RAISE EXCEPTION 'review_open_issue: forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_source = 'service_report' THEN
    -- Lock the row so concurrent reviews serialize.
    SELECT r.job_id
    INTO v_origin_job_id
    FROM public.cadenza_service_reports r
    WHERE r.id = p_id
      AND r.company_id = v_company_id
      AND r.is_deleted = FALSE
      AND r.follow_up_status = 'open'
      AND (
        r.follow_up_needed IS TRUE
        OR COALESCE(cardinality(r.issue_categories), 0) > 0
      )
    FOR UPDATE;
  ELSE
    SELECT n.job_id
    INTO v_origin_job_id
    FROM public.cadenza_job_voice_notes n
    WHERE n.id = p_id
      AND n.company_id = v_company_id
      AND n.category = 'problem'
      AND n.status = 'done'
      AND n.follow_up_status IS DISTINCT FROM 'resolved'
    FOR UPDATE;
  END IF;

  IF v_origin_job_id IS NULL THEN
    RAISE EXCEPTION 'review_open_issue: issue_not_open' USING ERRCODE = 'P0002';
  END IF;

  IF v_origin_job_id = p_review_job_id THEN
    RAISE EXCEPTION 'review_open_issue: same_job' USING ERRCODE = '22023';
  END IF;

  -- Origin job must be live, in the same company, and at the same property.
  SELECT oj.property_id, oj.company_id, COALESCE(oj.is_deleted, FALSE)
  INTO v_origin_property_id, v_origin_company_id, v_origin_deleted
  FROM public.cadenza_service_jobs oj
  WHERE oj.id = v_origin_job_id;

  IF v_origin_company_id IS DISTINCT FROM v_company_id
     OR v_origin_deleted
     OR v_origin_property_id IS NULL
     OR v_review_property_id IS NULL
     OR v_origin_property_id IS DISTINCT FROM v_review_property_id THEN
    RAISE EXCEPTION 'review_open_issue: forbidden' USING ERRCODE = '42501';
  END IF;

  v_new_status := CASE WHEN p_resolved THEN 'resolved' ELSE 'open' END;
  v_action_type := CASE WHEN p_resolved THEN 'resolved' ELSE 'still_open' END;

  IF p_source = 'service_report' THEN
    UPDATE public.cadenza_service_reports
    SET follow_up_status = v_new_status,
        last_reviewed_at = NOW(),
        last_reviewed_job_id = p_review_job_id,
        last_reviewed_by = v_uid
    WHERE cadenza_service_reports.id = p_id
      AND cadenza_service_reports.company_id = v_company_id;
  ELSE
    UPDATE public.cadenza_job_voice_notes
    SET follow_up_status = v_new_status,
        last_reviewed_at = NOW(),
        last_reviewed_job_id = p_review_job_id,
        last_reviewed_by = v_uid
    WHERE cadenza_job_voice_notes.id = p_id
      AND cadenza_job_voice_notes.company_id = v_company_id;
  END IF;

  INSERT INTO public.cadenza_job_follow_up_actions (
    company_id, job_id, report_id, author_id, action_type, body, metadata
  )
  VALUES (
    v_company_id,
    p_review_job_id,
    CASE WHEN p_source = 'service_report' THEN p_id ELSE NULL END,
    v_uid,
    v_action_type,
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    jsonb_build_object(
      'source', p_source,
      'source_id', p_id,
      'origin_job_id', v_origin_job_id
    )
  )
  RETURNING cadenza_job_follow_up_actions.id INTO v_action_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'source', p_source,
    'id', p_id,
    'follow_up_status', v_new_status,
    'action_type', v_action_type,
    'action_id', v_action_id,
    'origin_job_id', v_origin_job_id,
    'review_job_id', p_review_job_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_open_issue(TEXT, UUID, UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_open_issue(TEXT, UUID, UUID, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_open_issue(TEXT, UUID, UUID, BOOLEAN, TEXT) TO authenticated;

COMMENT ON FUNCTION public.review_open_issue(TEXT, UUID, UUID, BOOLEAN, TEXT) IS
  'KAN-153: record a carry-forward review (resolved / still open) of a service-report or voice-note issue from a later job at the same property.';
