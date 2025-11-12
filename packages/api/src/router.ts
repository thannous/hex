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
          const errorData = await response.json();
          throw new Error(errorData.error || 'Unknown error');
        }

        const result = await response.json();
        return result;
      } catch (error) {
        // Marquer l'import comme failed
        await supabase
          .from('dpgf_imports')
          .update({ status: 'failed' })
          .eq('id', input.importId)
          .catch(() => {});

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
});

export type AppRouter = typeof appRouter;
