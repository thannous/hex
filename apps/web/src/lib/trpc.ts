import { httpBatchLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
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

export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      links: [
        httpBatchLink({
          /**
           * If you want to use SSR, you need to use the server-side environment variables.
           */
          url: `${getBaseUrl()}/api/trpc`,
          /**
           * Set custom request headers on every request.
           * You can also use the `ctx` object to do conditional logic based on state.
           */
          async headers() {
            return {};
          },
        }),
      ],
    };
  },
  /**
   * Whether tRPC should await queries when server rendering pages.
   */
  ssr: false,
});

/**
 * This is a helper that can be used to leverage in an App Router Page and makes superpowers
 * @example
 * export const metadata = generateMetadata({ title: 'My Page' })
 *
 * function MyPage() {
 *   const { data } = trpc.post.all.useQuery()
 * }
 * export const getServerSideProps = trpc.withTRPC(MyPage);
 */
export const withTRPC = trpc.withTRPC;
