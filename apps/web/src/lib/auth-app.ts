// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Identity Auth Hono App
// MOB-001 — Mobile Authentication
// Builds (lazily, once) the Hono application that serves the EXISTING
// Identity Service auth router (createAuthRouter — sign-in, sign-up,
// google/url, google/callback, refresh, session, sign-out) with the
// production identity repository, mirroring how the tRPC gateway is served
// inside the Next.js app. The auth implementation itself is untouched.
//
// NOTE: Hono matches the FULL request pathname, so the router is mounted at
// its documented base path (`/api/v1/identity/auth`) — mounting at '/' would
// 404 every auth call (see auth-app.test.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { Hono, type MiddlewareHandler } from 'hono';
import { InMemoryEventBus } from '@vedmoulya/core';
import {
  AuthService,
  authRouteConfig,
  createAuthRouter,
  IdentityEventPublisher,
  createVerificationTokenStore,
  type VerificationTokenStore,
} from '@vedmoulya/identity';
import {
  createProductionIdentityRepository,
  getServices,
  awaitAllEngineEnsureTables,
} from '@vedmoulya/api';
import { consumeAuthRequest, resolveClientIp } from './auth-rate-limit.js';

let authApp: Hono | null = null;

// Credential endpoints are brute-force targets — throttle them per client IP
// (hardening 2026-08-09; the remaining GET/OAuth/session/health routes stay
// open so state-parameter OAuth flows and health checks are never blocked).
const SENSITIVE_AUTH_SUFFIXES = ['/sign-in', '/sign-up', '/refresh'] as const;

function createAuthRateLimitMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    const isSensitive = SENSITIVE_AUTH_SUFFIXES.some((suffix) => pathname.endsWith(suffix));
    if (isSensitive) {
      const retryAfterMs = consumeAuthRequest(resolveClientIp(c.req.raw));
      if (retryAfterMs > 0) {
        return c.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many attempts. Please try again later.',
            },
          },
          429,
          { 'retry-after': String(Math.ceil(retryAfterMs / 1000)) },
        );
      }
    }
    return next();
  };
}

/** Lazy singleton — module scope stays inert during `next build`. */
export async function getAuthApp(): Promise<Hono> {
  if (authApp === null) {
    // SPRINT-089 / SPRINT-090B — gateway initialization + sequential DDL.
    // The identity users table is already in the gateway's deferred DDL
    // queue (from createProductionIdentityRepository()). Calling getServices()
    // ensures the gateway is initialized and deferredTables is populated;
    // awaitAllEngineEnsureTables() then runs ALL deferred DDL sequentially
    // (including the identity users table) before we touch auth.  This
    // eliminates the race where getAuthApp() ran its own eager DDL, opening
    // a second connection that competed with the gateway's sequential DDL
    // for the CI PostgreSQL connection pool ("sorry, too many clients").
    //
    // SPRINT-090B — DDL is now fire-and-forget here: the /session endpoint
    // (used by session-manager startup restore) only verifies JWTs and must
    // not block on database readiness.  Blocking caused E2E tests to hang:
    // injectSession() → restoreSession() → verifySession() → getAuthApp()
    // → awaitAllEngineEnsureTables() → ensureTable() → PostgreSQL
    // connection → stuck (no DB in dev), so setSessionReady(true) was never
    // reached and the brain page stayed at "Loading…" forever.
    // The tRPC route handler already follows this same fire-and-forget
    // pattern (engineTablesReady).
    getServices();
    void awaitAllEngineEnsureTables().catch(() => {});
    const repository = createProductionIdentityRepository();
    // SPRINT-045 — same deterministic cold-start for the email-verification
    // token table: a fresh production database must have `email_verifications`
    // before the first sign-up can issue a verification token.
    const verificationTokenStore: VerificationTokenStore = createVerificationTokenStore();
    await (
      verificationTokenStore as VerificationTokenStore & {
        ensureTable?(): Promise<void>;
      }
    ).ensureTable?.();
    const eventPublisher = new IdentityEventPublisher(new InMemoryEventBus());
    const authService = new AuthService(repository, eventPublisher, {
      verificationTokenStore,
    });
    authApp = new Hono()
      .use(`${authRouteConfig.basePath}/*`, createAuthRateLimitMiddleware())
      .route(authRouteConfig.basePath, createAuthRouter(authService));
  }
  return authApp;
}
