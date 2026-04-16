-- Effective-dated schedule segments per route stop (pattern changes after a given date).

CREATE TABLE caicos_route_stop_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_stop_id UUID NOT NULL REFERENCES caicos_route_stops(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  service_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (service_frequency IN ('weekly', 'monthly')),
  week_ordinal SMALLINT CHECK (week_ordinal IS NULL OR (week_ordinal >= 1 AND week_ordinal <= 4)),
  effective_from DATE NOT NULL,
  effective_until DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT caicos_route_stop_schedules_schedule_chk CHECK (
    (service_frequency = 'weekly' AND week_ordinal IS NULL)
    OR (service_frequency = 'monthly' AND week_ordinal IS NOT NULL)
  ),
  CONSTRAINT caicos_route_stop_schedules_until_chk CHECK (
    effective_until IS NULL OR effective_until >= effective_from
  ),
  CONSTRAINT caicos_route_stop_schedules_stop_from_unique UNIQUE (route_stop_id, effective_from)
);

CREATE INDEX idx_caicos_route_stop_schedules_stop ON caicos_route_stop_schedules(route_stop_id);
CREATE INDEX idx_caicos_route_stop_schedules_from ON caicos_route_stop_schedules(route_stop_id, effective_from);

COMMENT ON TABLE caicos_route_stop_schedules IS
  'Time-bounded visit pattern per route stop. For date D use the row with effective_from <= D and (effective_until is null or D <= effective_until); tie-break by latest effective_from.';

-- Backfill: one open-ended segment per stop from current stop columns (skip if already present).
INSERT INTO caicos_route_stop_schedules (
  route_stop_id,
  day_of_week,
  service_frequency,
  week_ordinal,
  effective_from,
  effective_until
)
SELECT
  s.id,
  s.day_of_week,
  s.service_frequency,
  s.week_ordinal,
  DATE '2000-01-01',
  NULL
FROM caicos_route_stops s
WHERE NOT EXISTS (
  SELECT 1
  FROM caicos_route_stop_schedules x
  WHERE x.route_stop_id = s.id AND x.effective_from = DATE '2000-01-01'
);

ALTER TABLE caicos_route_stop_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company route stop schedules"
  ON caicos_route_stop_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM caicos_route_stops s
      JOIN caicos_routes r ON r.id = s.route_id
      WHERE s.id = route_stop_id AND r.company_id = get_my_company_id()
    )
  );

CREATE POLICY "Admins can manage route stop schedules"
  ON caicos_route_stop_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM caicos_route_stops s
      JOIN caicos_routes r ON r.id = s.route_id
      WHERE s.id = route_stop_id
        AND r.company_id = get_my_company_id()
        AND get_my_role() IN ('owner', 'admin', 'operations')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM caicos_route_stops s
      JOIN caicos_routes r ON r.id = s.route_id
      WHERE s.id = route_stop_id
        AND r.company_id = get_my_company_id()
        AND get_my_role() IN ('owner', 'admin', 'operations')
    )
  );

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON caicos_route_stop_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
