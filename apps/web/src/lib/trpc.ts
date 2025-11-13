import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@hex/api';

const getBaseUrl = () => {
  if (typeof window !== 'undefined')
    // browser should use relative url
    return '';
  if (process.env.VERCEL_URL)
    // reference for vercel.com
    return `https://${process.env.VERCEL_URL}`;
  if (process.env.RENDER_INTERNAL_HOSTNAME)
    // reference for render.com
    return `http://${process.env.RENDER_INTERNAL_HOSTNAME}:3000`;
  // assume localhost
  return `http://localhost:${process.env.PORT ?? 3000}`;
};

export type AuthTokenFetcher = () => Promise<string | null>;

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient(getAuthToken?: AuthTokenFetcher) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        async headers() {
          if (!getAuthToken) {
            return {};
          }

          try {
            const token = await getAuthToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
          } catch (error) {
            console.error('[tRPC] Failed to retrieve auth token:', error);
            return {};
          }
        },
      }),
    ],
  });
}
