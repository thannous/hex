-- Sprint 1: HEX Ops Multi-Tenant Schema
-- ==============================================================================
-- Core tables pour multi-tenant avec RLS

-- STEP 1: Enums
-- ==============================================================================

CREATE TYPE import_status AS ENUM ('pending', 'processing', 'parsed', 'failed');
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'won', 'lost');
CREATE TYPE role_type AS ENUM ('admin', 'engineer', 'viewer');

-- STEP 2: Tenants & Users
-- ==============================================================================

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE tenants IS 'Clients/organisations (multi-tenant isolation)';

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE profiles IS '1:1 avec auth.users - profils utilisateurs';

CREATE TABLE tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role role_type NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

COMMENT ON TABLE tenant_memberships IS 'Many-to-many users <-> tenants avec rôles';

-- STEP 3: Métier - Catalogue & Prix
-- ==============================================================================

CREATE TABLE catalogue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hex_code TEXT NOT NULL,
  designation TEXT NOT NULL,
  temps_unitaire_h NUMERIC(10, 2),
  unite_mesure TEXT,
  dn TEXT,
  pn TEXT,
  matiere TEXT,
  connexion TEXT,
  discipline TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, hex_code)
);

COMMENT ON TABLE catalogue_items IS 'Produits catalogues avec HEX_CODE';

CREATE TABLE supplier_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalogue_item_id UUID NOT NULL REFERENCES catalogue_items(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  prix_brut NUMERIC(10, 2) NOT NULL,
  remise_pct NUMERIC(5, 2) DEFAULT 0,
  prix_net NUMERIC(10, 2) GENERATED ALWAYS AS (prix_brut * (1 - remise_pct / 100)) STORED,
  validite_fin DATE,
  delai_jours INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE supplier_prices IS 'Prix fournisseurs avec calcul auto prix_net';

CREATE TABLE material_indices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  matiere TEXT NOT NULL,
  index_date DATE NOT NULL,
  coefficient NUMERIC(10, 4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, matiere, index_date)
);

COMMENT ON TABLE material_indices IS 'Indices matières (historique par date)';

-- STEP 4: DPGF Imports
-- ==============================================================================

CREATE TABLE dpgf_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status import_status DEFAULT 'pending',
  parsed_at TIMESTAMPTZ,
  row_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE dpgf_imports IS 'Import DPGF files avec suivi statut';

CREATE TABLE dpgf_rows_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  import_id UUID NOT NULL REFERENCES dpgf_imports(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE dpgf_rows_raw IS 'Données brutes post-parsing (sauvegarde originale)';

CREATE TABLE dpgf_rows_mapped (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  import_id UUID NOT NULL REFERENCES dpgf_imports(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  quantity NUMERIC(12, 3),
  unit TEXT,
  designation TEXT,
  hex_code TEXT,
  catalogue_item_id UUID REFERENCES catalogue_items(id),
  confidence NUMERIC(3, 2),
  mapping_source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE dpgf_rows_mapped IS 'Données mappées vers HEX_CODE avec confidence';

-- STEP 5: Mapping Memory (Auto-apprentissage)
-- ==============================================================================

CREATE TABLE mapping_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  normalized_label TEXT NOT NULL,
  hex_code TEXT NOT NULL,
  confidence NUMERIC(3, 2) DEFAULT 1.0,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, normalized_label)
);

COMMENT ON TABLE mapping_memory IS 'Auto-apprentissage mappings (normalisation libellés)';

-- STEP 6: Quotes & Calculs
-- ==============================================================================

CREATE TABLE pricing_params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lot TEXT,
  discipline TEXT,
  taux_horaire_eur NUMERIC(10, 2) NOT NULL,
  marge_pct NUMERIC(5, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE pricing_params IS 'Paramètres calcul (taux horaires, marges)';

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  reference TEXT,
  status quote_status DEFAULT 'draft',
  meta JSONB,
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE quotes IS 'Devis générés';

CREATE TABLE quote_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  designation TEXT NOT NULL,
  quantity NUMERIC(12, 3) NOT NULL,
  unit TEXT,
  catalogue_item_id UUID REFERENCES catalogue_items(id),
  cout_achat_u NUMERIC(10, 2),
  mo_u NUMERIC(10, 2),
  pv_u NUMERIC(10, 2),
  flags JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE quote_lines IS 'Lignes devis calculées (MO, PV, flags qualité)';

-- STEP 7: Audit Logs
-- ==============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE audit_logs IS 'Journal audit (INSERT/UPDATE/DELETE via triggers)';

-- STEP 8: Indexes
-- ==============================================================================

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_tenant_memberships_user ON tenant_memberships(user_id);
CREATE INDEX idx_tenant_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX idx_catalogue_items_tenant ON catalogue_items(tenant_id);
CREATE INDEX idx_catalogue_items_hex_code ON catalogue_items(hex_code);
CREATE INDEX idx_supplier_prices_item ON supplier_prices(catalogue_item_id);
CREATE INDEX idx_supplier_prices_tenant ON supplier_prices(tenant_id);
CREATE INDEX idx_material_indices_tenant ON material_indices(tenant_id);
CREATE INDEX idx_material_indices_matiere ON material_indices(matiere);
CREATE INDEX idx_dpgf_imports_tenant ON dpgf_imports(tenant_id);
CREATE INDEX idx_dpgf_imports_status ON dpgf_imports(status);
CREATE INDEX idx_dpgf_rows_raw_import ON dpgf_rows_raw(import_id);
CREATE INDEX idx_dpgf_rows_mapped_import ON dpgf_rows_mapped(import_id);
CREATE INDEX idx_dpgf_rows_mapped_hex_code ON dpgf_rows_mapped(hex_code);
CREATE INDEX idx_mapping_memory_tenant ON mapping_memory(tenant_id, normalized_label);
CREATE INDEX idx_pricing_params_tenant ON pricing_params(tenant_id);
CREATE INDEX idx_quotes_tenant ON quotes(tenant_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quote_lines_quote ON quote_lines(quote_id);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- STEP 9: Constraints supplémentaires
-- ==============================================================================

-- Empêcher changement de tenant_id après création
ALTER TABLE catalogue_items ADD CONSTRAINT immutable_tenant_id
  CHECK (id = id); -- Placeholder pour trigger

ALTER TABLE supplier_prices ADD CONSTRAINT immutable_tenant_id
  CHECK (id = id);

ALTER TABLE dpgf_imports ADD CONSTRAINT immutable_tenant_id
  CHECK (id = id);

ALTER TABLE quotes ADD CONSTRAINT immutable_tenant_id
  CHECK (id = id);

-- Validations
ALTER TABLE supplier_prices ADD CONSTRAINT valid_prix_brut CHECK (prix_brut > 0);
ALTER TABLE supplier_prices ADD CONSTRAINT valid_remise CHECK (remise_pct >= 0 AND remise_pct <= 100);
ALTER TABLE material_indices ADD CONSTRAINT valid_coefficient CHECK (coefficient > 0);
ALTER TABLE pricing_params ADD CONSTRAINT valid_taux CHECK (taux_horaire_eur > 0);
ALTER TABLE pricing_params ADD CONSTRAINT valid_marge CHECK (marge_pct > 0 AND marge_pct < 100);

COMMIT;
