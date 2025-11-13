/**
 * Database Mappers
 *
 * Transforms between camelCase API schemas (Zod) and snake_case database tables (Supabase).
 *
 * Context:
 * - API layer uses camelCase for consistency with TypeScript/JavaScript conventions
 * - Database uses snake_case following PostgreSQL conventions
 * - These mappers ensure type-safe bidirectional transformations
 *
 * Usage:
 * - toDb*: Transform API input → Database row (before INSERT/UPDATE)
 * - fromDb*: Transform Database row → API output (after SELECT)
 */

import type {
  CatalogueItem,
  CatalogueItemInput,
  SupplierPrice,
  SupplierPriceInput,
  MaterialIndex,
  MaterialIndexInput,
} from '../schemas';

// ============================================================================
// Database Row Types (snake_case)
// ============================================================================

export interface DbCatalogueItem {
  id: string;
  tenant_id: string;
  hex_code: string;
  designation: string;
  temps_unitaire_h: number | null;
  unite_mesure: string | null;
  dn: string | null;
  pn: string | null;
  matiere: string | null;
  connexion: string | null;
  discipline: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbSupplierPrice {
  id: string;
  tenant_id: string;
  catalogue_item_id: string;
  supplier_name: string;
  prix_brut: number;
  remise_pct: number | null;
  prix_net: number | null; // GENERATED column
  validite_fin: string | null; // DATE
  delai_jours: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbMaterialIndex {
  id: string;
  tenant_id: string;
  matiere: string;
  index_date: string; // DATE
  coefficient: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Catalogue Item Mappers
// ============================================================================

export function toDbCatalogueItem(
  item: CatalogueItemInput & { tenantId: string }
): Omit<DbCatalogueItem, 'id' | 'created_at' | 'updated_at'> {
  return {
    tenant_id: item.tenantId,
    hex_code: item.hexCode,
    designation: item.designation,
    temps_unitaire_h: item.tempsUnitaireH ?? null,
    unite_mesure: item.uniteMesure ?? null,
    dn: item.dn ?? null,
    pn: item.pn ?? null,
    matiere: item.matiere ?? null,
    connexion: item.connexion ?? null,
    discipline: item.discipline ?? null,
  };
}

export function fromDbCatalogueItem(row: DbCatalogueItem): CatalogueItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    hexCode: row.hex_code,
    designation: row.designation,
    tempsUnitaireH: row.temps_unitaire_h ?? undefined,
    uniteMesure: row.unite_mesure ?? undefined,
    dn: row.dn ?? undefined,
    pn: row.pn ?? undefined,
    matiere: row.matiere ?? undefined,
    connexion: row.connexion ?? undefined,
    discipline: row.discipline ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Supplier Price Mappers
// ============================================================================

export function toDbSupplierPrice(
  price: SupplierPriceInput & { tenantId: string }
): Omit<DbSupplierPrice, 'id' | 'prix_net' | 'created_at' | 'updated_at'> {
  return {
    tenant_id: price.tenantId,
    catalogue_item_id: price.catalogueItemId,
    supplier_name: price.supplierName,
    prix_brut: price.prixBrut,
    remise_pct: price.remisePct ?? null,
    // prix_net is auto-calculated as GENERATED column
    validite_fin: price.validiteFin ?? null,
    delai_jours: price.delaiJours ?? null,
  };
}

export function fromDbSupplierPrice(row: DbSupplierPrice): SupplierPrice {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    catalogueItemId: row.catalogue_item_id,
    supplierName: row.supplier_name,
    prixBrut: row.prix_brut,
    remisePct: row.remise_pct ?? undefined,
    prixNet: row.prix_net ?? undefined, // Auto-calculated
    validiteFin: row.validite_fin ?? undefined,
    delaiJours: row.delai_jours ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Material Index Mappers
// ============================================================================

export function toDbMaterialIndex(
  index: MaterialIndexInput & { tenantId: string }
): Omit<DbMaterialIndex, 'id' | 'created_at' | 'updated_at'> {
  return {
    tenant_id: index.tenantId,
    matiere: index.matiere,
    index_date: index.indexDate,
    coefficient: index.coefficient,
  };
}

export function fromDbMaterialIndex(row: DbMaterialIndex): MaterialIndex {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    matiere: row.matiere,
    indexDate: row.index_date,
    coefficient: row.coefficient,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Bulk Operation Helpers
// ============================================================================

/**
 * Transform bulk supplier prices for RPC function
 * Handles array of inputs → JSONB format for bulk_create_supplier_prices()
 */
export function toBulkSupplierPrices(
  prices: Array<SupplierPriceInput & { tenantId: string }>
): Array<Omit<DbSupplierPrice, 'id' | 'prix_net' | 'created_at' | 'updated_at'>> {
  return prices.map(toDbSupplierPrice);
}

/**
 * Transform bulk material indices for RPC function
 * Handles array of inputs → JSONB format for bulk_upsert_material_indices()
 */
export function toBulkMaterialIndices(
  indices: Array<MaterialIndexInput & { tenantId: string }>
): Array<Omit<DbMaterialIndex, 'id' | 'created_at' | 'updated_at'>> {
  return indices.map(toDbMaterialIndex);
}
