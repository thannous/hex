/**
 * Sprint 4: Catalogue Helper Functions
 *
 * - Function pour importer automatiquement des catalogue_items depuis dpgf_rows_mapped
 * - Détection des hex_code non-mappés et création automatique
 */

-- ============================================================================
-- Import Catalogue Items from Mapping
-- ============================================================================

CREATE OR REPLACE FUNCTION import_catalogue_from_mapping(
  p_tenant_id uuid,
  p_import_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_created_count integer := 0;
  v_skipped_count integer := 0;
  v_error_count integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_unmapped_row RECORD;
BEGIN
  -- Validate tenant_id and import_id
  IF p_tenant_id IS NULL OR p_import_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id and import_id are required';
  END IF;

  -- Validate import belongs to tenant
  IF NOT EXISTS (
    SELECT 1 FROM dpgf_imports
    WHERE id = p_import_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Import not found or belongs to different tenant';
  END IF;

  -- Find unmapped rows with hex_code and designation
  FOR v_unmapped_row IN
    SELECT DISTINCT ON (mapped.hex_code)
      mapped.hex_code,
      mapped.designation,
      mapped.temps_unitaire_h,
      mapped.unite_mesure,
      mapped.dn,
      mapped.pn,
      mapped.matiere,
      mapped.connexion,
      mapped.discipline
    FROM dpgf_rows_mapped mapped
    WHERE mapped.import_id = p_import_id
      AND mapped.tenant_id = p_tenant_id
      AND mapped.hex_code IS NOT NULL
      AND mapped.hex_code != ''
      AND mapped.catalogue_item_id IS NULL  -- Not yet linked
      AND NOT EXISTS (
        -- Check if catalogue_item already exists
        SELECT 1 FROM catalogue_items c
        WHERE c.tenant_id = p_tenant_id
        AND UPPER(c.hex_code) = UPPER(mapped.hex_code)
      )
    ORDER BY mapped.hex_code
  LOOP
    BEGIN
      -- Create catalogue_item
      INSERT INTO catalogue_items (
        tenant_id,
        hex_code,
        designation,
        temps_unitaire_h,
        unite_mesure,
        dn,
        pn,
        matiere,
        connexion,
        discipline
      ) VALUES (
        p_tenant_id,
        UPPER(v_unmapped_row.hex_code),
        v_unmapped_row.designation,
        v_unmapped_row.temps_unitaire_h,
        v_unmapped_row.unite_mesure,
        v_unmapped_row.dn,
        v_unmapped_row.pn,
        v_unmapped_row.matiere,
        v_unmapped_row.connexion,
        v_unmapped_row.discipline
      );

      v_created_count := v_created_count + 1;

    EXCEPTION
      WHEN unique_violation THEN
        -- Item was created by another process (race condition)
        v_skipped_count := v_skipped_count + 1;
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object(
          'hex_code', v_unmapped_row.hex_code,
          'error', SQLERRM
        );
        v_error_count := v_error_count + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created_count,
    'skipped', v_skipped_count,
    'errors', v_error_count,
    'error_details', v_errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION import_catalogue_from_mapping(uuid, uuid) IS
  'Auto-create catalogue_items from unmapped dpgf_rows_mapped rows';

-- ============================================================================
-- Link Mapped Rows to Catalogue Items
-- ============================================================================

CREATE OR REPLACE FUNCTION link_mapped_rows_to_catalogue(
  p_tenant_id uuid,
  p_import_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_linked_count integer := 0;
BEGIN
  -- Update dpgf_rows_mapped to set catalogue_item_id where hex_code matches
  WITH updated AS (
    UPDATE dpgf_rows_mapped mapped
    SET catalogue_item_id = c.id
    FROM catalogue_items c
    WHERE mapped.import_id = p_import_id
      AND mapped.tenant_id = p_tenant_id
      AND mapped.hex_code IS NOT NULL
      AND mapped.catalogue_item_id IS NULL
      AND c.tenant_id = p_tenant_id
      AND UPPER(c.hex_code) = UPPER(mapped.hex_code)
    RETURNING mapped.id
  )
  SELECT COUNT(*) INTO v_linked_count FROM updated;

  RETURN jsonb_build_object('linked', v_linked_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION link_mapped_rows_to_catalogue(uuid, uuid) IS
  'Link dpgf_rows_mapped to catalogue_items by hex_code';

-- ============================================================================
-- Composite Function: Import + Link in One Transaction
-- ============================================================================

CREATE OR REPLACE FUNCTION import_and_link_catalogue(
  p_tenant_id uuid,
  p_import_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_import_result jsonb;
  v_link_result jsonb;
BEGIN
  -- Step 1: Import new catalogue items
  v_import_result := import_catalogue_from_mapping(p_tenant_id, p_import_id);

  -- Step 2: Link mapped rows
  v_link_result := link_mapped_rows_to_catalogue(p_tenant_id, p_import_id);

  -- Return combined result
  RETURN jsonb_build_object(
    'import', v_import_result,
    'link', v_link_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION import_and_link_catalogue(uuid, uuid) IS
  'Import new catalogue items and link mapped rows in one transaction';

-- ============================================================================
-- Grant Execute to Authenticated Users
-- ============================================================================

GRANT EXECUTE ON FUNCTION import_catalogue_from_mapping(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION link_mapped_rows_to_catalogue(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION import_and_link_catalogue(uuid, uuid) TO authenticated;
