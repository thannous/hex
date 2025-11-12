-- Sprint 1: Row Level Security (RLS) pour multi-tenant
-- ==============================================================================
-- Isoler les données par tenant_id automatiquement

-- STEP 1: Helper Functions
-- ==============================================================================

-- Obtenir le tenant_id de l'utilisateur courant
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM tenant_memberships
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_tenant_id() IS 'Retourne le tenant_id de l utilisateur authentifié';

-- Vérifier si l'utilisateur est admin du tenant
CREATE OR REPLACE FUNCTION is_admin_of(tenant UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM tenant_memberships
    WHERE user_id = auth.uid()
      AND tenant_id = tenant
      AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_admin_of(tenant UUID) IS 'Vérifier rôle admin pour un tenant';

-- Vérifier si l'utilisateur est membre du tenant
CREATE OR REPLACE FUNCTION is_member_of(tenant UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM tenant_memberships
    WHERE user_id = auth.uid()
      AND tenant_id = tenant
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_member_of(tenant UUID) IS 'Vérifier membership pour un tenant';

-- STEP 2: Enable RLS on all tenant-scoped tables
-- ==============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_indices ENABLE ROW LEVEL SECURITY;
ALTER TABLE dpgf_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dpgf_rows_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE dpgf_rows_mapped ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- STEP 3: Tenants Policies
-- ==============================================================================

CREATE POLICY "users_can_view_own_tenants"
  ON tenants FOR SELECT
  USING (is_member_of(id));

-- STEP 4: Profiles Policies
-- ==============================================================================

CREATE POLICY "users_can_view_own_profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_can_update_own_profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- STEP 5: Tenant Memberships Policies
-- ==============================================================================

CREATE POLICY "admins_can_view_memberships"
  ON tenant_memberships FOR SELECT
  USING (is_admin_of(tenant_id) OR user_id = auth.uid());

CREATE POLICY "admins_can_manage_memberships"
  ON tenant_memberships FOR INSERT
  WITH CHECK (is_admin_of(tenant_id));

CREATE POLICY "admins_can_update_memberships"
  ON tenant_memberships FOR UPDATE
  USING (is_admin_of(tenant_id))
  WITH CHECK (is_admin_of(tenant_id));

CREATE POLICY "prevent_role_change_after_create"
  ON tenant_memberships FOR UPDATE
  USING (is_admin_of(tenant_id))
  WITH CHECK (is_admin_of(tenant_id));

-- STEP 6: Catalogue Items Policies
-- ==============================================================================

CREATE POLICY "members_can_view_catalogue"
  ON catalogue_items FOR SELECT
  USING (is_member_of(tenant_id));

CREATE POLICY "engineers_and_admins_can_insert_catalogue"
  ON catalogue_items FOR INSERT
  WITH CHECK (
    is_member_of(tenant_id)
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = catalogue_items.tenant_id
        AND role IN ('admin', 'engineer')
    )
  );

CREATE POLICY "engineers_and_admins_can_update_catalogue"
  ON catalogue_items FOR UPDATE
  USING (
    is_member_of(tenant_id)
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = catalogue_items.tenant_id
        AND role IN ('admin', 'engineer')
    )
  )
  WITH CHECK (
    is_member_of(tenant_id)
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = catalogue_items.tenant_id
        AND role IN ('admin', 'engineer')
    )
  );

CREATE POLICY "prevent_tenant_change_catalogue"
  ON catalogue_items FOR UPDATE
  USING (is_member_of(tenant_id))
  WITH CHECK (tenant_id = OLD.tenant_id);

-- STEP 7: Supplier Prices Policies
-- ==============================================================================

CREATE POLICY "members_can_view_prices"
  ON supplier_prices FOR SELECT
  USING (is_member_of(tenant_id));

CREATE POLICY "engineers_and_admins_can_manage_prices"
  ON supplier_prices FOR INSERT
  WITH CHECK (
    is_member_of(tenant_id)
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = supplier_prices.tenant_id
        AND role IN ('admin', 'engineer')
    )
  );

CREATE POLICY "engineers_and_admins_can_update_prices"
  ON supplier_prices FOR UPDATE
  USING (
    is_member_of(tenant_id)
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = supplier_prices.tenant_id
        AND role IN ('admin', 'engineer')
    )
  )
  WITH CHECK (is_member_of(tenant_id));

CREATE POLICY "prevent_tenant_change_prices"
  ON supplier_prices FOR UPDATE
  USING (is_member_of(tenant_id))
  WITH CHECK (tenant_id = OLD.tenant_id);

-- STEP 8: Material Indices Policies
-- ==============================================================================

CREATE POLICY "members_can_view_indices"
  ON material_indices FOR SELECT
  USING (is_member_of(tenant_id));

