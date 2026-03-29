-- One property may appear on at most one route (enforced globally on caicos_route_stops).
-- Duplicates (same property_id on multiple rows) are removed first, keeping the oldest row by created_at, then id.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY property_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM caicos_route_stops
)
DELETE FROM caicos_route_stops s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

ALTER TABLE caicos_route_stops
  ADD CONSTRAINT caicos_route_stops_property_id_unique UNIQUE (property_id);

-- Redundant with UNIQUE(property_id): one row per property implies at most one (route_id, property_id).
ALTER TABLE caicos_route_stops
  DROP CONSTRAINT IF EXISTS caicos_route_stops_route_id_property_id_key;
