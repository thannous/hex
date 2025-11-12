/**
 * Sprint 3: Mapping Tables - Row Level Security (RLS)
 *
 * Enforce multi-tenant isolation and role-based access for mapping tables
 */

-- ============================================================================
-- Enable RLS on all mapping tables
-- ============================================================================
ALTER TABLE dpgf_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- dpgf_mappings RLS Policies
-- ============================================================================

-- SELECT: Users can view mappings for imports they have access to
CREATE POLICY "members_can_view_mappings"
ON dpgf_mappings FOR SELECT
USING (is_member_of_tenant(tenant_id));

-- INSERT: Admin/Engineer can create mappings
CREATE POLICY "admin_engineer_can_create_mappings"
ON dpgf_mappings FOR INSERT
WITH CHECK (
  is_member_of_tenant(tenant_id)
  AND (
    SELECT role FROM tenant_memberships
    WHERE tenant_id = dpgf_mappings.tenant_id
    AND user_id = auth.uid()
  ) IN ('admin', 'engineer')
);

-- UPDATE: Admin/Engineer can update mappings
CREATE POLICY "admin_engineer_can_update_mappings"
ON dpgf_mappings FOR UPDATE
USING (is_member_of_tenant(tenant_id))
WITH CHECK (
  is_member_of_tenant(tenant_id)
  AND (
    SELECT role FROM tenant_memberships
    WHERE tenant_id = dpgf_mappings.tenant_id
    AND user_id = auth.uid()
  ) IN ('admin', 'engineer')
);

-- DELETE: Admin only can delete mappings
CREATE POLICY "admin_can_delete_mappings"
ON dpgf_mappings FOR DELETE
USING (
  is_member_of_tenant(tenant_id)
  AND (
    SELECT role FROM tenant_memberships
    WHERE tenant_id = dpgf_mappings.tenant_id
    AND user_id = auth.uid()
  ) = 'admin'
);

-- ============================================================================
-- mapping_memory RLS Policies
-- ============================================================================

-- SELECT: Users can view mapping history for their tenant
CREATE POLICY "members_can_view_mapping_memory"
ON mapping_memory FOR SELECT
USING (is_member_of_tenant(tenant_id));

-- INSERT: Application layer inserts mapping history (system account preferred)
-- For safety, only admin/engineer can trigger inserts (via application)
CREATE POLICY "admin_engineer_can_create_memory"
ON mapping_memory FOR INSERT
WITH CHECK (
  is_member_of_tenant(tenant_id)
  AND (
    SELECT role FROM tenant_memberships
    WHERE tenant_id = mapping_memory.tenant_id
    AND user_id = auth.uid()
  ) IN ('admin', 'engineer')
);

-- UPDATE: Increment counters (use_count, last_used_at, confidence)
-- Called automatically when mappings are applied
CREATE POLICY "system_can_update_memory"
ON mapping_memory FOR UPDATE
USING (is_member_of_tenant(tenant_id))
WITH CHECK (is_member_of_tenant(tenant_id));

-- DELETE: Admin only
CREATE POLICY "admin_can_delete_memory"
ON mapping_memory FOR DELETE
USING (
  is_member_of_tenant(tenant_id)
  AND (
    SELECT role FROM tenant_memberships
    WHERE tenant_id = mapping_memory.tenant_id
    AND user_id = auth.uid()
  ) = 'admin'
);

-- ============================================================================
-- mapping_templates RLS Policies
-- ============================================================================

-- SELECT: Users can view templates for their tenant
CREATE POLICY "members_can_view_templates"
ON mapping_templates FOR SELECT
USING (is_member_of_tenant(tenant_id));

-- INSERT: Admin/Engineer can create templates
CREATE POLICY "admin_engineer_can_create_templates"
ON mapping_templates FOR INSERT
WITH CHECK (
  is_member_of_tenant(tenant_id)
  AND (
    SELECT role FROM tenant_memberships
    WHERE tenant_id = mapping_templates.tenant_id
    AND user_id = auth.uid()
  ) IN ('admin', 'engineer')
);

-- UPDATE: Creator or admin can update templates
CREATE POLICY "admin_engineer_can_update_templates"
ON mapping_templates FOR UPDATE
USING (is_member_of_tenant(tenant_id))
WITH CHECK (
  is_member_of_tenant(tenant_id)
  AND (
    SELECT role FROM tenant_memberships
    WHERE tenant_id = mapping_templates.tenant_id
    AND user_id = auth.uid()
  ) IN ('admin', 'engineer')
);

-- DELETE: Admin only
CREATE POLICY "admin_can_delete_templates"
ON mapping_templates FOR DELETE
USING (
  is_member_of_tenant(tenant_id)
  AND (
    SELECT role FROM tenant_memberships
    WHERE tenant_id = mapping_templates.tenant_id
    AND user_id = auth.uid()
  ) = 'admin'
);

-- ============================================================================
-- dpgf_imports: Update mapping status columns (if not already present)
-- ============================================================================

-- Ensure RLS is enabled (should already be from Sprint 1)
-- ALTER TABLE dpgf_imports ENABLE ROW LEVEL SECURITY;

-- Allow users to view imports (already exists from Sprint 1)
-- Allow updating mapping status (new policy)
CREATE POLICY "members_can_update_import_mapping_status"
ON dpgf_imports FOR UPDATE
USING (
  is_member_of_tenant(tenant_id)
  AND (
    SELECT role FROM tenant_memberships
    WHERE tenant_id = dpgf_imports.tenant_id
    AND user_id = auth.uid()
  ) IN ('admin', 'engineer')
)
WITH CHECK (
  is_member_of_tenant(tenant_id)
  AND tenant_id = NEW.tenant_id  -- Can't change tenant
);
