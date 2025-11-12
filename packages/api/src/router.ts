import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { RequestContext, TenantContext } from './types';
import {
  LoginInputSchema,
  SignupInputSchema,
  CreateImportSchema,
  CatalogueItemSchema,
  SupplierPriceSchema,
  MaterialIndexSchema,
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
  list: authedProcedure
    .query(async ({ ctx }) => {
      // Placeholder: Will query catalogue_items for tenant
      return [];
    }),

  create: adminOrEngineerProcedure
    .input(CatalogueItemSchema)
    .mutation(async ({ input, ctx }) => {
      // Placeholder: Will insert into catalogue_items
      return { id: 'cat_' + Date.now(), ...input };
    }),

  update: adminOrEngineerProcedure
    .input(
      CatalogueItemSchema.extend({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Placeholder: Will update catalogue_items
      return input;
    }),

  delete: adminOrEngineerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return { success: true };
    }),
});

export const pricesRouter = t.router({
  listByCatalogue: authedProcedure
    .input(z.object({ catalogueItemId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Placeholder: Will query supplier_prices
      return [];
    }),

  create: adminOrEngineerProcedure
    .input(SupplierPriceSchema)
    .mutation(async ({ input, ctx }) => {
      // Placeholder: Will insert into supplier_prices
      return { id: 'price_' + Date.now(), ...input };
    }),

  update: adminOrEngineerProcedure
    .input(SupplierPriceSchema.extend({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return input;
    }),
});

export const indicesRouter = t.router({
  listByMaterial: authedProcedure
    .input(z.object({ matiere: z.string() }))
    .query(async ({ input, ctx }) => {
      // Placeholder: Will query material_indices
      return [];
    }),

  create: adminOrEngineerProcedure
    .input(MaterialIndexSchema)
    .mutation(async ({ input, ctx }) => {
      // Placeholder: Will insert into material_indices
      return { id: 'idx_' + Date.now(), ...input };
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
        const columns = parsedRows.length > 0 ? Object.keys(parsedRows[0].raw_data || {}) : [];
        const flattenedRows = parsedRows.map((r) => r.raw_data || {});

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
      const { importId, mappings } = input;

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

        // Update import status to draft
        await supabase
          .from('dpgf_imports')
          .update({ mapping_status: 'draft', mapping_version: 1 })
          .eq('id', importId)
          .catch(() => {});

        return {
          ok: true,
          version: 1,
          count: mappings.length,
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

      try {
        // Query mapping_memory for suggestions
        const { data: suggestions, error } = await supabase
          .from('mapping_memory')
          .select('source_column_original, target_field, confidence, use_count, last_used_at')
          .eq('tenant_id', ctx.tenantId)
          .eq('supplier', supplier)
          .in(
            'source_column_normalized',
            sourceColumns.map((c) => c.toLowerCase().trim())
          )
          .order('confidence', { ascending: false });

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to get suggestions: ${error.message}`,
          });
        }

        return (suggestions || []).map((s) => ({
          sourceColumn: s.source_column_original,
          targetField: s.target_field,
          confidence: s.confidence || 0.5,
          source: 'memory' as const,
          useCount: s.use_count,
        }));
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
      const { supplier } = input;

      try {
        const { data: templates, error } = await supabase
          .from('mapping_templates')
          .select('id, supplier_name, mappings, version, description, created_at')
          .eq('tenant_id', ctx.tenantId)
          .eq('supplier_name', supplier)
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
          createdAt: new Date(t.created_at),
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

      try {
        const { data, error } = await supabase
          .from('mapping_templates')
          .insert({
            tenant_id: ctx.tenantId,
            supplier_name: input.supplier,
            mappings: input.mappings,
            description: input.description,
            version: input.version || 1,
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

        const issues: z.infer<typeof z.lazy(() => z.array(z.object({ rowIndex: z.number(), field: z.string(), code: z.enum(['required', 'type', 'pattern', 'range', 'length']), message: z.string(), value: z.unknown().optional() })))> = [];

        // Apply rules if provided
        if (rules && rules.length > 0) {
          for (const row of sampleRows || []) {
            const rawData = row.raw_data || {};

            for (const rule of rules) {
              const value = rawData[rule.field];

              // Check required
              if (rule.required && (value === null || value === undefined || value === '')) {
                issues.push({
                  rowIndex: row.row_index,
                  field: rule.field,
                  code: 'required' as const,
                  message: `${rule.field} is required`,
                  value,
                });
                continue;
              }

              if (value === null || value === undefined || value === '') {
                continue; // Skip other rules for empty values
              }

              // Check type
              if (rule.type) {
                let isValidType = true;
                switch (rule.type) {
                  case 'number':
                    isValidType = !isNaN(Number(value));
                    break;
                  case 'date':
                    isValidType = !isNaN(Date.parse(String(value)));
                    break;
                  case 'email':
                    isValidType = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
                    break;
                  case 'currency':
                    isValidType = !isNaN(Number(value)) && Number(value) >= 0;
                    break;
                }

                if (!isValidType) {
                  issues.push({
                    rowIndex: row.row_index,
                    field: rule.field,
                    code: 'type' as const,
                    message: `${rule.field} must be ${rule.type}`,
                    value,
                  });
                }
              }

              // Check pattern
              if (rule.pattern) {
                const regex = new RegExp(rule.pattern);
                if (!regex.test(String(value))) {
                  issues.push({
                    rowIndex: row.row_index,
                    field: rule.field,
                    code: 'pattern' as const,
                    message: `${rule.field} does not match pattern ${rule.pattern}`,
                    value,
                  });
                }
              }

              // Check length
              const strValue = String(value);
              if (rule.minLength && strValue.length < rule.minLength) {
                issues.push({
                  rowIndex: row.row_index,
                  field: rule.field,
                  code: 'length' as const,
                  message: `${rule.field} must be at least ${rule.minLength} characters`,
                  value,
                });
              }

              if (rule.maxLength && strValue.length > rule.maxLength) {
                issues.push({
                  rowIndex: row.row_index,
                  field: rule.field,
                  code: 'length' as const,
                  message: `${rule.field} must be at most ${rule.maxLength} characters`,
                  value,
                });
              }

              // Check range (for numbers)
              if (rule.type === 'number' || rule.type === 'currency') {
                const numValue = Number(value);
                if (rule.min !== undefined && numValue < rule.min) {
                  issues.push({
                    rowIndex: row.row_index,
                    field: rule.field,
                    code: 'range' as const,
                    message: `${rule.field} must be at least ${rule.min}`,
                    value,
                  });
                }

                if (rule.max !== undefined && numValue > rule.max) {
                  issues.push({
                    rowIndex: row.row_index,
                    field: rule.field,
                    code: 'range' as const,
                    message: `${rule.field} must be at most ${rule.max}`,
                    value,
                  });
                }
              }
            }
          }
        }

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

        // Group by key values to find duplicates
        const duplicateMap = new Map<string, number[]>();

        for (const row of sampleRows || []) {
          const rawData = row.raw_data || {};

          for (const key of keys) {
            const keyValue = String(rawData[key] || '');
            const mapKey = `${key}::${keyValue}`;

            if (!duplicateMap.has(mapKey)) {
              duplicateMap.set(mapKey, []);
            }

            duplicateMap.get(mapKey)!.push(row.row_index);
          }
        }

        // Filter to only groups with duplicates
        const duplicates = Array.from(duplicateMap.entries())
          .filter(([_, indices]) => indices.length > 1)
          .map(([mapKey, indices]) => {
            const [key, keyValue] = mapKey.split('::');
            return {
              key,
              keyValue,
              rowIndices: indices,
              count: indices.length,
            };
          });

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
