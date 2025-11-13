'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@hex/db';
import { createTRPCClient, trpc } from '@/lib/trpc';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const [supabase] = useState(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      console.warn('Supabase environment variables are missing – continuing anonymously.');
      return null;
    }

    return createBrowserClient(url, anonKey);
  });

  const getAccessToken = useCallback(async () => {
    if (!supabase) {
      return null;
    }

    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

  const trpcClient = useMemo(
    () => createTRPCClient(supabase ? getAccessToken : undefined),
    [getAccessToken, supabase]
  );

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      queryClient.clear();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient, supabase]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
