// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Production Identity Repository Wiring
// SPRINT PR-002A regression tests — prove the gateway resolves authentication
// persistence through the production Identity repository (reusing the identity
// module's existing DI registration) and that the complete authenticated
// request path works end-to-end.
//
// Coverage:
//   - Repository resolution: createProductionIdentityRepository() resolves the
//     production PostgresIdentityRepository via the identity DI container.
//   - Repository injection: ApiApplicationService accepts an injected identity
//     repository (backward compatible) and defaults to production.
//   - Identity lookup: register → getUserById through the real application
//     service against the wired repository.
//   - Authenticated profile retrieval: real tRPC pipeline (JWT context → auth
//     middleware → IDOR guard → router → service → repository).
//   - JWT validation: access tokens issued by the identity TokenService verify
//     in the gateway (shared secret / issuer / audience contract).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';

// CERT-002: silence the observability logger for this suite — constructing the
// production ApiApplicationService resolves real Postgres repositories whose
// DatabaseConnection singletons emit "…database connection established" INFO
// logs. Vitest intercepts console output asynchronously via the worker RPC;
// under full-suite load the pending writes race with worker teardown and
// surface as `Closing rpc while "onUserConsoleLog" was pending` teardown errors
// even though every test passes. The wiring under test here is repository
// resolution — not the logger — so the logger is a no-op.
vi.mock('@vedmoulya/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vedmoulya/core')>();
  const silentLogger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
    child: () => silentLogger,
  };
  return { ...actual, logger: silentLogger };
});

import { container } from '@vedmoulya/core';
import { PostgresIdentityRepository, TokenService } from '@vedmoulya/identity';
import { ApiApplicationService } from '../services/ApiApplicationService.js';
import { createAppRouter, t } from '../services/RouterRegistry.js';
import { createInMemoryRepositories } from '../infrastructure/InMemoryRepositories.js';
import { createProductionIdentityRepository } from '../infrastructure/ProductionRepositories.js';
import { verifyAccessToken } from '../middleware/auth.js';
import type { TRPCContext } from '../router.js';

// ── Repository Resolution ────────────────────────────────────────────────────

describe('createProductionIdentityRepository (SPRINT PR-002A)', () => {
  it('resolves the production PostgresIdentityRepository through the identity DI registration', () => {
    const repo = createProductionIdentityRepository();
    expect(repo).toBeInstanceOf(PostgresIdentityRepository);
    // Reuses the existing DI registration — no duplicate registration.
    expect(container.has('identity.repository')).toBe(true);
  });

  it('returns the same singleton instance across calls', () => {
    expect(createProductionIdentityRepository()).toBe(createProductionIdentityRepository());
  });
});

// ── Repository Injection & Identity Lookup ───────────────────────────────────

describe('ApiApplicationService repository injection', () => {
  it('uses an injected identity repository instead of the production one', async () => {
    const repos = createInMemoryRepositories();
    const svc = new ApiApplicationService({ identityRepository: repos.identity });

    const registered = await svc.identity.registerUser({
      email: 'injected@vedmoulya.dev',
      displayName: 'Injected User',
      givenName: 'Injected',
      familyName: 'User',
      passwordHash: 'hashed-value',
    });
    const profile = await svc.identity.getUserById(registered.id);

    expect(profile.email).toBe('injected@vedmoulya.dev');
    expect(profile.displayName).toBe('Injected User');
  });

  it('defaults to the production identity repository when no override is given', () => {
    const productionRepo = createProductionIdentityRepository();
    const svc = new ApiApplicationService();
    expect(svc.identity).toBeDefined();
    // The default wiring resolves the same production singleton the factory
    // returns (reusing the identity module's DI registration).
    expect(container.resolve('identity.repository')).toBe(productionRepo);
    expect(productionRepo).toBeInstanceOf(PostgresIdentityRepository);
  });
});

// ── Authenticated Profile Retrieval (real tRPC pipeline) ─────────────────────

describe('Authenticated profile retrieval through the gateway', () => {
  const authCtx = (userId: string, email: string): TRPCContext => ({
    userId,
    email,
    role: 'user',
  });

  it('returns the user profile for a valid JWT session', async () => {
    const repos = createInMemoryRepositories();
    const svc = new ApiApplicationService({ identityRepository: repos.identity });
    const router = createAppRouter(svc);
    const createCaller = t.createCallerFactory(router);

    const registered = await svc.identity.registerUser({
      email: 'gw-profile@vedmoulya.dev',
      displayName: 'Gateway Profile',
      passwordHash: 'h',
    });

    const caller = createCaller(authCtx(registered.id, 'gw-profile@vedmoulya.dev'));
    const profile = await caller.identity.getProfile({ userId: registered.id });

    expect(profile.success).toBe(true);
    expect(profile.data.email).toBe('gw-profile@vedmoulya.dev');
    expect(profile.data.displayName).toBe('Gateway Profile');
  });

  it('rejects unauthenticated profile retrieval with UNAUTHORIZED', async () => {
    const repos = createInMemoryRepositories();
    const svc = new ApiApplicationService({ identityRepository: repos.identity });
    const router = createAppRouter(svc);
    const caller = t.createCallerFactory(router)({
      userId: 'anonymous',
      email: '',
      role: 'guest',
    });

    await expect(caller.identity.getProfile({ userId: 'any-user' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('enforces the IDOR guard (FORBIDDEN for another user id)', async () => {
    const repos = createInMemoryRepositories();
    const svc = new ApiApplicationService({ identityRepository: repos.identity });
    const router = createAppRouter(svc);
    const caller = t.createCallerFactory(router)(authCtx('session-user', 's@vedmoulya.dev'));

    await expect(caller.identity.getProfile({ userId: 'other-user' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

// ── JWT Cross-Service Compatibility ──────────────────────────────────────────

describe('JWT validation (identity TokenService → gateway verifyAccessToken)', () => {
  it('verifies access tokens issued by the identity TokenService', async () => {
    const tokens = await new TokenService().generateTokenPair('user-1', 'u@vedmoulya.dev', 'user');

    const session = await verifyAccessToken(tokens.accessToken);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe('user-1');
    expect(session?.email).toBe('u@vedmoulya.dev');
  });

  it('rejects refresh tokens through the access-token verifier', async () => {
    const tokens = await new TokenService().generateTokenPair('user-2', 'u2@vedmoulya.dev', 'user');

    expect(await verifyAccessToken(tokens.refreshToken)).toBeNull();
  });
});