CREATE POLICY "engineers_and_admins_can_manage_indices"
  ON material_indices FOR INSERT
  WITH CHECK (
    is_member_of(tenant_id)
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = material_indices.tenant_id
        AND role IN ('admin', 'engineer')
    )
  );

CREATE POLICY "engineers_and_admins_can_update_indices"
  ON material_indices FOR UPDATE
  USING (
    is_member_of(tenant_id)
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = material_indices.tenant_id
        AND role IN ('admin', 'engineer')
    )
  )
  WITH CHECK (is_member_of(tenant_id));

-- STEP 9: DPGF Imports Policies
-- ==============================================================================

CREATE POLICY "members_can_view_imports"
  ON dpgf_imports FOR SELECT
  USING (is_member_of(tenant_id));

CREATE POLICY "engineers_and_admins_can_create_imports"
  ON dpgf_imports FOR INSERT
  WITH CHECK (
    is_member_of(tenant_id)
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = dpgf_imports.tenant_id
        AND role IN ('admin', 'engineer')
    )
  );

-- STEP 10: DPGF Rows Policies
-- ==============================================================================

CREATE POLICY "members_can_view_dpgf_rows_raw"
  ON dpgf_rows_raw FOR SELECT
  USING (is_member_of(tenant_id));

CREATE POLICY "members_can_view_dpgf_rows_mapped"
  ON dpgf_rows_mapped FOR SELECT
  USING (is_member_of(tenant_id));

CREATE POLICY "engineers_can_update_mapped_rows"
  ON dpgf_rows_mapped FOR UPDATE
  USING (
    is_member_of(tenant_id)
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = dpgf_rows_mapped.tenant_id
        AND role IN ('admin', 'engineer')
    )
  )
  WITH CHECK (is_member_of(tenant_id));

-- STEP 11: Mapping Memory Policies
-- ==============================================================================

CREATE POLICY "members_can_view_mapping_memory"
  ON mapping_memory FOR SELECT
  USING (is_member_of(tenant_id));

CREATE POLICY "system_can_update_mapping_memory"
  ON mapping_memory FOR INSERT
  WITH CHECK (is_member_of(tenant_id));

CREATE POLICY "system_can_update_memory_usage"
  ON mapping_memory FOR UPDATE
  USING (is_member_of(tenant_id))
  WITH CHECK (is_member_of(tenant_id));

-- STEP 12: Pricing Params Policies
-- ==============================================================================

CREATE POLICY "members_can_view_pricing_params"
  ON pricing_params FOR SELECT
  USING (is_member_of(tenant_id));

CREATE POLICY "admins_can_manage_pricing_params"
  ON pricing_params FOR INSERT
  WITH CHECK (
    is_member_of(tenant_id)
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = pricing_params.tenant_id
        AND role = 'admin'
    )
  );

CREATE POLICY "admins_can_update_pricing_params"
  ON pricing_params FOR UPDATE
  USING (
    is_member_of(tenant_id)
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = pricing_params.tenant_id
        AND role = 'admin'
    )
  )
  WITH CHECK (is_member_of(tenant_id));

-- STEP 13: Quotes & Quote Lines Policies
-- ==============================================================================

CREATE POLICY "members_can_view_quotes"
  ON quotes FOR SELECT
  USING (is_member_of(tenant_id));

CREATE POLICY "engineers_can_create_quotes"
  ON quotes FOR INSERT
  WITH CHECK (
    is_member_of(tenant_id)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = quotes.tenant_id
        AND role IN ('admin', 'engineer')
    )
  );

CREATE POLICY "engineers_can_update_own_quotes"
  ON quotes FOR UPDATE
  USING (
    is_member_of(tenant_id)
    AND (created_by = auth.uid() OR is_admin_of(tenant_id))
  )
  WITH CHECK (is_member_of(tenant_id));

CREATE POLICY "members_can_view_quote_lines"
  ON quote_lines FOR SELECT
  USING (is_member_of(tenant_id));

CREATE POLICY "engineers_can_manage_quote_lines"
  ON quote_lines FOR INSERT
  WITH CHECK (
    is_member_of(tenant_id)
    AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND tenant_id = quote_lines.tenant_id
        AND role IN ('admin', 'engineer')
    )
  );

-- STEP 14: Audit Logs Policies
-- ==============================================================================

CREATE POLICY "members_can_view_audit_logs"
  ON audit_logs FOR SELECT
  USING (is_member_of(tenant_id));

CREATE POLICY "admins_only_view_audit_logs"
  ON audit_logs FOR SELECT
  USING (
    is_member_of(tenant_id)
    AND is_admin_of(tenant_id)
  );

-- Audit logs ne peuvent pas être modifiés directement
ALTER TABLE audit_logs DISABLE TRIGGER ALL;

COMMIT;
