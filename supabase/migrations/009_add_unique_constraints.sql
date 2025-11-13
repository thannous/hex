/**
 * Sprint 4: Contraintes Uniques
 *
 * - UNIQUE constraint pour material_indices (tenant_id, matiere, index_date)
 *
 * Note: prix_net calculation is already handled by GENERATED column in 001_schema.sql
 */

-- ============================================================================
-- Material Indices: Add UNIQUE Constraint
-- ============================================================================

-- Add UNIQUE constraint to prevent duplicate indices for same (tenant, matiere, date)
-- This enables ON CONFLICT upsert logic in bulk_upsert_material_indices()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_material_index'
  ) THEN
    ALTER TABLE material_indices
    ADD CONSTRAINT unique_material_index
    UNIQUE (tenant_id, matiere, index_date);
  END IF;
END $$;

COMMENT ON CONSTRAINT unique_material_index ON material_indices IS
  'Ensure one index per tenant/matiere/date combination (enables upsert logic)';

-- ============================================================================
-- Index for Performance: Material Index Lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_material_indices_lookup
ON material_indices(tenant_id, matiere, index_date DESC);

COMMENT ON INDEX idx_material_indices_lookup IS
  'Optimize queries for latest material indices by matiere';
