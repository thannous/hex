# Sprint 4: Catalogue & Pricebook - Technical Decisions

## Context

Sprint 4 builds upon Sprint 3's mapping system to implement catalogue management, supplier prices, and material indices. This document records critical technical decisions, trade-offs, and solutions to implementation challenges.

## Date: 2025-11-13
## Status: Day 1 Complete

---

## Decision 1: Bulk Operations via PostgreSQL RPC Functions

### Problem
Supabase JS client doesn't support multi-statement transactions. When creating multiple supplier prices or material indices atomically, we need all-or-nothing semantics for data integrity.

### Solution
Implemented PostgreSQL RPC functions:
- `bulk_create_supplier_prices(tenant_id, prices[])`
- `bulk_upsert_material_indices(tenant_id, indices[])`

### Implementation
**File**: `supabase/migrations/008_bulk_operations.sql`

```sql
CREATE OR REPLACE FUNCTION bulk_create_supplier_prices(
  p_tenant_id uuid,
  p_prices jsonb
) RETURNS jsonb AS $$
DECLARE
  v_created_count integer := 0;
  v_error_count integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_price jsonb;
BEGIN
  FOR v_price IN SELECT * FROM jsonb_array_elements(p_prices)
  LOOP
    BEGIN
      -- Validate catalogue_item belongs to tenant
      -- Insert with error collection
      v_created_count := v_created_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object(
          'catalogue_item_id', v_price->>'catalogue_item_id',
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
```

### Trade-offs
**Pros**:
- True atomic operations
- Server-side validation
- Error collection without full rollback
- Consistent with Sprint 3 pattern

**Cons**:
- More complex than JS-only code
- Requires migration for changes
- JSONB parameter limits (1GB in practice)

### Performance
- Expected: 1000 prices in <500ms
- No network round-trips per item
- Single connection, single transaction

---

## Decision 2: Auto-calculation via Database Triggers

### Problem
`supplier_prices.prix_net` must be computed as `prix_brut * (1 - remise_pct/100)`. Computing in application code risks inconsistency if direct SQL updates occur.

### Solution
Implemented PostgreSQL trigger:

```sql
CREATE FUNCTION calculate_prix_net() RETURNS TRIGGER AS $$
BEGIN
  NEW.prix_net := NEW.prix_brut * (1 - COALESCE(NEW.remise_pct, 0) / 100.0);
  IF NEW.prix_net < 0 THEN
    NEW.prix_net := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_prix_net
BEFORE INSERT OR UPDATE OF prix_brut, remise_pct ON supplier_prices
FOR EACH ROW EXECUTE FUNCTION calculate_prix_net();
```

### Implementation
**File**: `supabase/migrations/009_add_unique_constraints.sql`

### Trade-offs
**Pros**:
- Guaranteed consistency
- Works for all data entry methods (UI, SQL, bulk RPC)
- No application logic needed
- Indexed for query performance

**Cons**:
- Requires migration to change formula
- Not visible in TypeScript type system
- Debugging requires SQL knowledge

### Verification
Backfilled existing records:
```sql
UPDATE supplier_prices
SET prix_net = prix_brut * (1 - COALESCE(remise_pct, 0) / 100.0)
WHERE prix_net IS NULL;
```

---

## Decision 3: camelCase ↔ snake_case Mapping Layer

### Problem
API schemas use camelCase (TypeScript convention):
```typescript
interface CatalogueItem {
  hexCode: string;
  catalogueItemId: string;
  tempsUnitaireH: number;
}
```

Database uses snake_case (PostgreSQL convention):
```sql
CREATE TABLE catalogue_items (
  hex_code text,
  catalogue_item_id uuid,
  temps_unitaire_h numeric
);
```

### Solution
Created `packages/api/src/lib/dbMappers.ts` with bidirectional transformation functions:

```typescript
export function toDbCatalogueItem(
  item: CatalogueItemInput & { tenantId: string }
): Omit<DbCatalogueItem, 'id' | 'created_at' | 'updated_at'> {
  return {
    tenant_id: item.tenantId,
    hex_code: item.hexCode,
    temps_unitaire_h: item.tempsUnitaireH ?? null,
    // ...
  };
}

export function fromDbCatalogueItem(row: DbCatalogueItem): CatalogueItem {
  return {
    tenantId: row.tenant_id,
    hexCode: row.hex_code,
    tempsUnitaireH: row.temps_unitaire_h ?? undefined,
    // ...
  };
}
```

### Trade-offs
**Pros**:
- Clear separation of concerns
- Type-safe transformations
- Consistent API surface
- Easy to test

