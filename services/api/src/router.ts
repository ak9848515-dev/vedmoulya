// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Main Router
// Unified tRPC router exposing all certified modules
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import { ApiApplicationService } from './services/ApiApplicationService.js';
import { createAppRouter } from './services/RouterRegistry.js';

// ── Global Services Instance (lazy) ────────────────────────────────────────
// Constructing ApiApplicationService wires production Postgres repositories
// and probes, which read @vedmoulya/core config. Construction is deferred
// until the first request so importing @vedmoulya/api stays inert at module
// scope — `next build` (NODE_ENV=production, no env vars) can bundle the
// route handlers without evaluating configuration.

let servicesInstance: ApiApplicationService | null = null;
let appRouterInstance: AppRouter | null = null;

/**
 * Lazily construct (and cache) the gateway application service on first
 * use. Idempotent — repeated calls return the shared singleton.
 */
export function getServices(): ApiApplicationService {
  if (servicesInstance === null) {
    servicesInstance = new ApiApplicationService();
  }
  return servicesInstance;
}

// ── tRPC Context ────────────────────────────────────────────────────────────

export interface TRPCContext {
  userId: string;
  email: string;
  role: string;
  /**
   * Client IP derived from the request headers (x-forwarded-for / x-real-ip).
   * Optional and never used for authentication or ownership — it exists so
   * unauthenticated, token-scoped surfaces (the client portal) can be rate
   * limited per client instead of sharing a single anonymous bucket.
   */
  clientIp?: string;
}

// ── App Router ──────────────────────────────────────────────────────────────

export type AppRouter = ReturnType<typeof createAppRouter>;

/**
 * Lazily build the unified app router on first use (request time).
 * Idempotent — repeated calls return the shared singleton.
 */
export function getAppRouter(): AppRouter {
  if (appRouterInstance === null) {
    appRouterInstance = createAppRouter(getServices());
  }
  return appRouterInstance;
}
