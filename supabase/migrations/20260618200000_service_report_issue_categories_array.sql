-- Multiselect issue categories (motor + circulation on same visit, etc.)
ALTER TABLE cadenza_service_reports
  ADD COLUMN IF NOT EXISTS issue_categories TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

-- Migrate from single issue_category if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cadenza_service_reports'
      AND column_name = 'issue_category'
  ) THEN
    UPDATE cadenza_service_reports
    SET issue_categories = ARRAY[issue_category]::TEXT[]
    WHERE issue_category IS NOT NULL
      AND issue_category <> 'none'
      AND issue_categories = '{}'::TEXT[];

    ALTER TABLE cadenza_service_reports DROP COLUMN issue_category;
  END IF;
END $$;

ALTER TABLE cadenza_service_reports
  DROP CONSTRAINT IF EXISTS issue_categories_allowed;

ALTER TABLE cadenza_service_reports
  ADD CONSTRAINT issue_categories_allowed CHECK (
    issue_categories <@ ARRAY['motor', 'filter', 'circulation', 'timer', 'chemistry', 'other']::TEXT[]
  );

COMMENT ON COLUMN cadenza_service_reports.issue_categories IS
  'Zero or more issues found on visit; empty array means no issues.';