**Cons**:
- Manual mapping code (could use library like `camelcase-keys`)
- Must update mappers when schema changes
- Slight runtime overhead

### Alternative Considered
Use `camelcase-keys` / `snakecase-keys` libraries:
- **Rejected**: Less type-safe, harder to trace transformations, adds dependency

---

## Decision 4: UNIQUE Constraint on Material Indices

### Problem
`material_indices` table allowed duplicate entries for same (tenant, matiere, date) combination, causing ambiguous lookups.

### Solution
Added UNIQUE constraint:

```sql
ALTER TABLE material_indices
ADD CONSTRAINT unique_material_index
UNIQUE (tenant_id, matiere, index_date);
```

### Implementation
**File**: `supabase/migrations/009_add_unique_constraints.sql`

### Trade-offs
**Pros**:
- Enforces data integrity at database level
- Enables `ON CONFLICT` upsert logic
- Simplifies queries (no need for DISTINCT ON)

**Cons**:
- Migration fails if duplicates exist (requires cleanup first)
- Slightly slower inserts (index maintenance)

### Migration Safety
Constraint added after Sprint 3 (no legacy data expected). For production:
```sql
-- Cleanup script if needed
DELETE FROM material_indices a
USING material_indices b
WHERE a.id > b.id
  AND a.tenant_id = b.tenant_id
  AND a.matiere = b.matiere
  AND a.index_date = b.index_date;
```

---

## Decision 5: Sprint 3 → Sprint 4 Integration Helpers

### Problem
After mapping columns in Sprint 3, we need to:
1. Auto-create `catalogue_items` for new hex_codes
2. Link `dpgf_rows_mapped.catalogue_item_id` to existing catalogue

### Solution
Implemented helper functions:

```sql
-- 1. Create catalogue items from unmapped rows
CREATE FUNCTION import_catalogue_from_mapping(
  p_tenant_id uuid,
  p_import_id uuid
) RETURNS jsonb;

-- 2. Link mapped rows to catalogue
CREATE FUNCTION link_mapped_rows_to_catalogue(
  p_tenant_id uuid,
  p_import_id uuid
) RETURNS jsonb;

-- 3. Composite: both operations in one transaction
CREATE FUNCTION import_and_link_catalogue(
  p_tenant_id uuid,
  p_import_id uuid
) RETURNS jsonb;
```

### Implementation
**File**: `supabase/migrations/010_catalogue_helpers.sql`

### Usage Flow
```typescript
// After user completes mapping in Sprint 3 wizard:
const result = await trpc.catalogue.importFromMapping.mutate({
  importId: 'abc-123',
});

// result: { import: { created: 42, skipped: 3, errors: 0 }, link: { linked: 45 } }
```

### Trade-offs
**Pros**:
- Seamless Sprint 3 → Sprint 4 transition
- Automatic catalogue population
- Handles duplicates gracefully (DISTINCT ON + race condition handling)
- Returns detailed metrics

**Cons**:
- Only works for imports with hex_code mapped
- Doesn't handle updates to existing catalogue items
- First-row-wins strategy for duplicates within same import

### Future Enhancements (Sprint 5+)
- Conflict resolution UI when hex_code exists with different designation
- Bulk update for catalogue enrichment
- Validation rules before import

---

## Decision 6: Scope Reduction for Sprint 4

### Problem
Original proposal was too ambitious:
- 12+ tRPC procedures
- 6 React components
- 2 full wizards (CSV import, manual entry)
- AG Grid integration
- Charts and analytics

### Solution
**Moved to Sprint 5**:
- AG Grid (complex setup, license, theming)
- CSV import wizards
- Charts and dashboards
- Advanced filtering/sorting

**Sprint 4 Scope** (realistic):
- 3 tRPC routers (catalogue, prices, indices)
- 4 UI components (Modal, Table, Form, Manager)
- 2 pages (/catalogue, /prices)
- Basic CRUD operations
- Integration with Sprint 3

### Rationale
- Focus on stable API layer first
- UI can iterate in future sprints
- AG Grid requires significant R&D
- Prefer working software over feature bloat

---

## Decision 7: Daily Incremental Deliverables

### Approach
**Day 1**: Migrations + dbMappers ✅
**Day 2**: catalogueRouter + tests
**Day 3**: pricesRouter + UI foundations
**Day 4**: indicesRouter + CatalogueManager UI
**Day 5**: SupplierPriceManager UI + Pages
**Day 6**: Integration + PricingPreview
**Day 7**: E2E tests + docs + polish

