-- Setup pg_cron schedules for photo archive and cleanup jobs
-- Requires pg_cron extension to be enabled on Supabase project

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions to postgres user for pg_cron
-- (Supabase projects run pg_cron as the postgres superuser)

-- Schedule archive job to run nightly at 2:00 AM UTC
-- Moves photos older than photo_hot_storage_days to R2
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

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for photo archival and cleanup';

-- View scheduled jobs
-- SELECT * FROM cron.job;

-- To manually unschedule a job:
-- SELECT cron.unschedule('archive-old-photos');
-- SELECT cron.unschedule('cleanup-archived-photos');
