-- Sprint 1: Audit Triggers
-- ==============================================================================
-- Enregistrer automatiquement les changements

-- STEP 1: Audit Function
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER AS $$
DECLARE
  _tenant_id UUID;
BEGIN
  -- Déterminer le tenant_id selon la table
  IF TG_TABLE_NAME IN ('profiles', 'tenant_memberships') THEN
    IF TG_OP = 'DELETE' THEN
      _tenant_id := OLD.tenant_id;
    ELSE
      _tenant_id := NEW.tenant_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    _tenant_id := OLD.tenant_id;
  ELSE
    _tenant_id := NEW.tenant_id;
  END IF;

  -- Si pas de tenant_id, le chercher depuis profiles si user_id existe
  IF _tenant_id IS NULL THEN
    IF TG_OP = 'DELETE' AND OLD.user_id IS NOT NULL THEN
      SELECT tenant_id INTO _tenant_id FROM tenant_memberships
      WHERE user_id = OLD.user_id LIMIT 1;
    ELSIF TG_OP != 'DELETE' AND NEW.user_id IS NOT NULL THEN
      SELECT tenant_id INTO _tenant_id FROM tenant_memberships
      WHERE user_id = NEW.user_id LIMIT 1;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs(tenant_id, user_id, action, table_name, record_id, old_data)
    VALUES (_tenant_id, auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs(tenant_id, user_id, action, table_name, record_id, old_data, new_data)
    VALUES (_tenant_id, auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(tenant_id, user_id, action, table_name, record_id, new_data)
    VALUES (_tenant_id, auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit() IS 'Trigger function pour logging automatique des changements';

-- STEP 2: Triggers on Business Tables
-- ==============================================================================

-- Catalogue Items
CREATE TRIGGER audit_catalogue_items_insert
  AFTER INSERT ON catalogue_items
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_catalogue_items_update
  AFTER UPDATE ON catalogue_items
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_catalogue_items_delete
  AFTER DELETE ON catalogue_items
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Supplier Prices
CREATE TRIGGER audit_supplier_prices_insert
  AFTER INSERT ON supplier_prices
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_supplier_prices_update
  AFTER UPDATE ON supplier_prices
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_supplier_prices_delete
  AFTER DELETE ON supplier_prices
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Material Indices
CREATE TRIGGER audit_material_indices_insert
  AFTER INSERT ON material_indices
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_material_indices_update
  AFTER UPDATE ON material_indices
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_material_indices_delete
  AFTER DELETE ON material_indices
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- DPGF Imports
CREATE TRIGGER audit_dpgf_imports_insert
  AFTER INSERT ON dpgf_imports
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_dpgf_imports_update
  AFTER UPDATE ON dpgf_imports
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_dpgf_imports_delete
  AFTER DELETE ON dpgf_imports
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Pricing Params
CREATE TRIGGER audit_pricing_params_insert
  AFTER INSERT ON pricing_params
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_pricing_params_update
  AFTER UPDATE ON pricing_params
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_pricing_params_delete
  AFTER DELETE ON pricing_params
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Quotes
CREATE TRIGGER audit_quotes_insert
  AFTER INSERT ON quotes
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_quotes_update
  AFTER UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_quotes_delete
  AFTER DELETE ON quotes
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Quote Lines
CREATE TRIGGER audit_quote_lines_insert
  AFTER INSERT ON quote_lines
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_quote_lines_update
  AFTER UPDATE ON quote_lines
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_quote_lines_delete
  AFTER DELETE ON quote_lines
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- STEP 3: Utility Views for easier querying
-- ==============================================================================

-- Vue pour les prix nets actualisés (prix valides >90j)
CREATE OR REPLACE VIEW latest_supplier_prices AS
SELECT
  sp.*,
  CASE
    WHEN sp.validite_fin IS NULL THEN true
    WHEN sp.validite_fin > CURRENT_DATE THEN true
    ELSE false
  END AS is_valid,
  EXTRACT(DAY FROM (CURRENT_DATE - sp.validite_fin)) as days_since_expiry
FROM supplier_prices sp;

COMMENT ON VIEW latest_supplier_prices IS 'Prix fournisseurs avec flag validité';

-- Vue pour les indices matières les plus récents
CREATE OR REPLACE VIEW latest_material_indices AS
SELECT DISTINCT ON (tenant_id, matiere)
  *
FROM material_indices
ORDER BY tenant_id, matiere, index_date DESC;

COMMENT ON VIEW latest_material_indices IS 'Index matière le plus récent par matière et tenant';

COMMIT;
