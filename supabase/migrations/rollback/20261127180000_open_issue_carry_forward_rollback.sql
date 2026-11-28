-- Rollback for 20261127180000_open_issue_carry_forward.sql (KAN-153)
-- Removes only the objects added by KAN-153.
--
-- public._backup_kan153_voice_note_problems is intentionally LEFT IN PLACE so the pre-backfill
-- state stays recoverable. Once the rollback (or the feature) is confirmed stable, drop it with:
--   DROP TABLE IF EXISTS public._backup_kan153_voice_note_problems;

DROP FUNCTION IF EXISTS public.review_open_issue(TEXT, UUID, UUID, BOOLEAN, TEXT);

DROP INDEX IF EXISTS public.idx_cadenza_job_voice_notes_open_problems;
DROP INDEX IF EXISTS public.idx_cadenza_service_reports_open_follow_up;

-- Restore the original action_type check. Existing 'still_open' rows would violate it, so they
-- are downgraded to plain notes (original type kept in metadata) before the check is re-added.
ALTER TABLE public.cadenza_job_follow_up_actions
  DROP CONSTRAINT IF EXISTS cadenza_job_follow_up_actions_action_type_check;

UPDATE public.cadenza_job_follow_up_actions
SET action_type = 'note',
    metadata = cadenza_job_follow_up_actions.metadata || '{"rolled_back_from":"still_open"}'::JSONB
WHERE cadenza_job_follow_up_actions.action_type = 'still_open';

ALTER TABLE public.cadenza_job_follow_up_actions
  ADD CONSTRAINT cadenza_job_follow_up_actions_action_type_check CHECK (
    action_type IN ('note', 'email_sent', 'resolved', 'call')
  );

ALTER TABLE public.cadenza_job_voice_notes
  DROP CONSTRAINT IF EXISTS cadenza_job_voice_notes_follow_up_status_allowed;
ALTER TABLE public.cadenza_job_voice_notes DROP COLUMN IF EXISTS last_reviewed_by;
ALTER TABLE public.cadenza_job_voice_notes DROP COLUMN IF EXISTS last_reviewed_job_id;
ALTER TABLE public.cadenza_job_voice_notes DROP COLUMN IF EXISTS last_reviewed_at;
ALTER TABLE public.cadenza_job_voice_notes DROP COLUMN IF EXISTS follow_up_status;

ALTER TABLE public.cadenza_service_reports DROP COLUMN IF EXISTS last_reviewed_by;
ALTER TABLE public.cadenza_service_reports DROP COLUMN IF EXISTS last_reviewed_job_id;
ALTER TABLE public.cadenza_service_reports DROP COLUMN IF EXISTS last_reviewed_at;
