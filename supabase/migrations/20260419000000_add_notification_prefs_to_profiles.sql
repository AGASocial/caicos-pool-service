ALTER TABLE public.caicos_profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{
    "job_assigned": true,
    "job_reminder": true,
    "schedule_changed": true,
    "follow_up_due": false
  }'::jsonb;
