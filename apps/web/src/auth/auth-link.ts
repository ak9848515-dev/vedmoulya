// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — tRPC Auth Refresh Link
// MOB-001 — Mobile Authentication
// Sits in front of httpBatchLink. When a procedure fails with 401
// (UNAUTHORIZED) and a refresh token exists, it refreshes the access token
// (single-flight via session-manager) and retries the operation once with the
// new token. httpBatchLink recomputes its headers per request, so the retry
// automatically carries the fresh JWT.
//
// If the refresh is rejected, the session is cleared (session-manager) and the
// original error is propagated — the RequireAuth guard on the active page
// redirects to /login.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import type { TRPCLink } from '@trpc/client';
import type { AnyRouter } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { refreshWithLock } from './session-manager.js';

/** True when a tRPC error represents an authentication failure (HTTP 401). */
function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as {
    shape?: { httpStatus?: number };
    data?: { httpStatus?: number; code?: string };
  };
  return (
    err.shape?.httpStatus === 401 ||
    err.data?.httpStatus === 401 ||
    err.data?.code === 'UNAUTHORIZED'
  );
}

/**
 * Create the auth refresh link for a tRPC router.
 */
export function authRefreshLink<TRouter extends AnyRouter>(): TRPCLink<TRouter> {
  return () => {
    return ({ op, next }) =>
      observable((observer) => {
        let retried = false;
        let currentSubscription: { unsubscribe: () => void } | null = null;

        const execute = (): void => {
          currentSubscription = next(op).subscribe({
            next: (value) => {
              observer.next(value);
            },
            error: (error) => {
              if (!retried && isUnauthorizedError(error)) {
                retried = true;
                refreshWithLock()
                  .then((refreshed) => {
                    if (refreshed) {
                      // Retry once with the fresh access token.
                      execute();
                    } else {
                      observer.error(error);
                    }
                  })
                  .catch(() => {
                    observer.error(error);
                  });
                return;
              }
              observer.error(error);
            },
            complete: () => {
              observer.complete();
            },
          });
        };

        execute();

        return () => {
          currentSubscription?.unsubscribe();
        };
      });
  };
}
