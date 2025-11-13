import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { RequestContext, TenantContext } from './types';
import {
  applyValidationRules,
  asRecord,
  createNormalizedColumnsMap,
  detectDuplicateGroups,
  expandSuggestionsForColumns,
  normalizeSourceColumn,
  normalizeSupplierName,
} from './lib/mappingUtils';
import {
  fromDbCatalogueItem,
  toDbCatalogueItem,
  fromDbSupplierPrice,
  toDbSupplierPrice,
  toBulkSupplierPrices,
  fromDbMaterialIndex,
  toDbMaterialIndex,
  toBulkMaterialIndices,
  type DbCatalogueItem,
  type DbSupplierPrice,
  type DbMaterialIndex,
} from './lib/dbMappers';
import {
  LoginInputSchema,
  SignupInputSchema,
  CreateImportSchema,
  CatalogueItemSchema,
  CatalogueItemInputSchema,
  SupplierPriceSchema,
  SupplierPriceInputSchema,
  MaterialIndexSchema,
  MaterialIndexInputSchema,
  CreateQuoteSchema,
  PricingParamsSchema,
  CreateMappingSchema,
  GetPreviewSchema,
  PreviewOutputSchema,
  GetSuggestionsSchema,
  SuggestionsOutputSchema,
  GetTemplatesSchema,
  MappingTemplateSchema,
  SaveTemplateSchema,
  ValidateInputSchema,
  ValidateOutputSchema,
  GetDuplicatesSchema,
  DuplicatesOutputSchema,
} from './schemas';

// Initialize tRPC
const t = initTRPC.context<RequestContext>().create();

// Middleware pour authentification
const isAuthed = t.middleware(({ ctx, next }) => {
  if (ctx.role === 'anonymous') {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: ctx as TenantContext,
  });
});

// Middleware pour les rôles Admin/Engineer
const isAdminOrEngineer = t.middleware(({ ctx, next }) => {
  if (ctx.role === 'anonymous') {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (ctx.role !== 'admin' && ctx.role !== 'engineer') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({
    ctx: ctx as TenantContext,
  });
});

const publicProcedure = t.procedure;
const authedProcedure = t.procedure.use(isAuthed);
const adminOrEngineerProcedure = t.procedure.use(isAdminOrEngineer);

const normalizeSearchTerm = (value: string) =>
  value
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/([,()])/g, '\\$1');
const normalizeHexCodeValue = (value: string) => value.trim().toUpperCase();
const isSupabaseNoRowError = (error: { code?: string } | null | undefined) =>
  error?.code === 'PGRST116';

// Routers
export const authRouter = t.router({
  login: publicProcedure
    .input(LoginInputSchema)
    .mutation(async ({ input }) => {
      // Placeholder: Implementation will use Supabase
      return {
        success: true,
        message: 'Login endpoint - Supabase integration needed',
      };
    }),

  signup: publicProcedure
    .input(SignupInputSchema)
    .mutation(async ({ input }) => {
      // Placeholder: Implementation will use Supabase
      return {
        success: true,
        message: 'Signup endpoint - Supabase integration needed',
      };
    }),

  logout: authedProcedure
    .mutation(async ({ ctx }) => {
      return { success: true };
    }),

  me: authedProcedure
    .query(async ({ ctx }) => {
      return {
        userId: ctx.userId,
        email: ctx.email,
        tenantId: ctx.tenantId,
        role: ctx.role,
      };
    }),
});

