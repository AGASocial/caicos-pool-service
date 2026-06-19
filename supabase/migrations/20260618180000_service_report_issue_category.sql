-- WhatsApp-aligned visit report: issue category for office follow-up queue
ALTER TABLE cadenza_service_reports
  ADD COLUMN IF NOT EXISTS issue_category TEXT NOT NULL DEFAULT 'none'
    CHECK (issue_category IN ('none', 'motor', 'filter', 'circulation', 'timer', 'chemistry', 'other'));

COMMENT ON COLUMN cadenza_service_reports.issue_category IS
  'Primary issue found on visit; maps to WhatsApp exception reporting (motor, filter, circulation, etc.)';
