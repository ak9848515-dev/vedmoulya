// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — tRPC Next.js Route Handler
// Serves the unified API Gateway via Next.js App Router route handlers
// BLD-016-B — Dashboard Landing Experience
//
// SPRINT-087E — Two-phase gateway initialization:
//   Phase 1: observability + service construction + eager hydration start
//            (completes immediately; hydration runs in background)
//   Phase 2: hydration-dependent procedures await the shared promise;
//            independent procedures proceed without waiting
//
// SPRINT-087E-FIX — Scheduler cadence driver starts ONLY after hydration
//   completes (preserves the original invariant that the driver's first
//   tick sees hydrated persistence state).
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
// Safe to register in Phase 1 because it only registers signal handlers;
// the actual flush() runs only on process exit.
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

// ── SPRINT-087E — Hydration-dependent procedure prefixes ────────────
// Procedures whose implementations read/write persistence mirrors
// (WriteThroughDocumentStore) and therefore MUST observe hydrated
// state before executing.  Every new router backed by a persistence
// mirror MUST be added to this list — a missing entry means the
// procedure could read an empty mirror before hydration completes.
const HYDRATION_PREFIXES = [
  'brain.',
  'aiWorldScheduler.',
  'ecosystemIntelligence.',
  'github.',
  'liveIntelligence.',
  'proactive.',
  'control.',
  'world.',
  'voice.',
];

/**
 * Determine whether ANY procedure in the incoming tRPC batch requires
 * hydrated persistence.
 *
 * With tRPC v11 httpBatchLink the URL path contains comma-separated
 * procedure names:
 *   /api/trpc/brain.dashboard,brain.listTasks?batch=2&input=...
 *
 * We split on comma and check every procedure — not just the first —
 * because a batch can mix hydration-dependent and independent procedures
 * (e.g. lifeOS.getSnapshot,brain.dashboard).
 */
function needsHydration(url: string): boolean {
  const trpcPath = url.split('?')[0] ?? url; // strip query params
  const procedurePart = trpcPath.replace(/^\/api\/trpc\//, '');
  const procedures = procedurePart.split(',');

  return procedures.some((procedure) =>
    HYDRATION_PREFIXES.some((prefix) => procedure.startsWith(prefix)),
  );
}

// ── SPRINT-087E-FIX — Shared hydration promise ─────────────────────
// Exactly one hydration promise per process.  Started eagerly by
// ensureGatewayInitialized() on the first request.  All subsequent
// requests share it.
//
// The promise is NEVER reassigned after creation — .catch() is NOT
// used on the shared reference.  A separate .then() observes success
// (to start the scheduler cadence driver) and failure (to log the
// error), but the original promise object is preserved so that
// dependent callers always see the raw hydration outcome.
let hydrationPromise: Promise<void> | null = null;

/**
 * Start persistence hydration eagerly (called once during gateway init).
 *
 * - Starts immediately on the first request (no lazy start).
 * - Does NOT block the calling function — hydration runs in the background.
 * - The scheduler cadence driver starts ONLY after hydration succeeds,
 *   preserving the original invariant that the driver's first tick sees
 *   hydrated persistence state.
 * - If hydration fails, the rejection propagates to dependent callers
 *   via hydrationPromise.  The onRejected handler here prevents an
 *   unhandled promise rejection while the error is also logged.
 */
function startEagerHydration(): void {
  if (hydrationPromise) return;

  hydrationPromise = getServices().hydratePersistence();

  // After hydration completes, start the scheduler cadence driver.
  // The driver's immediate first tick must see restart-surviving
  // scheduler/Brain/Intelligence/Bridge state — a tick on an un-hydrated
  // mirror could re-derive nextRunAt and re-run jobs that already ran.
  //
  // This .then() attaches handlers to the ORIGINAL hydrationPromise.
  // The return value (a new promise) is discarded with `void` — we
  // only need the side effects (scheduler start) and error observation.
  //
  // Important: .catch() is NOT applied to hydrationPromise itself,
  // because that would create a new promise and reassign the variable.
  // Instead, the onRejected callback handles the error observation
  // while preserving the original rejection for dependent callers.
  void hydrationPromise.then(
    () => {
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
    },
    (error: unknown) => {
      // Log the failure loudly — the mirrors remain empty or partially
      // populated, and dependent procedures will fail until the process
      // restarts.  The original hydrationPromise is still rejected;
      // dependent callers observing it will receive this rejection.
      console.error(
        '[SPRINT-087E-FIX] Persistence hydration failed permanently',
        error instanceof Error ? error.message : String(error),
      );
    },
  );
}

// ── Phase 1: Gateway initialization (fast, idempotent) ─────────────
// Observability, OS health scheduler, service construction, eager
// hydration start, and shutdown hooks.  Completes in <100ms.  Every
// request passes through here — repeated calls are cheap no-ops.
//
// Hydration STARTS here but is NOT awaited — it runs in the background.
// The scheduler cadence driver is NOT started here; it starts later
// when the hydration .then() callback fires.

function ensureGatewayInitialized(): void {
  if (observabilityInitialized) return;
  observabilityInitialized = true;

  initGatewayObservability();
  // OS-003 operational cadence: a scheduled os.dashboard pass (default every
  // 5 min, see OS_HEALTH_INTERVAL_MS) so the OS snapshot history becomes a
  // continuous monitoring feed. Idempotent + unref'd — it never blocks or
  // holds the server open.
  startOSHealthScheduler();
  // Construct the gateway services (lazy singleton — first call wires all
  // production Postgres repositories and probes; subsequent calls are no-ops).
  getServices();
  // Start persistence hydration eagerly.  Does NOT block — runs in the
  // background.  The scheduler cadence driver will start when hydration
  // completes (via the .then() callback in startEagerHydration).
  startEagerHydration();
  // Safe to register now: the actual flush() runs only on process exit,
  // after any in-flight requests complete.
  registerPersistenceShutdownFlush();
}

// ── Phase 2: Hydration gate (shared promise, awaited only when needed) ──

async function ensureHydrationIfRequired(requestUrl: string): Promise<void> {
  if (needsHydration(requestUrl) && hydrationPromise) {
    await hydrationPromise;
  }
  // Independent procedures (lifeOS, dashboard, career, learning, etc.)
  // proceed immediately without waiting for hydration.
}

const handler = async (request: NextRequest): Promise<Response> => {
  // CORS preflight (the Capacitor WebView calls the remote gateway
  // cross-origin from https://localhost — MOB-001).
  if (isCorsPreflight(request)) {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  // Phase 1: fast, idempotent — completes on every request in <100ms.
  // Hydration starts eagerly but does NOT block.
  ensureGatewayInitialized();

  // Phase 2: only hydration-dependent procedures block here.
  // Independent procedures proceed immediately.
  // SPRINT-087E — Hydration is bounded + error-isolated per store (a
  // database outage fails fast and the mirror starts empty, catching up on
  // later writes).  The shared promise is created once and reused.
  await ensureHydrationIfRequired(request.url);

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
