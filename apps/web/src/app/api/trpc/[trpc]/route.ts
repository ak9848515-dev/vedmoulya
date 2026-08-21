// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — tRPC Next.js Route Handler
// Serves the unified API Gateway via Next.js App Router route handlers
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import {
  createAuthContext,
  getAppRouter,
  getServices,
  getSchedulerCadenceDriver,
  initGatewayObservability,
  startOSHealthScheduler,
  startSchedulerCadenceDriver,
} from '@vedmoulya/api';
import { corsHeaders, isCorsPreflight, withCorsHeaders } from '../../../../lib/cors.js';
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

// ── SPRINT-022 — persistence shutdown flush ─────────────────────────
// Registered once per process, following the exact fire-and-forget
// convention of the gateway observability signal handlers: on SIGTERM /
// SIGINT the pending write-through upserts are drained (bounded at 10s
// inside flushPersistence) so restart-surviving state lands in Postgres.
let persistenceShutdownRegistered = false;

function registerPersistenceShutdownFlush(): void {
  if (persistenceShutdownRegistered) return;
  persistenceShutdownRegistered = true;
  const flushPersistence = (): void => {
    void getServices().flushPersistence();
  };
  process.on('SIGTERM', flushPersistence);
  process.on('SIGINT', flushPersistence);
}

const handler = async (request: NextRequest): Promise<Response> => {
  // CORS preflight (the Capacitor WebView calls the remote gateway
  // cross-origin from https://localhost — MOB-001).
  if (isCorsPreflight(request)) {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (!observabilityInitialized) {
    observabilityInitialized = true;
    initGatewayObservability();
    // OS-003 operational cadence: a scheduled os.dashboard pass (default every
    // 5 min, see OS_HEALTH_INTERVAL_MS) so the OS snapshot history becomes a
    // continuous monitoring feed. Idempotent + unref'd — it never blocks or
    // holds the server open.
    startOSHealthScheduler();
    // SPRINT-022 — Persistent Intelligence: hydrate the store mirrors BEFORE
    // the cadence driver starts. The driver's immediate first tick must see
    // restart-surviving scheduler/Brain/Intelligence/Bridge state — a tick on
    // an un-hydrated mirror could re-derive nextRunAt and re-run jobs that
    // already ran. Hydration is bounded + error-isolated per store (a
    // database outage fails fast and the mirror starts empty, catching up on
    // later writes). Only the FIRST request ever awaits this.
    await getServices().hydratePersistence();
    // EPIC-018 runtime closure: the AI World discovery cadence driver gives
    // scheduler.tick() a real runtime caller (6h/daily/weekly discovery runs
    // automatically for registered users). Same pattern as the OS health
    // scheduler: singleton, unref'd, no overlapping ticks, fail-closed.
    // getServices() is the lazy gateway singleton — the driver and the router
    // share the SAME SchedulerApplicationService (never a second instance).
    startSchedulerCadenceDriver();
    getServices().setSchedulerRuntimeStatusSource(
      () =>
        getSchedulerCadenceDriver()?.status() ?? {
          active: false,
          reason: 'not_started',
          maxUsersPerTick: 0,
          refreshIntelligenceEnabled: false,
          proactiveRefreshEnabled: false,
        },
    );
    registerPersistenceShutdownFlush();
  }
  const response = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    // Built lazily on the first request (module scope stays inert during
    // `next build`, which runs under NODE_ENV=production without env vars).
    router: getAppRouter(),
    createContext: () => createAuthContext(request.headers),
  });
  return withCorsHeaders(response, request);
};

export { handler as GET, handler as POST, handler as OPTIONS };
