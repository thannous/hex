/**
 * Sprint 4: Contraintes Uniques & Triggers Auto-calculation
 *
 * - UNIQUE constraint pour material_indices
 * - Ajouter colonne prix_net avec trigger auto-calculate
 * - Trigger pour prix_net sur supplier_prices
 */

-- ============================================================================
-- Material Indices: Add UNIQUE Constraint
-- ============================================================================

-- Add UNIQUE constraint to prevent duplicate indices for same (tenant, matiere, date)
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
  'Ensure one index per tenant/matiere/date combination';

-- ============================================================================
-- Supplier Prices: Add prix_net Column (if not exists)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_prices'
    AND column_name = 'prix_net'
  ) THEN
    ALTER TABLE supplier_prices
    ADD COLUMN prix_net numeric(10,2);
  END IF;
END $$;

COMMENT ON COLUMN supplier_prices.prix_net IS
  'Auto-calculated: prix_brut × (1 - remise_pct / 100)';

-- ============================================================================
-- Trigger Function: Calculate prix_net Automatically
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_prix_net()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate prix_net: prix_brut × (1 - remise_pct / 100)
  -- Handle null remise_pct as 0
  NEW.prix_net := NEW.prix_brut * (1 - COALESCE(NEW.remise_pct, 0) / 100.0);

  -- Ensure prix_net is non-negative
  IF NEW.prix_net < 0 THEN
    NEW.prix_net := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_prix_net() IS
  'Trigger function to auto-calculate prix_net from prix_brut and remise_pct';

-- ============================================================================
-- Trigger: Apply calculate_prix_net on INSERT/UPDATE
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_calculate_prix_net ON supplier_prices;

CREATE TRIGGER trigger_calculate_prix_net
BEFORE INSERT OR UPDATE OF prix_brut, remise_pct ON supplier_prices
FOR EACH ROW
EXECUTE FUNCTION calculate_prix_net();

COMMENT ON TRIGGER trigger_calculate_prix_net ON supplier_prices IS
  'Auto-calculate prix_net whenever prix_brut or remise_pct changes';

-- ============================================================================
-- Backfill Existing Records (if prix_net is NULL)
-- ============================================================================

UPDATE supplier_prices
SET prix_net = prix_brut * (1 - COALESCE(remise_pct, 0) / 100.0)
WHERE prix_net IS NULL;

-- ============================================================================
-- Add NOT NULL Constraint to prix_net (after backfill)
-- ============================================================================

ALTER TABLE supplier_prices
ALTER COLUMN prix_net SET NOT NULL;

-- ============================================================================
-- Index for Performance: Prix Net Queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_supplier_prices_prix_net
ON supplier_prices(tenant_id, catalogue_item_id, prix_net);

COMMENT ON INDEX idx_supplier_prices_prix_net IS
  'Optimize queries for cheapest price lookups';
