/**
 * tRPC endpoint for Next.js App Router
 *
 * Handles authentication via JWT from Supabase and creates properly typed context
 */

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@hex/api';
import type { RequestContext } from '@hex/api';
import { createServerClient } from '@hex/db';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async (opts): Promise<RequestContext> => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

      // Créer un client Supabase serveur
      const supabase = createServerClient(supabaseUrl, serviceRoleKey);

      // Récupérer le JWT depuis l'en-tête Authorization
      const authHeader = opts?.req.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        // Anonymous context
        return {
          userId: null,
          tenantId: null,
          role: 'anonymous',
          email: null,
          supabase,
        };
      }

      try {
        // Vérifier le JWT et obtenir les données utilisateur
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser(token);

        if (userError || !user) {
          return {
            userId: null,
            tenantId: null,
            role: 'anonymous',
            email: null,
            supabase,
          };
        }

        // Récupérer le profil utilisateur et son tenant
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, tenant_memberships(*)')
          .eq('id', user.id)
          .single();

        if (!profile || !profile.tenant_memberships || profile.tenant_memberships.length === 0) {
          return {
            userId: null,
            tenantId: null,
            role: 'anonymous',
            email: null,
            supabase,
          };
        }

        const membership = profile.tenant_memberships[0];

        return {
          userId: user.id,
          tenantId: membership.tenant_id,
          role: membership.role || 'viewer',
          email: user.email || '',
          supabase,
        };
      } catch (error) {
        console.error('[tRPC Context] Error:', error);
        return {
          userId: null,
          tenantId: null,
          role: 'anonymous',
          email: null,
          supabase,
        };
      }
    },
  });

export { handler as GET, handler as POST };
