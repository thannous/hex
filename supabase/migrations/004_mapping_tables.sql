/**
 * Sprint 3: Mapping & Memory Tables
 *
 * Create core tables for column mapping, mapping history, and templates
 * with proper constraints, normalization, and multi-tenant support
 */

-- Enum for field types (expandable for future types)
CREATE TYPE field_type_enum AS ENUM (
  'text',
  'number',
  'date',
  'boolean',
  'email',
  'currency',
  'hex_code',
  'supplier_ref'
);

-- Enum for mapping status
CREATE TYPE mapping_status_enum AS ENUM (
  'draft',
  'applied',
  'invalid'
);

-- ============================================================================
-- dpgf_mappings: Store column mappings for each import
-- ============================================================================
CREATE TABLE dpgf_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  import_id uuid NOT NULL REFERENCES dpgf_imports(id) ON DELETE CASCADE,
  source_column text NOT NULL,                          -- Original CSV column name
  target_field text NOT NULL,                           -- Catalogue field (hex_code, designation, etc)
  field_type field_type_enum NOT NULL DEFAULT 'text',
  mapping_order integer NOT NULL DEFAULT 0,            -- Order for UI display
  created_at timestamptz DEFAULT NOW(),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT NOW(),

  -- Constraint: one mapping per import per source column
  UNIQUE (tenant_id, import_id, source_column),

  -- Constraint: order must be non-negative
  CHECK (mapping_order >= 0)
);

COMMENT ON TABLE dpgf_mappings IS 'Column mappings for DPGF imports, tracks source→target field associations';
COMMENT ON COLUMN dpgf_mappings.source_column IS 'Original CSV column name (preserves case)';
COMMENT ON COLUMN dpgf_mappings.target_field IS 'Target catalogue field (hex_code, designation, tempsUnitaireH, etc)';
COMMENT ON COLUMN dpgf_mappings.field_type IS 'Data type for validation and coercion';
COMMENT ON COLUMN dpgf_mappings.mapping_order IS 'Display order in UI (0-based)';

-- ============================================================================
-- mapping_memory: Learning system - track successful mappings over time
-- ============================================================================
CREATE TABLE mapping_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Normalized source column (lowercase, trimmed, unaccented)
  -- Enables fuzzy matching and similarity scoring
  source_column_original text NOT NULL,                 -- Keep original for reference
  source_column_normalized text NOT NULL,               -- For suggestions

  -- Context: which supplier this mapping came from
  supplier text NOT NULL,                               -- Supplier name or 'general'

  -- Target field in catalogue
  target_field text NOT NULL,

  -- Scoring
  confidence numeric(3,2) DEFAULT 0.5,                  -- 0.0 to 1.0
  use_count integer DEFAULT 0,                          -- How often this mapping was used
  last_used_at timestamptz DEFAULT NOW(),

  created_at timestamptz DEFAULT NOW(),

  -- Constraint: one entry per tenant/supplier/source/target combo
  -- Allows aggregating multiple uses into single memory record
  UNIQUE (tenant_id, supplier, source_column_normalized, target_field),

  -- Constraints
  CHECK (confidence >= 0 AND confidence <= 1),
  CHECK (use_count >= 0),
  CHECK (supplier != '')
);

COMMENT ON TABLE mapping_memory IS 'Historical record of successful mappings, used for suggestions and scoring';
COMMENT ON COLUMN mapping_memory.source_column_normalized IS 'Normalized (lowercase, unaccented) for similarity searches';
COMMENT ON COLUMN mapping_memory.confidence IS 'Confidence score (0-1) based on frequency, recency, supplier match';
COMMENT ON COLUMN mapping_memory.use_count IS 'Counter incremented each time this mapping is applied';

-- ============================================================================
-- mapping_templates: Saved mappings for reuse by supplier
-- ============================================================================
CREATE TABLE mapping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_name text NOT NULL,                          -- e.g., "Supplier ABC", "General"

  -- JSONB: Array of { sourceColumn, targetField, fieldType, order }
  -- Validate via Zod on insert (application layer)
  mappings jsonb NOT NULL,

  -- Version for updating templates
  version integer NOT NULL DEFAULT 1,

  -- Description for UI
  description text,

  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  -- Constraint: one template version per tenant/supplier/version combo
  UNIQUE (tenant_id, supplier_name, version),

  -- Constraints
  CHECK (version > 0),
  CHECK (jsonb_array_length(mappings) > 0)
);

COMMENT ON TABLE mapping_templates IS 'Reusable mapping configurations per supplier, with versioning';
COMMENT ON COLUMN mapping_templates.mappings IS 'JSONB array of mapping objects, validated by application layer';
COMMENT ON COLUMN mapping_templates.version IS 'Incremental version on updates, allows keeping historical templates';

-- ============================================================================
-- Update dpgf_imports to track mapping status
-- ============================================================================
ALTER TABLE dpgf_imports
ADD COLUMN IF NOT EXISTS mapping_status mapping_status_enum DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS mapping_version integer DEFAULT 0;

COMMENT ON COLUMN dpgf_imports.mapping_status IS 'Current mapping state (draft/applied/invalid)';
COMMENT ON COLUMN dpgf_imports.mapping_version IS 'Version counter for optimistic locking';

-- ============================================================================
-- Normalize function: prepare source columns for similarity matching
-- ============================================================================
CREATE OR REPLACE FUNCTION normalize_column_name(col_name text)
RETURNS text AS $$
BEGIN
  RETURN LOWER(
    TRIM(
      -- Remove accents if unaccent extension is available
      COALESCE(
        (SELECT unaccent(col_name) WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent')),
        col_name
      )
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_column_name(text) IS 'Normalize column names for suggestions: lowercase, trim, remove accents';

-- ============================================================================
-- Helper: increment mapping memory statistics
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_mapping_memory(
  p_tenant_id uuid,
  p_supplier text,
  p_source_column_original text,
  p_target_field text
)
RETURNS void AS $$
BEGIN
  INSERT INTO mapping_memory (
    tenant_id,
    source_column_original,
    source_column_normalized,
    supplier,
    target_field,
    use_count,
    confidence
  )
  VALUES (
    p_tenant_id,
    p_source_column_original,
    normalize_column_name(p_source_column_original),
    p_supplier,
    p_target_field,
    1,
    0.8  -- Initial confidence for new mappings
  )
  ON CONFLICT (tenant_id, supplier, source_column_normalized, target_field)
  DO UPDATE SET
    use_count = mapping_memory.use_count + 1,
    last_used_at = NOW(),
    confidence = LEAST(1.0, mapping_memory.confidence + 0.05);  -- Boost confidence with use
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_mapping_memory(uuid,text,text,text) IS 'Update mapping memory: increment use_count, boost confidence, update last_used_at';

-- ============================================================================
-- Helper: get member of tenant function (for RLS)
-- ============================================================================
CREATE OR REPLACE FUNCTION is_member_of_tenant(p_tenant_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE tenant_id = p_tenant_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_member_of_tenant(uuid) IS 'Check if current user is member of tenant';
