-- Sprint 1: Seed Data pour tests
-- ==============================================================================

-- Désactiver RLS temporairement pour le seeding
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_prices DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_indices DISABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_params DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines DISABLE ROW LEVEL SECURITY;

-- STEP 1: Create Test Tenants
-- ==============================================================================

INSERT INTO tenants (id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111'::UUID, 'HEX Ops Demo', 'hex-demo'),
  ('22222222-2222-2222-2222-222222222222'::UUID, 'Entreprise ABC', 'abc-corp')
ON CONFLICT (slug) DO NOTHING;

-- STEP 2: Create Test Users (profiles)
-- ==============================================================================

-- Note: Pour les vrais tests, utiliser Supabase Auth API
-- Ici on crée juste les profiles dans la table
INSERT INTO profiles (id, email, full_name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID, 'admin@hexops.demo', 'Admin Demo'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID, 'engineer@hexops.demo', 'Engineer Demo'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc'::UUID, 'viewer@hexops.demo', 'Viewer Demo'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID, 'admin@abc.corp', 'Admin ABC')
ON CONFLICT (id) DO NOTHING;

-- STEP 3: Assign Users to Tenants (Tenant Memberships)
-- ==============================================================================

INSERT INTO tenant_memberships (user_id, tenant_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID, '11111111-1111-1111-1111-111111111111'::UUID, 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID, '11111111-1111-1111-1111-111111111111'::UUID, 'engineer'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc'::UUID, '11111111-1111-1111-1111-111111111111'::UUID, 'viewer'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID, '22222222-2222-2222-2222-222222222222'::UUID, 'admin')
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- STEP 4: Create Pricing Parameters
-- ==============================================================================

INSERT INTO pricing_params (tenant_id, lot, taux_horaire_eur, marge_pct) VALUES
  ('11111111-1111-1111-1111-111111111111'::UUID, 'CVC', 45.00, 20.0),
  ('11111111-1111-1111-1111-111111111111'::UUID, 'Plomberie', 40.00, 18.0),
  ('22222222-2222-2222-2222-222222222222'::UUID, NULL, 50.00, 22.0)
ON CONFLICT DO NOTHING;

-- STEP 5: Create Catalogue Items
-- ==============================================================================

INSERT INTO catalogue_items (
  tenant_id, hex_code, designation, temps_unitaire_h,
  unite_mesure, dn, pn, matiere, connexion, discipline
) VALUES
  -- Tenant 1: HEX Demo
  ('11111111-1111-1111-1111-111111111111'::UUID, 'HEX001', 'Thermostat Digital', 0.5, 'u', NULL, NULL, 'Electrique', 'M', 'CVC'),
  ('11111111-1111-1111-1111-111111111111'::UUID, 'HEX002', 'Radiateur Acier 600x1500', 2.0, 'u', NULL, NULL, 'Acier', NULL, 'CVC'),
  ('11111111-1111-1111-1111-111111111111'::UUID, 'HEX003', 'Tuyau Cuivre 18mm', 0.3, 'm', '18', NULL, 'Cuivre', NULL, 'Plomberie'),
  ('11111111-1111-1111-1111-111111111111'::UUID, 'HEX004', 'Robinet Thermostatique', 1.0, 'u', '15', NULL, 'Laiton', 'M18', 'Plomberie'),
  ('11111111-1111-1111-1111-111111111111'::UUID, 'HEX005', 'Vanne d Arrêt 20mm', 0.8, 'u', '20', NULL, 'Laiton', 'F20', 'Plomberie'),

  -- Tenant 2: ABC Corp (même catalogue mais copie)
  ('22222222-2222-2222-2222-222222222222'::UUID, 'ABC001', 'Pompe Circulante', 3.5, 'u', NULL, NULL, 'Fonte', NULL, 'CVC'),
  ('22222222-2222-2222-2222-222222222222'::UUID, 'ABC002', 'Chauffeau Électrique 200L', 5.0, 'u', NULL, NULL, 'Acier', NULL, 'CVC'),
  ('22222222-2222-2222-2222-222222222222'::UUID, 'ABC003', 'Flexible Inox 100cm', 0.2, 'u', '15', NULL, 'Inox', 'M15', 'Plomberie')
ON CONFLICT (tenant_id, hex_code) DO NOTHING;

-- STEP 6: Create Supplier Prices
-- ==============================================================================

INSERT INTO supplier_prices (
  tenant_id, catalogue_item_id, supplier_name,
  prix_brut, remise_pct, validite_fin, delai_jours
) VALUES
  -- HEX001 - Thermostat
  (
    '11111111-1111-1111-1111-111111111111'::UUID,
    (SELECT id FROM catalogue_items WHERE hex_code = 'HEX001' AND tenant_id = '11111111-1111-1111-1111-111111111111'),
    'Fournisseur A',
    45.00, 5.0, (CURRENT_DATE + INTERVAL '180 days'), 3
  ),
  (
    '11111111-1111-1111-1111-111111111111'::UUID,
    (SELECT id FROM catalogue_items WHERE hex_code = 'HEX001' AND tenant_id = '11111111-1111-1111-1111-111111111111'),
    'Fournisseur B',
    43.50, 8.0, (CURRENT_DATE + INTERVAL '90 days'), 5
  ),

  -- HEX002 - Radiateur
  (
    '11111111-1111-1111-1111-111111111111'::UUID,
    (SELECT id FROM catalogue_items WHERE hex_code = 'HEX002' AND tenant_id = '11111111-1111-1111-1111-111111111111'),
    'Fournisseur A',
    125.00, 10.0, (CURRENT_DATE + INTERVAL '200 days'), 7
  ),

  -- HEX003 - Tuyau Cuivre
  (
    '11111111-1111-1111-1111-111111111111'::UUID,
    (SELECT id FROM catalogue_items WHERE hex_code = 'HEX003' AND tenant_id = '11111111-1111-1111-1111-111111111111'),
    'Fournisseur C',
    8.50, 2.0, (CURRENT_DATE + INTERVAL '120 days'), 4
  ),

  -- ABC001 - Pompe
  (
    '22222222-2222-2222-2222-222222222222'::UUID,
    (SELECT id FROM catalogue_items WHERE hex_code = 'ABC001' AND tenant_id = '22222222-2222-2222-2222-222222222222'),
    'Fournisseur X',
    280.00, 12.0, (CURRENT_DATE + INTERVAL '150 days'), 5
  )
ON CONFLICT DO NOTHING;

-- STEP 7: Create Material Indices
-- ==============================================================================

INSERT INTO material_indices (tenant_id, matiere, index_date, coefficient) VALUES
  -- HEX Ops Demo
  ('11111111-1111-1111-1111-111111111111'::UUID, 'Cuivre', CURRENT_DATE, 1.15),
  ('11111111-1111-1111-1111-111111111111'::UUID, 'Cuivre', CURRENT_DATE - INTERVAL '30 days', 1.10),
  ('11111111-1111-1111-1111-111111111111'::UUID, 'Acier', CURRENT_DATE, 1.08),
  ('11111111-1111-1111-1111-111111111111'::UUID, 'Laiton', CURRENT_DATE, 1.12),

  -- ABC Corp
  ('22222222-2222-2222-2222-222222222222'::UUID, 'Fonte', CURRENT_DATE, 1.05),
  ('22222222-2222-2222-2222-222222222222'::UUID, 'Inox', CURRENT_DATE, 1.20)
ON CONFLICT (tenant_id, matiere, index_date) DO NOTHING;

-- STEP 8: Create Test Quotes
-- ==============================================================================

INSERT INTO quotes (
  tenant_id, created_by, name, reference, status, valid_until
) VALUES
  (
    '11111111-1111-1111-1111-111111111111'::UUID,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
    'Devis Rénovation Chauffage - Client X',
    'DEV-2024-001',
    'draft',
    CURRENT_DATE + INTERVAL '30 days'
  ),
  (
    '11111111-1111-1111-1111-111111111111'::UUID,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
    'Devis Plomberie Salle de Bain - Client Y',
    'DEV-2024-002',
    'draft',
    CURRENT_DATE + INTERVAL '45 days'
  ),
  (
    '22222222-2222-2222-2222-222222222222'::UUID,
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID,
    'Dévis Chaufferie Complète',
    'ABC-2024-001',
    'draft',
    CURRENT_DATE + INTERVAL '60 days'
  )
ON CONFLICT DO NOTHING;

-- STEP 9: Create Quote Lines (examples)
-- ==============================================================================

-- Devis HEX Demo 1: Rénovation Chauffage
INSERT INTO quote_lines (
  tenant_id, quote_id, position, designation, quantity, unit,
  catalogue_item_id, cout_achat_u, mo_u, pv_u
) VALUES
  (
    '11111111-1111-1111-1111-111111111111'::UUID,
    (SELECT id FROM quotes WHERE reference = 'DEV-2024-001' LIMIT 1),
    1,
    'Thermostat Digital',
    2,
    'u',
    (SELECT id FROM catalogue_items WHERE hex_code = 'HEX001' AND tenant_id = '11111111-1111-1111-1111-111111111111'),
    42.75, -- prix_net calculé: 45*0.95
    0.50 * 45.00, -- MO: 0.5h * 45€/h
    NULL  -- sera calculé après
  ),
  (
    '11111111-1111-1111-1111-111111111111'::UUID,
    (SELECT id FROM quotes WHERE reference = 'DEV-2024-001' LIMIT 1),
    2,
    'Radiateur Acier 600x1500',
    1,
    'u',
    (SELECT id FROM catalogue_items WHERE hex_code = 'HEX002' AND tenant_id = '11111111-1111-1111-1111-111111111111'),
    112.50, -- prix_net calculé: 125*0.90
    2.0 * 45.00, -- MO: 2h * 45€/h
    NULL
  )
ON CONFLICT DO NOTHING;

-- Réactiver RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_indices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;

COMMIT;