export const importsRouter = t.router({
  create: adminOrEngineerProcedure
    .input(CreateImportSchema)
    .mutation(async ({ input, ctx }) => {
      const { supabase } = ctx;

      // Créer l'enregistrement d'import avec status 'pending'
      const { data, error } = await supabase
        .from('dpgf_imports')
        .insert({
          tenant_id: ctx.tenantId,
          user_id: ctx.userId,
          filename: input.filename,
          storage_path: input.storagePath,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create import: ${error.message}`,
        });
      }

      return {
        id: data.id,
        filename: data.filename,
        status: data.status,
        storagePath: data.storage_path,
      };
    }),

  list: authedProcedure
    .query(async ({ ctx }) => {
      const { supabase } = ctx;

      // Récupérer tous les imports du tenant, triés par date décroissante
      const { data, error } = await supabase
        .from('dpgf_imports')
        .select('*')
        .eq('tenant_id', ctx.tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to list imports: ${error.message}`,
        });
      }

      return (data || []).map((imp) => ({
        id: imp.id,
        filename: imp.filename,
        status: imp.status,
        rowCount: imp.row_count || 0,
        parsedAt: imp.parsed_at ? new Date(imp.parsed_at) : null,
        createdAt: new Date(imp.created_at),
      }));
    }),

  getStatus: authedProcedure
    .input(z.object({ importId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { supabase } = ctx;

      // Récupérer l'import par ID (RLS assurera qu'il appartient au tenant)
      const { data, error } = await supabase
        .from('dpgf_imports')
        .select('*')
        .eq('id', input.importId)
        .eq('tenant_id', ctx.tenantId)
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Import not found',
        });
      }

      return {
        id: data.id,
        filename: data.filename,
        status: data.status,
        rowCount: data.row_count || 0,
        parsedAt: data.parsed_at ? new Date(data.parsed_at) : null,
        createdAt: new Date(data.created_at),
      };
    }),

  // Trigger parsing on the server (for fallback cases)
  triggerParsing: adminOrEngineerProcedure
    .input(z.object({ importId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { supabase } = ctx;

      // Récupérer l'import
      const { data: importData, error: fetchError } = await supabase
        .from('dpgf_imports')
        .select('*')
        .eq('id', input.importId)
        .eq('tenant_id', ctx.tenantId)
        .single();

      if (fetchError || !importData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Import not found',
        });
      }

      // Mettre à jour le statut à 'processing'
      const { error: updateError } = await supabase
        .from('dpgf_imports')
        .update({ status: 'processing' })
        .eq('id', input.importId);

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update import status: ${updateError.message}`,
        });
      }

      // Appeler l'Edge Function pour parser le fichier
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/parse-dpgf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            storagePath: importData.storage_path,
            importId: input.importId,
            tenantId: ctx.tenantId,
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(errorData?.error ?? 'Unknown error');
        }

        const result = await response.json();
        return result;
      } catch (error) {
        // Marquer l'import comme failed
        // Try to mark as failed (ignore response)
        try {
          await supabase
            .from('dpgf_imports')
            .update({ status: 'failed' })
            .eq('id', input.importId);
        } catch {
          // Best-effort status update; failures should not leak to clients
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Parsing failed',
        });
      }
    }),
});

export const catalogueRouter = t.router({
  /**
   * List all catalogue items for the current tenant
   * Supports pagination, search, and filters
   */
  list: authedProcedure
    .input(
      z
        .object({
          limit: z.number().int().positive().max(1000).default(100),
          offset: z.number().int().nonnegative().default(0),
          search: z.string().optional(),
          matiere: z.string().min(1).optional(),
          discipline: z.string().min(1).optional(),
        })
        .optional()
    )
    .output(z.array(CatalogueItemSchema))
    .query(async ({ input, ctx }) => {
      const { limit = 100, offset = 0, search, matiere, discipline } = input || {};
      const { supabase, tenantId } = ctx;

      let query = supabase
        .from('catalogue_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('hex_code', { ascending: true })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (matiere) {
        query = query.eq('matiere', matiere);
      }
      if (discipline) {
        query = query.eq('discipline', discipline);
      }

      if (search?.trim()) {
        const sanitized = normalizeSearchTerm(search);
        query = query.or(
          `hex_code.ilike.%${sanitized}%,designation.ilike.%${sanitized}%,matiere.ilike.%${sanitized}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch catalogue items',
          cause: error,
        });
      }

      return (data || []).map((row) => fromDbCatalogueItem(row as DbCatalogueItem));
    }),

  /**
   * Get a single catalogue item by ID
   */
  getById: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(CatalogueItemSchema)
    .query(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      const { data, error } = await supabase
        .from('catalogue_items')
        .select('*')
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (isSupabaseNoRowError(error)) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Catalogue item not found',
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch catalogue item',
          cause: error,
        });
      }

      if (!data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Catalogue item not found',
        });
      }

      return fromDbCatalogueItem(data as DbCatalogueItem);
    }),

  /**
   * Get a catalogue item by its HEX code (case-insensitive)
   */
  getByHexCode: authedProcedure
    .input(z.object({ hexCode: z.string().min(1) }))
    .output(CatalogueItemSchema)
    .query(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;
      const normalizedHex = normalizeHexCodeValue(input.hexCode);

      const { data, error } = await supabase
        .from('catalogue_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('hex_code', normalizedHex)
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Catalogue item with HEX code ${normalizedHex} not found`,
        });
      }

      return fromDbCatalogueItem(data as DbCatalogueItem);
    }),

  /**
   * Create a new catalogue item
   */
  create: adminOrEngineerProcedure
    .input(CatalogueItemInputSchema)
    .output(CatalogueItemSchema)
    .mutation(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      const dbRow = toDbCatalogueItem({
        ...input,
        tenantId,
        hexCode: input.hexCode,
      });

      const { data, error } = await supabase
        .from('catalogue_items')
        .insert(dbRow)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // UNIQUE constraint violation
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Catalogue item with HEX code "${input.hexCode}" already exists`,
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create catalogue item',
          cause: error,
        });
      }

      return fromDbCatalogueItem(data as DbCatalogueItem);
    }),

  /**
   * Update an existing catalogue item
   */
  update: adminOrEngineerProcedure
    .input(
      CatalogueItemInputSchema.extend({
        id: z.string().uuid(),
      })
    )
    .output(CatalogueItemSchema)
    .mutation(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;
      const { id, ...updates } = input;

      const dbInput = toDbCatalogueItem({
        ...updates,
        tenantId,
        hexCode: updates.hexCode,
      });
      const { tenant_id: _tenant, ...columnValues } = dbInput;
      const dbUpdates = {
        ...columnValues,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('catalogue_items')
        .update(dbUpdates)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Catalogue item with HEX code "${updates.hexCode}" already exists`,
            cause: error,
          });
        }

        if (isSupabaseNoRowError(error)) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Catalogue item not found',
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update catalogue item',
          cause: error,
        });
      }

      if (!data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Catalogue item not found',
        });
      }

      return fromDbCatalogueItem(data as DbCatalogueItem);
    }),

  /**
   * Delete a catalogue item
   * Note: Will cascade delete related supplier_prices via FK constraint
   */
  delete: adminOrEngineerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      const { error } = await supabase
        .from('catalogue_items')
        .delete()
        .eq('id', input.id)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete catalogue item',
          cause: error,
        });
      }

      return { success: true };
    }),

  /**
   * Import catalogue items from a mapped DPGF import (Sprint 3 integration)
   * Uses RPC function from migration 010_catalogue_helpers.sql
   */
  importFromMapping: adminOrEngineerProcedure
    .input(z.object({ importId: z.string().uuid() }))
    .output(
      z.object({
        import: z.object({
          created: z.number(),
          skipped: z.number(),
          errors: z.number(),
          error_details: z.array(
            z.object({
              hex_code: z.string().optional(),
              error: z.string(),
            })
          ),
        }),
        link: z.object({
          linked: z.number(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      // @ts-expect-error - RPC function from migration 010, types not yet generated
      const { data, error } = await supabase.rpc('import_and_link_catalogue', {
        p_tenant_id: tenantId,
        p_import_id: input.importId,
      });

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to import catalogue from mapping',
          cause: error,
        });
      }

      return data as unknown as {
        import: {
          created: number;
          skipped: number;
          errors: number;
          error_details: Array<{ hex_code?: string; error: string }>;
        };
        link: { linked: number };
      };
    }),
});

export const pricesRouter = t.router({
  /**
   * List all supplier prices for the current tenant
   * Supports pagination and filtering by supplier
   */
  list: authedProcedure
    .input(
      z
        .object({
          limit: z.number().int().positive().max(1000).default(100),
          offset: z.number().int().nonnegative().default(0),
          supplierName: z.string().optional(),
        })
        .optional()
    )
    .output(z.array(SupplierPriceSchema))
    .query(async ({ input, ctx }) => {
      const { limit = 100, offset = 0, supplierName } = input || {};
      const { supabase, tenantId } = ctx;

      let query = supabase
        .from('supplier_prices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Filter by supplier if provided
      if (supplierName) {
        query = query.ilike('supplier_name', `%${supplierName}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch supplier prices',
          cause: error,
        });
      }

      return (data || []).map((row) => fromDbSupplierPrice(row as DbSupplierPrice));
    }),

  /**
   * List supplier prices for a specific catalogue item
   * Returns active prices ordered by prix_net (cheapest first)
   */
  listByCatalogue: authedProcedure
    .input(
      z.object({
        catalogueItemId: z.string().uuid(),
        activeOnly: z.boolean().default(false),
      })
    )
    .output(z.array(SupplierPriceSchema))
    .query(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      let query = supabase
        .from('supplier_prices')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('catalogue_item_id', input.catalogueItemId)
        .order('prix_net', { ascending: true });

      // Filter by active prices if requested
      if (input.activeOnly) {
        const today = new Date().toISOString().split('T')[0];
        query = query.or(`validite_fin.is.null,validite_fin.gte.${today}`);
      }

      const { data, error } = await query;

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch catalogue prices',
          cause: error,
        });
      }

      return (data || []).map((row) => fromDbSupplierPrice(row as DbSupplierPrice));
    }),

  /**
   * Get the cheapest active price for a catalogue item
   */
  getCheapestPrice: authedProcedure
    .input(z.object({ catalogueItemId: z.string().uuid() }))
    .output(SupplierPriceSchema.nullable())
    .query(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('supplier_prices')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('catalogue_item_id', input.catalogueItemId)
        .or(`validite_fin.is.null,validite_fin.gte.${today}`)
        .order('prix_net', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch cheapest price',
          cause: error,
        });
      }

      return data ? fromDbSupplierPrice(data as DbSupplierPrice) : null;
    }),

  /**
   * Create a single supplier price
   */
  create: adminOrEngineerProcedure
    .input(SupplierPriceInputSchema)
    .output(SupplierPriceSchema)
    .mutation(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      const dbRow = toDbSupplierPrice({
        ...input,
        tenantId,
      });

      // Convert null to undefined for Supabase insert
      const insertRow = {
        ...dbRow,
        remise_pct: dbRow.remise_pct ?? undefined,
      };

      const { data, error } = await supabase
        .from('supplier_prices')
        .insert(insertRow)
        .select()
        .single();

      if (error) {
        if (error.code === '23503') {
          // Foreign key violation
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Catalogue item not found or does not belong to your tenant',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create supplier price',
          cause: error,
        });
      }

      return fromDbSupplierPrice(data as DbSupplierPrice);
    }),

  /**
   * Bulk create supplier prices using PostgreSQL RPC function
   * Uses migration 008_bulk_operations.sql
   */
  bulkCreate: adminOrEngineerProcedure
    .input(z.object({ prices: z.array(SupplierPriceInputSchema).min(1).max(1000) }))
    .output(
      z.object({
        created: z.number(),
        errors: z.number(),
        error_details: z.array(
          z.object({
            catalogue_item_id: z.string().optional(),
            supplier_name: z.string().optional(),
            error: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      // Transform camelCase → snake_case for RPC call
      const dbPrices = toBulkSupplierPrices(
        input.prices.map((p) => ({ ...p, tenantId }))
      );

      // @ts-expect-error - RPC function from migration 008, types not yet generated
      const { data, error } = await supabase.rpc('bulk_create_supplier_prices', {
        p_tenant_id: tenantId,
        p_prices: dbPrices,
      });

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to bulk create supplier prices',
          cause: error,
        });
      }

      return data as unknown as {
        created: number;
        errors: number;
        error_details: Array<{
          catalogue_item_id?: string;
          supplier_name?: string;
          error: string;
        }>;
      };
    }),

  /**
   * Update an existing supplier price
   */
  update: adminOrEngineerProcedure
    .input(
      SupplierPriceInputSchema.extend({
        id: z.string().uuid(),
      })
    )
    .output(SupplierPriceSchema)
    .mutation(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;
      const { id, ...updates } = input;

      const dbRow = toDbSupplierPrice({ ...updates, tenantId });
      const { tenant_id: _tenant, ...columnValues } = dbRow;
      const updateRow: Record<string, unknown> = {
        ...columnValues,
        updated_at: new Date().toISOString(),
      };

      const optionalFieldMap = [
        ['remisePct', 'remise_pct'],
        ['validiteFin', 'validite_fin'],
        ['delaiJours', 'delai_jours'],
      ] as const;

      for (const [inputKey, dbColumn] of optionalFieldMap) {
        if (!Object.prototype.hasOwnProperty.call(updates, inputKey)) {
          delete updateRow[dbColumn];
        }
      }

      const { data, error } = await supabase
        .from('supplier_prices')
        .update(updateRow)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Supplier price not found or update failed',
          cause: error,
        });
      }

      return fromDbSupplierPrice(data as DbSupplierPrice);
    }),

  /**
   * Delete a supplier price
   */
  delete: adminOrEngineerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      const { error } = await supabase
        .from('supplier_prices')
        .delete()
        .eq('id', input.id)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete supplier price',
          cause: error,
        });
      }

      return { success: true };
    }),
});

