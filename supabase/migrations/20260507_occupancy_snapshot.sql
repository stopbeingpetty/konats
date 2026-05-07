-- ============================================================================
-- Migration: Occupancy snapshot model
-- Allows multiple snapshots per (date, room_type_id) so history is preserved.
-- The app always queries the LATEST snapshot when displaying occupancy.
-- ============================================================================

-- 1. Extend reservation_source enum with occupancy_excel
--    (used in the imports audit log for occupancy uploads)
ALTER TYPE reservation_source ADD VALUE IF NOT EXISTS 'occupancy_excel';

-- 2. Add snapshot_date — timestamp of the upload batch.
--    All rows from one file upload share the same snapshot_date.
--    Existing rows get snapshot_date = now() at migration time (baseline snapshot).
ALTER TABLE daily_occupancy_override
  ADD COLUMN IF NOT EXISTS snapshot_date timestamptz NOT NULL DEFAULT now();

-- 3. Drop the old UNIQUE constraint that prevents multiple snapshots.
--    PostgreSQL uses <table>_<col1>_<col2>_key as the default name when no explicit
--    name was given, but some Supabase-created tables use a custom name.
ALTER TABLE daily_occupancy_override
  DROP CONSTRAINT IF EXISTS daily_occupancy_override_date_room_type_id_key;

ALTER TABLE daily_occupancy_override
  DROP CONSTRAINT IF EXISTS daily_occupancy_override_unique;

-- 4. New unique constraint: allows multiple snapshots, prevents exact duplicates
--    within the same upload (same file uploaded twice in the same millisecond is
--    an edge case we never expect, but the constraint still provides safety).
ALTER TABLE daily_occupancy_override
  ADD CONSTRAINT daily_occupancy_override_snapshot_unique
  UNIQUE (date, room_type_id, snapshot_date);

-- 5. Index for efficient latest-snapshot queries:
--    ORDER BY date, room_type_id, snapshot_date DESC
CREATE INDEX IF NOT EXISTS daily_occupancy_override_date_snapshot_idx
  ON daily_occupancy_override(date, snapshot_date DESC);

-- 6. Link each override row to the imports audit record that created it.
--    NULL for rows that pre-date this migration (the baseline snapshot).
ALTER TABLE daily_occupancy_override
  ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES imports(id) ON DELETE SET NULL;
