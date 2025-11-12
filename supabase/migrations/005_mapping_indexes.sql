/**
 * Sprint 3: Mapping Tables - Performance Indexes
 *
 * Create indexes for efficient querying and suggestion lookups
 */

-- ============================================================================
-- dpgf_mappings indexes
-- ============================================================================

-- Most common query: get mappings for an import
CREATE INDEX idx_dpgf_mappings_import
ON dpgf_mappings(tenant_id, import_id, mapping_order);

-- Query by import for validation
CREATE INDEX idx_dpgf_mappings_tenant_import
ON dpgf_mappings(tenant_id, import_id);

-- Query by target field
CREATE INDEX idx_dpgf_mappings_target
ON dpgf_mappings(tenant_id, target_field);

-- ============================================================================
-- mapping_memory indexes
-- ============================================================================

-- Primary query path: suggestions by supplier and source column
CREATE INDEX idx_mapping_memory_suggestions
ON mapping_memory(tenant_id, supplier, source_column_normalized);

-- Query by supplier for templates/suggestions
CREATE INDEX idx_mapping_memory_supplier
ON mapping_memory(tenant_id, supplier);

-- Recent mappings (for UX: "recently used")
CREATE INDEX idx_mapping_memory_recent
ON mapping_memory(tenant_id, last_used_at DESC) WHERE use_count > 0;

-- High-confidence mappings (for ranking suggestions)
CREATE INDEX idx_mapping_memory_confidence
ON mapping_memory(tenant_id, confidence DESC) WHERE confidence >= 0.5;

-- ============================================================================
-- mapping_templates indexes
-- ============================================================================

-- Query templates by supplier
CREATE INDEX idx_mapping_templates_supplier
ON mapping_templates(tenant_id, supplier_name);

-- Latest version lookup (for applying templates)
CREATE INDEX idx_mapping_templates_latest
ON mapping_templates(tenant_id, supplier_name, version DESC);

-- ============================================================================
-- dpgf_imports: extended indexes for mapping workflow
-- ============================================================================

-- Query imports by status
CREATE INDEX idx_dpgf_imports_mapping_status
ON dpgf_imports(tenant_id, mapping_status);

-- Query recent imports
CREATE INDEX idx_dpgf_imports_recent
ON dpgf_imports(tenant_id, created_at DESC);

-- ============================================================================
-- Optional: GIN index for JSONB columns (if frequently queried)
-- ============================================================================
-- Uncomment if you do complex JSONB queries on mapping_templates.mappings
-- CREATE INDEX idx_mapping_templates_jsonb
-- ON mapping_templates USING GIN (mappings);

-- ============================================================================
-- Optional: Full-text search on supplier names (if many templates)
-- ============================================================================
-- Uncomment for large deployments with many suppliers
-- CREATE INDEX idx_mapping_templates_supplier_fts
-- ON mapping_templates USING GIN (to_tsvector('french', supplier_name));
