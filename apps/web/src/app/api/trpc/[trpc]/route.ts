// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — tRPC Next.js Route Handler
// Serves the unified API Gateway via Next.js App Router route handlers
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createAuthContext } from '@vedmoulya/api';
import type { NextRequest } from 'next/server';

// ── Route Handler: GET + POST ───────────────────────────────────────────────
// Real authentication (BLD-016-C): the context is built from the verified
// JWT in the Authorization header. Protected procedures enforce it via the
// RouterRegistry auth middleware; health procedures stay public.

const handler = (request: NextRequest): Promise<Response> => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext: () => createAuthContext(request.headers),
  });
};

export { handler as GET, handler as POST };
