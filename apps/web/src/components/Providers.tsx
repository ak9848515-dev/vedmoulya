// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client Providers
// Wraps the application with ThemeProvider + TanStack Query + tRPC
// BLD-016-A — Application Shell & Foundation
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@vedmoulya/api';
import { api } from '../lib/trpc.js';
import { ThemeProvider } from '@vedmoulya/ui';
import { PWAProvider } from './PWAProvider.js';
import { getAccessToken } from '../stores/auth-store.js';

// ── Props ───────────────────────────────────────────────────────────────────

export interface ProvidersProps {
  children: React.ReactNode;
}

// ── Providers Component ─────────────────────────────────────────────────────

export function Providers({ children }: ProvidersProps): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          // Attach the JWT access token from the auth store (BLD-016C)
          headers: () => {
            const accessToken = getAccessToken();
            return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
          },
          // Enable credentials for cookie-based auth
          fetch: (url, options) => fetch(url, { ...options, credentials: 'include' }),
        }),
      ],
    }),
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system">
          <PWAProvider>{children}</PWAProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </api.Provider>
  );
}
