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
import { createProductionIdentityRepository, awaitAllEngineEnsureTables } from '@vedmoulya/api';
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
    // SPRINT-098B — The auth app is intentionally DECOUPLED from getServices()
    // (the full gateway). getServices() constructs ApiApplicationService which
    // loads the entire application config (AI keys, Redis, SMTP, etc.). On
    // Vercel where some of these are not set, this crashes the auth app and
    // returns 500 for ALL auth endpoints (sign-in, session, Google OAuth).
    //
    // The auth app only needs the identity repository + email-verification
    // table. createProductionIdentityRepository() registers its own DDL via
    // ensureTable() into the shared deferredTables queue; the fire-and-forget
    // awaitAllEngineEnsureTables() runs that DDL sequentially. No gateway
    // initialization is required.
    //
    // SPRINT-090B — DDL is fire-and-forget: the /session endpoint only
    // verifies JWTs and must not block on database readiness.
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
