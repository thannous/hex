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
      // Placeholder: Will insert into dpgf_imports table
      return {
        id: 'import_' + Date.now(),
        filename: input.filename,
        status: 'pending',
      };
    }),

  list: authedProcedure
    .query(async ({ ctx }) => {
      // Placeholder: Will query dpgf_imports for tenant
      return [];
    }),

  getStatus: authedProcedure
    .input(z.object({ importId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Placeholder: Will query dpgf_imports by id
      return {
        id: input.importId,
        status: 'pending',
        rowCount: 0,
      };
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
