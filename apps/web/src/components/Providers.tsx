// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client Providers
// Wraps the application with ThemeProvider + TanStack Query + tRPC
// BLD-016-A — Application Shell & Foundation
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@vedmoulya/api';
import { api } from '../lib/trpc.js';
import { ThemeProvider } from '@vedmoulya/ui';
import { PWAProvider } from './PWAProvider.js';
import { AuthBootstrap } from './AuthBootstrap.js';
import { OnboardingRedirect } from './OnboardingRedirect.js';
import { authRefreshLink } from '../auth/auth-link.js';
import { getAccessToken, useAuthStore } from '../stores/auth-store.js';
import { markStartup, STARTUP_MARKS } from '../lib/startup.js';

// Earliest measurable point — module evaluation of the client entry.
if (typeof window !== 'undefined') {
  markStartup(STARTUP_MARKS.moduleLoad);
}

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
            // MOB-002: dashboard/module data is long-lived — dedupe concurrent
            // requests and avoid refetch storms on tab switches. 5 min stale
            // makes revisits instant; refetchOnReconnect auto-recovers after
            // connectivity returns (offline → online, Task 5).
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
        },
      }),
  );

  // The gateway endpoint is same-origin in the web app but must point at a
  // remote gateway from the Capacitor WebView / static export (RD-001).
  const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? '/api/trpc';

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        // MOB-001: on 401, refresh the access token once and retry with the
        // fresh JWT; every request still carries `Authorization: Bearer <jwt>`.
        authRefreshLink<AppRouter>(),
        httpBatchLink({
          url: gatewayUrl,
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

  // MOB-002 startup instrumentation: providers mounted + session restore done.
  useEffect(() => {
    markStartup(STARTUP_MARKS.providersMounted);
    // Guard against a fast restore finishing before this effect subscribes
    // (subscribe only fires on changes, not the current value).
    if (useAuthStore.getState().sessionReady) {
      markStartup(STARTUP_MARKS.sessionReady);
    }
    const unsub = useAuthStore.subscribe((state) => {
      if (state.sessionReady) {
        markStartup(STARTUP_MARKS.sessionReady);
      }
    });
    return unsub;
  }, []);

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system">
          <PWAProvider>
            <AuthBootstrap>
              <OnboardingRedirect />
              {children}
            </AuthBootstrap>
          </PWAProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </api.Provider>
  );
}
