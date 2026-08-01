// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — tRPC Next.js Route Handler
// Serves the unified API Gateway via Next.js App Router route handlers
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createAuthContext, initGatewayObservability } from '@vedmoulya/api';
import type { NextRequest } from 'next/server';

// ── Route Handler: GET + POST ───────────────────────────────────────────────
// Real authentication (BLD-016-C): the context is built from the verified
// JWT in the Authorization header. Protected procedures enforce it via the
// RouterRegistry auth middleware; health procedures stay public.

// ── Gateway Observability (PH-002/T1) ──────────────────────────────────────
// This route handler is the API gateway's production entry point (the
// gateway runs inside the Next.js server — no standalone HTTP process).
// Initialize the OTLP exporter + runtime metrics interval lazily on the
// first request: initGatewayObservability() is idempotent, so repeated
// calls are cheap no-ops that return the shared singleton. The exporter is
// enabled only when OTEL_EXPORTER_OTLP_ENDPOINT is configured; otherwise it
// stays disabled and never sends traffic.

let observabilityInitialized = false;

const handler = (request: NextRequest): Promise<Response> => {
  if (!observabilityInitialized) {
    observabilityInitialized = true;
    initGatewayObservability();
  }
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext: () => createAuthContext(request.headers),
  });
};

export { handler as GET, handler as POST };
