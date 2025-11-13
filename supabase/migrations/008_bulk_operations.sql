/**
 * Sprint 4: Bulk Operations via PostgreSQL Functions
 *
 * Supabase JS client ne supporte pas les transactions multi-statements.
 * Ces fonctions RPC permettent des opérations bulk atomiques.
 */

-- ============================================================================
-- Bulk Create Supplier Prices
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_create_supplier_prices(
  p_tenant_id uuid,
  p_prices jsonb  -- Array: [{catalogue_item_id, supplier_name, prix_brut, remise_pct?, validite_fin?, delai_jours?}, ...]
)
RETURNS jsonb AS $$
DECLARE
  v_created_count integer := 0;
  v_error_count integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_item jsonb;
BEGIN
  -- Validate tenant_id
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  -- Process each price
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_prices)
  LOOP
    BEGIN
      -- Validate catalogue_item belongs to tenant
      IF NOT EXISTS (
        SELECT 1 FROM catalogue_items
        WHERE id = (v_item->>'catalogue_item_id')::uuid
        AND tenant_id = p_tenant_id
      ) THEN
        v_errors := v_errors || jsonb_build_object(
          'catalogue_item_id', v_item->>'catalogue_item_id',
          'error', 'Catalogue item not found or belongs to different tenant'
        );
        v_error_count := v_error_count + 1;
        CONTINUE;
      END IF;

      -- Insert price (prix_net will be calculated by trigger)
      INSERT INTO supplier_prices (
        tenant_id,
        catalogue_item_id,
        supplier_name,
        prix_brut,
        remise_pct,
        validite_fin,
        delai_jours
      ) VALUES (
        p_tenant_id,
        (v_item->>'catalogue_item_id')::uuid,
        v_item->>'supplier_name',
        (v_item->>'prix_brut')::numeric,
        COALESCE((v_item->>'remise_pct')::numeric, 0),
        CASE WHEN v_item->>'validite_fin' IS NOT NULL
          THEN (v_item->>'validite_fin')::date
          ELSE NULL
        END,
        CASE WHEN v_item->>'delai_jours' IS NOT NULL
          THEN (v_item->>'delai_jours')::integer
          ELSE NULL
        END
      );

      v_created_count := v_created_count + 1;

    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object(
          'catalogue_item_id', v_item->>'catalogue_item_id',
          'supplier_name', v_item->>'supplier_name',
          'error', SQLERRM
        );
        v_error_count := v_error_count + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created_count,
    'errors', v_error_count,
    'error_details', v_errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION bulk_create_supplier_prices(uuid, jsonb) IS
  'Bulk insert supplier prices with validation and error collection';

-- ============================================================================
-- Bulk Upsert Material Indices
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_upsert_material_indices(
  p_tenant_id uuid,
  p_indices jsonb  -- Array: [{matiere, index_date, coefficient}, ...]
)
RETURNS jsonb AS $$
DECLARE
  v_created_count integer := 0;
  v_updated_count integer := 0;
  v_error_count integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_item jsonb;
  v_was_inserted boolean;
BEGIN
  -- Validate tenant_id
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  -- Process each index
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_indices)
  LOOP
    BEGIN
      -- Upsert index
      WITH upserted AS (
        INSERT INTO material_indices (
          tenant_id,
          matiere,
          index_date,
          coefficient
        ) VALUES (
          p_tenant_id,
          v_item->>'matiere',
          (v_item->>'index_date')::date,
          (v_item->>'coefficient')::numeric
        )
        ON CONFLICT (tenant_id, matiere, index_date)
        DO UPDATE SET
          coefficient = EXCLUDED.coefficient,
          created_at = NOW()
        RETURNING (xmax = 0) AS was_inserted
      )
      SELECT was_inserted INTO v_was_inserted FROM upserted;

      -- Track created vs updated
      IF v_was_inserted THEN
        v_created_count := v_created_count + 1;
      ELSE
        v_updated_count := v_updated_count + 1;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object(
          'matiere', v_item->>'matiere',
          'index_date', v_item->>'index_date',
          'error', SQLERRM
        );
        v_error_count := v_error_count + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created_count,
    'updated', v_updated_count,
    'errors', v_error_count,
    'error_details', v_errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION bulk_upsert_material_indices(uuid, jsonb) IS
  'Bulk upsert material indices with ON CONFLICT handling';

-- ============================================================================
-- Grant Execute to Authenticated Users
-- ============================================================================

GRANT EXECUTE ON FUNCTION bulk_create_supplier_prices(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_upsert_material_indices(uuid, jsonb) TO authenticated;
