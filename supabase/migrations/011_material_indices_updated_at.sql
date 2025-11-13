/**
 * Sprint 4: Ensure material_indices exposes updated_at timestamp
 *
 * The API schemas (MaterialIndexSchema) expect createdAt + updatedAt fields.
 * This migration adds the missing column and backfills existing rows.
 */

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'material_indices'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE material_indices
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

COMMENT ON COLUMN material_indices.updated_at IS
  'Last update timestamp for a material index entry';

-- Backfill NULL values (if any) so API responses always include a timestamp
UPDATE material_indices
SET updated_at = COALESCE(updated_at, created_at);
