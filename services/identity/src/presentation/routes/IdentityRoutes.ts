// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity HTTP Routes
// Hono router for all identity REST API endpoints
//
// SECURITY (Sprint 022–025 closure, Phase 4B): this router is NOT mounted
// by the running application (the app mounts only `createAuthRouter` at
// `/api/v1/identity/auth`; see `apps/web/src/app/api/v1/identity/auth/`).
// It previously mounted user-management endpoints with NO authorization
// middleware, so it would have been an unauthenticated administrative
// surface if it were ever mounted.
//
// It is now FAIL-CLOSED BY CONSTRUCTION: an authentication verifier is a
// REQUIRED argument, and every non-public route is guarded by the EXISTING
// authentication + CASL authorization middleware
// (`requireAuth` → `requireAbility` / `requireOwnership`). There is no
// configuration in which this module can serve user management without
// authentication and authorization.
//
// Authorization policy applied here is the SAME policy the running
// application already uses:
//   • registration + validation + health  → public (no user data returned)
//   • list users / lookup by email        → requires the `read User` ability
//   • activate / deactivate               → requires the `update User` ability
//   • archive (delete)                    → requires the `archive User` ability
//   • a single user record (read / patch) → requires OWNERSHIP of that record
//     (`requireOwnership`), matching the tRPC `identity.getProfile` /
//     `identity.updateProfile` procedures that are self-scoped via the
//     central IDOR guard.
// ──────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { resolveCorsOrigins } from '@vedmoulya/core';
import type { IdentityApplicationService } from '@vedmoulya/services';
import { IdentityController } from '../controllers/IdentityController.js';
import { errorMiddleware } from '../middleware/ErrorMapper.js';
import { requireAuth } from '../../auth/AuthMiddleware.js';
import type { AccessTokenPayload } from '../../auth/TokenService.js';
import { requireAbility, requireOwnership } from '../../authorization/AuthorizationMiddleware.js';

/**
 * The authentication dependency this router REQUIRES. It is the identity
 * service's own access-token verifier — the router never validates a token
 * itself and never invents a session.
 */
export interface IdentityRouterAuth {
  /** Verify a Bearer access token; returns the session payload or null. */
  verifyToken: (token: string) => Promise<AccessTokenPayload | null>;
}

/**
 * Create the identity router with all endpoints.
 *
 * `auth` is REQUIRED (fail-closed): administrative and self-service routes
 * cannot be registered without an authentication verifier, so no caller can
 * mount an unguarded user-management surface.
 */
export function createIdentityRouter(
  identityService: IdentityApplicationService,
  auth: IdentityRouterAuth,
): Hono {
  // FAIL-CLOSED GUARD: refuse to build the router at all rather than expose
  // user-management endpoints without an authentication verifier. The
  // parameter is non-optional at the TYPE level, but a JavaScript (untyped)
  // caller can still omit it — so the runtime guard deliberately treats `auth`
  // as possibly absent instead of relying on the compiler alone.
  const verifier = (auth as IdentityRouterAuth | undefined)?.verifyToken;
  if (typeof verifier !== 'function') {
    throw new Error(
      'createIdentityRouter requires an access-token verifier (fail-closed): refusing to mount an identity surface without authentication.',
    );
  }

  const controller = new IdentityController(identityService);
  const router = new Hono();

  // ── Global Middleware ────────────────────────────────────────────────────
  // CORS — canonical policy (@vedmoulya/core resolveCorsOrigins). Development
  // keeps the permissive local default; production/staging requires an explicit
  // API_CORS_ORIGIN allow-list and never reflects an arbitrary Origin.
  router.use('*', cors({ origin: resolveCorsOrigins() }));
  router.use('*', logger());
  router.use('*', errorMiddleware);

  // The single authentication gate reused by every protected route.
  const authenticated = requireAuth(auth.verifyToken);

  // ── Public: registration + validation + health ──────────────────────────
  // These return no user data and are the documented self-service surface.
  router.post('/users', (c) => controller.registerUser(c));
  router.post('/users/validate', (c) => controller.validateRegistration(c));
  router.get('/health', (c) => c.json({ status: 'healthy', service: 'identity' }));

  // ── Administrative: authenticated AND authorized by ability ─────────────
  router.get('/users', authenticated, requireAbility('read', 'User'), (c) =>
    controller.listUsers(c),
  );
  // NOTE: /email/:email must come BEFORE /:id to avoid Hono matching 'email' as the :id param
  router.get('/users/email/:email', authenticated, requireAbility('read', 'User'), (c) =>
    controller.getUserByEmail(c),
  );
  router.post('/users/:id/activate', authenticated, requireAbility('update', 'User'), (c) =>
    controller.activateUser(c),
  );
  router.post('/users/:id/deactivate', authenticated, requireAbility('update', 'User'), (c) =>
    controller.deactivateUser(c),
  );
  router.delete('/users/:id', authenticated, requireAbility('archive', 'User'), (c) =>
    controller.deleteUser(c),
  );

  // ── Self-service: authenticated AND owner of the record ─────────────────
  router.get('/users/:id', authenticated, requireOwnership('id'), (c) => controller.getUserById(c));
  router.patch('/users/:id/profile', authenticated, requireOwnership('id'), (c) =>
    controller.updateProfile(c),
  );
  router.patch('/users/:id/preferences', authenticated, requireOwnership('id'), (c) =>
    controller.updatePreferences(c),
  );
  router.patch('/users/:id/settings', authenticated, requireOwnership('id'), (c) =>
    controller.updateSettings(c),
  );
  router.get('/users/:id/auth-check', authenticated, requireOwnership('id'), (c) =>
    controller.checkAuthentication(c),
  );

  return router;
}

/** Identity routes configuration metadata for documentation */
export const identityRouteConfig = {
  basePath: '/api/v1/identity',
  tags: ['Identity'],
  description: 'Identity management and user lifecycle API',
  /**
   * MOUNTING PRECONDITION (enforced by the required `auth` argument, recorded
   * here for operators): this router must be mounted only with the identity
   * service's access-token verifier. Public routes are registration,
   * registration validation and health; every other route requires a valid
   * access token, and user management additionally requires the matching CASL
   * ability or ownership of the addressed record.
   */
  authorization: 'requireAuth + requireAbility/requireOwnership (fail-closed)' as const,
} as const;