### Benefits
- Each day produces committable code
- Continuous validation (not big-bang at end)
- Easy to adjust scope mid-sprint
- Clear progress tracking

### Risks Mitigated
- Avoid "90% done" syndrome
- Catch integration issues early
- Maintain Sprint 3 momentum

---

## Security Considerations

### Multi-tenant Isolation
- All RPC functions validate `tenant_id`
- RLS policies enforced on all tables
- Foreign key checks prevent cross-tenant references

### Input Validation
- Zod schemas at API boundary
- PostgreSQL constraints as second layer
- Error messages sanitized (no SQL details leaked)

### Audit Trail
- Existing audit triggers from Sprint 1 cover new operations
- Bulk operations log actor + timestamp + before/after state

---

## Performance Benchmarks (Expected)

| Operation | Target | Notes |
|-----------|--------|-------|
| Bulk create 1000 prices | <500ms | Single RPC call |
| Catalogue search (10k items) | <50ms | Indexed on hex_code, designation |
| Material index lookup | <10ms | UNIQUE constraint enables fast lookup |
| Import from mapping | <2s | For 500 unmapped rows |

---

## Dependencies

### New
- None (using existing stack)

### Existing (from Sprint 1-3)
- PostgreSQL 15+
- Supabase (auth, RLS, RPC)
- tRPC v11
- Zod
- Next.js 15
- React 19
- Tailwind v4
- TanStack Query v5

---

## Testing Strategy

### Unit Tests (Day 2, 3, 4)
- dbMappers.ts transformations
- Business logic (pricing formulas)
- Validation rules

### Integration Tests (Day 7)
- RPC function behavior (Supabase local)
- tRPC procedures with mock database
- Trigger correctness

### E2E Tests (Day 7)
- Catalogue CRUD flow
- Supplier price management
- Material index upsert
- Sprint 3 → Sprint 4 import flow

---

## Open Questions

### Q1: How to handle catalogue item conflicts?
**Context**: Two imports have same hex_code but different designations.

**Current Behavior**: First-row-wins (DISTINCT ON hex_code ORDER BY first seen)

**Future**: Add conflict resolution UI in Sprint 5

### Q2: Should prix_net be editable?
**Decision**: No. Always computed. If manual override needed, adjust prix_brut or remise_pct.

**Rationale**: Ensures consistency, prevents data entry errors.

### Q3: Material index versioning?
**Decision**: No versioning yet. Updates replace previous value for same (matiere, date).

**Future**: Add `version` column + history table if auditing required.

---

## Rollback Plan

### If Sprint 4 fails mid-week:
1. **Migrations are reversible**: Each migration has DOWN script
2. **API stubs remain**: Existing code doesn't break
3. **UI is additive**: Can disable routes with feature flag
4. **Sprint 3 unaffected**: Operates independently

### Rollback Procedure:
```bash
# Revert migrations (in reverse order)
supabase migration down 010_catalogue_helpers
supabase migration down 009_add_unique_constraints
supabase migration down 008_bulk_operations

# Remove API code
git revert <commit-hash>

# Disable routes (if deployed)
# Set NEXT_PUBLIC_ENABLE_CATALOGUE=false
```

---

## Success Criteria

### Day 1 (✅ Complete)
- [x] Bulk operations RPC functions
- [x] Trigger for prix_net calculation
- [x] UNIQUE constraint on material_indices
- [x] Import helpers for Sprint 3 integration
- [x] dbMappers.ts transformation layer
- [x] Technical decisions documented

### Days 2-7 (Pending)
- [ ] catalogueRouter with full CRUD
- [ ] pricesRouter with bulk operations
- [ ] indicesRouter with upsert
- [ ] CatalogueManager UI component
- [ ] SupplierPriceManager UI component
- [ ] /catalogue and /prices pages
- [ ] Integration with MappingWizard
- [ ] E2E tests passing
- [ ] SPRINT4_FINAL_SUMMARY.md

---

## References

- Sprint 3 Docs: `docs/SPRINT3_FINAL_SUMMARY.md`
- Database Schema: `supabase/migrations/001_schema.sql`
- Pricing Business Logic: `packages/business/src/pricing.ts`
- Quality Flags: `packages/business/src/quality.ts`
- API Schemas: `packages/api/src/schemas.ts`

---

**Document Status**: Living document, updated daily during Sprint 4.
**Last Updated**: 2025-11-13 (Day 1 complete)
**Next Update**: 2025-11-14 (Day 2 - catalogueRouter)
