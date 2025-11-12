/**
 * tRPC endpoint for Next.js App Router
 *
 * NOTE: In a real implementation, this would handle authentication and Supabase context
 */

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@hex/api';
import type { RequestContext } from '@hex/api';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async (): Promise<RequestContext> => {
      // TODO: Extract user context from request headers/session
      // For now, return anonymous context (non authentifié)
      return {
        userId: null,
        tenantId: null,
        role: 'anonymous',
        email: null,
      };
    },
  });

export { handler as GET, handler as POST };
