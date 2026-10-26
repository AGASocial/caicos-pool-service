-- Setup pg_cron schedules for photo archive and cleanup jobs
-- 
-- **IMPORTANT**: These cron jobs are OPTIONAL and only needed if using Cloudflare R2 archiving.
-- If R2 environment variables are not configured, the jobs will no-op safely.
-- You can skip creating these jobs if you don't plan to use R2 archiving.
--
-- To apply this migration conditionally:
--   - If using R2: run this migration normally
--   - If NOT using R2: either skip this migration or run it (jobs will no-op)
--
-- To manually disable/unschedule after creation:
--   SELECT cron.unschedule('archive-old-photos');
--   SELECT cron.unschedule('cleanup-archived-photos');

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions to postgres user for pg_cron
-- (Supabase projects run pg_cron as the postgres superuser)

-- Schedule archive job to run nightly at 2:00 AM UTC
-- Moves photos older than photo_hot_storage_days to R2 (if R2 is configured)
-- If R2 env vars are not set, this job will no-op and return success
SELECT cron.schedule(
  'archive-old-photos',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/archive-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule cleanup job to run nightly at 3:00 AM UTC
-- Deletes photos beyond photo_retention_days
-- SAFETY: Only deletes archived photos if R2 is configured,
-- or all photos beyond retention if R2 is not configured
SELECT cron.schedule(
  'cleanup-archived-photos',
  '0 3 * * *', -- Daily at 3 AM UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/cleanup-archived-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Set required runtime settings (these should be configured via Supabase dashboard or CLI)
-- ALTER DATABASE postgres SET app.supabase_url = 'https://xxx.supabase.co';
-- ALTER DATABASE postgres SET app.cron_secret = 'your-cron-secret';

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for photo archival and cleanup (optional, requires R2 for archival)';

-- View scheduled jobs
-- SELECT * FROM cron.job;

-- To manually unschedule a job (if R2 is not being used):
-- SELECT cron.unschedule('archive-old-photos');
-- SELECT cron.unschedule('cleanup-archived-photos');

-- Note: The Edge Functions check for R2 environment variables and no-op if not present.
-- It is safe to have these cron jobs scheduled even without R2 configured.
-- However, you may want to unschedule them to avoid unnecessary function invocations.