export const indicesRouter = t.router({
  /**
   * List all material indices for the current tenant
   * Supports pagination and filtering by material
   */
  list: authedProcedure
    .input(
      z
        .object({
          limit: z.number().int().positive().max(1000).default(100),
          offset: z.number().int().nonnegative().default(0),
          matiere: z.string().optional(),
        })
        .optional()
    )
    .output(z.array(MaterialIndexSchema))
    .query(async ({ input, ctx }) => {
      const { limit = 100, offset = 0, matiere } = input || {};
      const { supabase, tenantId } = ctx;

      let query = supabase
        .from('material_indices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('index_date', { ascending: false })
        .range(offset, offset + limit - 1);

      // Filter by material if provided
      if (matiere) {
        query = query.eq('matiere', matiere);
      }

      const { data, error } = await query;

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch material indices',
          cause: error,
        });
      }

      return (data || []).map((row) => fromDbMaterialIndex(row as DbMaterialIndex));
    }),

  /**
   * List material indices for a specific material
   * Returns all historical indices ordered by date descending
   */
  listByMaterial: authedProcedure
    .input(z.object({ matiere: z.string() }))
    .output(z.array(MaterialIndexSchema))
    .query(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      const { data, error } = await supabase
        .from('material_indices')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('matiere', input.matiere)
        .order('index_date', { ascending: false });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch material indices',
          cause: error,
        });
      }

      return (data || []).map((row) => fromDbMaterialIndex(row as DbMaterialIndex));
    }),

  /**
   * Get the latest index for a specific material
   * Returns the most recent index entry
   */
  getLatest: authedProcedure
    .input(z.object({ matiere: z.string() }))
    .output(MaterialIndexSchema.nullable())
    .query(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      const { data, error } = await supabase
        .from('material_indices')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('matiere', input.matiere)
        .order('index_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch latest material index',
          cause: error,
        });
      }

      return data ? fromDbMaterialIndex(data as DbMaterialIndex) : null;
    }),

  /**
   * Get all unique materials with indices
   * Returns list of distinct materials
   */
  listMaterials: authedProcedure
    .output(z.array(z.string()))
    .query(async ({ ctx }) => {
      const { supabase, tenantId } = ctx;

      const { data, error } = await supabase
        .from('material_indices')
        .select('matiere')
        .eq('tenant_id', tenantId)
        .order('matiere', { ascending: true });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch materials list',
          cause: error,
        });
      }

      // Get unique materials
      const uniqueMaterials = [...new Set((data || []).map((row) => row.matiere))];
      return uniqueMaterials;
    }),

  /**
   * Create a single material index
   */
  create: adminOrEngineerProcedure
    .input(MaterialIndexInputSchema)
    .output(MaterialIndexSchema)
    .mutation(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      const dbRow = toDbMaterialIndex({
        ...input,
        tenantId,
      });

      const { data, error } = await supabase
        .from('material_indices')
        .insert(dbRow)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // UNIQUE constraint violation
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Material index for "${input.matiere}" on date "${input.indexDate}" already exists`,
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create material index',
          cause: error,
        });
      }

      return fromDbMaterialIndex(data as DbMaterialIndex);
    }),

  /**
   * Bulk upsert material indices using PostgreSQL RPC function
   * Uses migration 008_bulk_operations.sql
   * ON CONFLICT updates existing indices
   */
  bulkUpsert: adminOrEngineerProcedure
    .input(z.object({ indices: z.array(MaterialIndexInputSchema).min(1).max(1000) }))
    .output(
      z.object({
        created: z.number(),
        updated: z.number(),
        errors: z.number(),
        error_details: z.array(
          z.object({
            matiere: z.string().optional(),
            index_date: z.string().optional(),
            error: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      // Transform camelCase → snake_case for RPC call
      const dbIndices = toBulkMaterialIndices(
        input.indices.map((i) => ({ ...i, tenantId }))
      );

      // @ts-expect-error - RPC function from migration 008, types not yet generated
      const { data, error } = await supabase.rpc('bulk_upsert_material_indices', {
        p_tenant_id: tenantId,
        p_indices: dbIndices,
      });

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to bulk upsert material indices',
          cause: error,
        });
      }

      return data as unknown as {
        created: number;
        updated: number;
        errors: number;
        error_details: Array<{
          matiere?: string;
          index_date?: string;
          error: string;
        }>;
      };
    }),

  /**
   * Update an existing material index
   */
  update: adminOrEngineerProcedure
    .input(
      MaterialIndexInputSchema.extend({
        id: z.string().uuid(),
      })
    )
    .output(MaterialIndexSchema)
    .mutation(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;
      const { id, ...updates } = input;

      const dbUpdates = {
        ...toDbMaterialIndex({ ...updates, tenantId }),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('material_indices')
        .update(dbUpdates)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Material index not found or update failed',
          cause: error,
        });
      }

      return fromDbMaterialIndex(data as DbMaterialIndex);
    }),

  /**
   * Delete a material index
   */
  delete: adminOrEngineerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { supabase, tenantId } = ctx;

      const { error } = await supabase
        .from('material_indices')
        .delete()
        .eq('id', input.id)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete material index',
          cause: error,
        });
      }

      return { success: true };
    }),
});

export const quotesRouter = t.router({
  list: authedProcedure
    .query(async ({ ctx }) => {
      // Placeholder: Will query quotes for tenant
      return [];
    }),

  create: adminOrEngineerProcedure
    .input(CreateQuoteSchema)
    .mutation(async ({ input, ctx }) => {
      // Placeholder: Will insert into quotes
      return { id: 'quote_' + Date.now(), status: 'draft' };
    }),

  getDetail: authedProcedure
    .input(z.object({ quoteId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Placeholder: Will query quote + lines
      return { id: input.quoteId, lines: [] };
    }),
});

export const pricingParamsRouter = t.router({
  list: authedProcedure
    .query(async ({ ctx }) => {
      // Placeholder: Will query pricing_params for tenant
      return [];
    }),

  upsert: adminOrEngineerProcedure
    .input(PricingParamsSchema)
    .mutation(async ({ input, ctx }) => {
      return { id: 'params_' + Date.now(), ...input };
    }),
});

export const auditRouter = t.router({
  list: authedProcedure
    .query(async ({ ctx }) => {
      // Only admins can query audit logs
      if (ctx.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return [];
    }),
});

// ============================================================================
// Mappings Router (Sprint 3)
// ============================================================================

export const mappingsRouter = t.router({
  // Get preview of raw import data
  getPreview: authedProcedure
    .input(GetPreviewSchema)
    .output(PreviewOutputSchema)
    .query(async ({ input, ctx }) => {
      const { supabase } = ctx;
      const { importId, limit, offset } = input;

      try {
        // Get total row count
        const { count: totalRows, error: countError } = await supabase
          .from('dpgf_rows_raw')
          .select('id', { count: 'exact' })
          .eq('import_id', importId)
          .eq('tenant_id', ctx.tenantId);

        if (countError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to count rows: ${countError.message}`,
          });
        }

        // Get sample rows with pagination
        const { data: rows, error: rowError } = await supabase
          .from('dpgf_rows_raw')
          .select('raw_data')
          .eq('import_id', importId)
          .eq('tenant_id', ctx.tenantId)
          .order('row_index')
          .range(offset, offset + limit - 1);

        if (rowError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to fetch rows: ${rowError.message}`,
          });
        }

        // Extract columns from first row and flatten data
        const parsedRows = rows || [];
        const flattenedRows: Record<string, unknown>[] = parsedRows.map((r) => asRecord(r.raw_data));
        const columns = flattenedRows.length > 0 ? Object.keys(flattenedRows[0]) : [];

        return {
          columns,
          rows: flattenedRows,
          totalRows: totalRows || 0,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get preview',
        });
      }
    }),

  // Create mapping configuration for import
  create: adminOrEngineerProcedure
    .input(CreateMappingSchema)
    .mutation(async ({ input, ctx }) => {
      const { supabase } = ctx;
      const { importId, mappings, supplier } = input;
      const supplierName = normalizeSupplierName(supplier);

      try {
        // Upsert mappings for this import
        const mappingRecords = mappings.map((m) => ({
          tenant_id: ctx.tenantId,
          import_id: importId,
          source_column: m.sourceColumn,
          target_field: m.targetField,
          field_type: m.fieldType,
          mapping_order: m.mappingOrder,
          created_by: ctx.userId,
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('dpgf_mappings')
          .upsert(mappingRecords, { onConflict: 'tenant_id,import_id,source_column' });

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create mappings: ${error.message}`,
          });
        }

        const { data: existingImport, error: importError } = await supabase
          .from('dpgf_imports')
          .select('mapping_version')
          .eq('id', importId)
          .eq('tenant_id', ctx.tenantId)
          .single();

        if (importError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to load import for versioning: ${importError.message}`,
          });
        }

        const nextVersion = (existingImport?.mapping_version ?? 0) + 1;

        const { error: statusError } = await supabase
          .from('dpgf_imports')
          .update({ mapping_status: 'draft', mapping_version: nextVersion })
          .eq('id', importId);

        if (statusError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to update mapping version: ${statusError.message}`,
          });
        }

        // Fire-and-forget memory updates per mapping (best effort)
        await Promise.all(
          mappings.map(async (mapping) => {
            const { error: memoryError } = await supabase.rpc('increment_mapping_memory', {
              p_tenant_id: ctx.tenantId,
              p_supplier: supplierName,
              p_source_column_original: mapping.sourceColumn,
              p_target_field: mapping.targetField,
            });

            if (memoryError) {
              console.warn(
                `[mappings.create] Failed to increment mapping memory for ${mapping.sourceColumn}: ${memoryError.message}`
              );
            }
          })
        );

        return {
          ok: true,
          version: nextVersion,
          count: mappings.length,
          supplier: supplierName,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create mappings',
        });
      }
    }),

  // Get suggestions based on history and templates
  getSuggestions: authedProcedure
    .input(GetSuggestionsSchema)
    .output(SuggestionsOutputSchema)
    .query(async ({ input, ctx }) => {
      const { supabase } = ctx;
      const { supplier, sourceColumns } = input;
      const supplierName = normalizeSupplierName(supplier);

      try {
        // Query mapping_memory for suggestions
        const normalizedColumnsMap = createNormalizedColumnsMap(sourceColumns);
        const normalizedColumns = Array.from(normalizedColumnsMap.keys());

        const { data: suggestions, error } = await supabase
          .from('mapping_memory')
          .select(
            'source_column_original, source_column_normalized, target_field, confidence, use_count, last_used_at'
          )
          .eq('tenant_id', ctx.tenantId)
          .eq('supplier', supplierName)
          .in('source_column_normalized', normalizedColumns)
          .order('confidence', { ascending: false });

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to get suggestions: ${error.message}`,
          });
        }

        return expandSuggestionsForColumns(normalizedColumnsMap, suggestions || []);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get suggestions',
        });
      }
    }),

  // Get templates for supplier
  getTemplates: authedProcedure
    .input(GetTemplatesSchema)
    .query(async ({ input, ctx }) => {
      const { supabase } = ctx;
      const supplierName = normalizeSupplierName(input.supplier);

      try {
        const { data: templates, error } = await supabase
          .from('mapping_templates')
          .select('id, supplier_name, mappings, version, description, created_at')
          .eq('tenant_id', ctx.tenantId)
          .eq('supplier_name', supplierName)
          .order('version', { ascending: false });

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to get templates: ${error.message}`,
          });
        }

        return (templates || []).map((t) => ({
          id: t.id,
          supplier: t.supplier_name,
          mappings: t.mappings || [],
          version: t.version,
          description: t.description,
          createdAt: new Date(t.created_at ?? new Date().toISOString()),
        }));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get templates',
        });
      }
    }),

  // Save template for reuse
  saveTemplate: adminOrEngineerProcedure
    .input(SaveTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const { supabase } = ctx;
      const supplierName = normalizeSupplierName(input.supplier);

      try {
        let resolvedVersion = input.version;

        if (!resolvedVersion) {
          const { data: latestTemplates, error: latestError } = await supabase
            .from('mapping_templates')
            .select('version')
            .eq('tenant_id', ctx.tenantId)
            .eq('supplier_name', supplierName)
            .order('version', { ascending: false })
            .limit(1);

          if (latestError) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to fetch template version: ${latestError.message}`,
            });
          }

          const lastVersion = latestTemplates?.[0]?.version ?? 0;
          resolvedVersion = lastVersion + 1;
        }

        const { data, error } = await supabase
          .from('mapping_templates')
          .insert({
            tenant_id: ctx.tenantId,
            supplier_name: supplierName,
            mappings: input.mappings,
            description: input.description,
            version: resolvedVersion,
            created_by: ctx.userId,
          })
          .select()
          .single();

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to save template: ${error.message}`,
          });
        }

        return {
          id: data.id,
          version: data.version,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to save template',
        });
      }
    }),

  // Validate data against rules (Phase 4)
  validate: authedProcedure
    .input(ValidateInputSchema)
    .output(ValidateOutputSchema)
    .query(async ({ input, ctx }) => {
      const { supabase } = ctx;
      const { importId, rules, sampleSize } = input;

      try {
        // Get total row count
        const { count: totalRows } = await supabase
          .from('dpgf_rows_raw')
          .select('id', { count: 'exact' })
          .eq('import_id', importId)
          .eq('tenant_id', ctx.tenantId);

        // Sample rows for validation (performance optimization)
        const { data: sampleRows, error: rowError } = await supabase
          .from('dpgf_rows_raw')
          .select('raw_data, row_index')
          .eq('import_id', importId)
          .eq('tenant_id', ctx.tenantId)
          .order('row_index')
          .limit(sampleSize || 1000);

        if (rowError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to fetch rows for validation: ${rowError.message}`,
          });
        }

        const issues = applyValidationRules(sampleRows || [], rules);

        return {
          issues: issues.slice(0, 100), // Limit to 100 issues for UI
          sampleSize: sampleRows?.length || 0,
          totalRows: totalRows || 0,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to validate data',
        });
      }
    }),

  // Detect duplicate rows (Phase 4)
  getDuplicates: authedProcedure
    .input(GetDuplicatesSchema)
    .output(DuplicatesOutputSchema)
    .query(async ({ input, ctx }) => {
      const { supabase } = ctx;
      const { importId, keys, sampleSize } = input;

      try {
        // Get total row count
        const { count: totalRows } = await supabase
          .from('dpgf_rows_raw')
          .select('id', { count: 'exact' })
          .eq('import_id', importId)
          .eq('tenant_id', ctx.tenantId);

        // Sample rows for duplicate detection
        const { data: sampleRows, error: rowError } = await supabase
          .from('dpgf_rows_raw')
          .select('raw_data, row_index')
          .eq('import_id', importId)
          .eq('tenant_id', ctx.tenantId)
          .order('row_index')
          .limit(sampleSize || 5000);

        if (rowError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to fetch rows: ${rowError.message}`,
          });
        }

        const duplicates = detectDuplicateGroups(sampleRows || [], keys);

        return {
          duplicates: duplicates.slice(0, 50), // Limit to 50 for UI
          sampleSize: sampleRows?.length || 0,
          totalRows: totalRows || 0,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to detect duplicates',
        });
      }
    }),
});

// Root router
export const appRouter = t.router({
  auth: authRouter,
  imports: importsRouter,
  catalogue: catalogueRouter,
  prices: pricesRouter,
  indices: indicesRouter,
  quotes: quotesRouter,
  pricingParams: pricingParamsRouter,
  audit: auditRouter,
  mappings: mappingsRouter,
});

export type AppRouter = typeof appRouter;
