// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Module Registration
// Registers all identity infrastructure services with DI container
// ──────────────────────────────────────────────────────────────────

import { container, logger, moduleRegistry } from '@vedmoulya/core';
import type { ModuleDefinition } from '@vedmoulya/core';
import type { IdentityRepository } from '@vedmoulya/domain';
import { PostgresIdentityRepository } from '../persistence/PostgresIdentityRepository.js';
import { UserCache } from '../cache/UserCache.js';
import { IdentityEventPublisher } from '../events/IdentityEventPublisher.js';
import { initializeDatabase, closeDatabase } from '../persistence/DatabaseConnection.js';
import { InMemoryEventBus } from '@vedmoulya/core';
import { AuthService } from '../../auth/AuthService.js';
import { AuthorizationService } from '../../authorization/AuthorizationService.js';
import { TokenService } from '../../auth/TokenService.js';
import { PasswordService } from '../../auth/PasswordService.js';
import { GoogleProvider } from '../../auth/GoogleProvider.js';
import { IdentityMetrics } from '../../observability/IdentityMetrics.js';
import { IdentityAuditor } from '../../observability/IdentityAudit.js';
import { IdentityTracer } from '../../observability/IdentityTracing.js';
import {
  type VerificationTokenStore,
  createVerificationTokenStore,
} from '../persistence/VerificationTokenStore.js';
import { type OAuthStateStore, createOAuthStateStore } from '../persistence/OAuthStateStore.js';
import {
  type RefreshTokenDenylistStore,
  createRefreshTokenDenylistStore,
} from '../persistence/RefreshTokenDenylistStore.js';
import { ensureIdentitySchema } from '../persistence/migrations.js';

/**
 * Defensive schema bootstrap for the identity stores (remediation B).
 *
 * The authoritative path is the AWAITED boot pass
 * (`awaitAllEngineEnsureTables()` → the versioned identity migrations), so by
 * the time traffic can arrive the schema already exists. This remains for the
 * paths that resolve a Postgres store without that pass (direct service
 * construction, background workers).
 *
 * Two deliberate changes from the previous per-store DDL:
 *   • ONE single-flight migration run covers all four identity tables instead
 *     of three independent DDL passes that could interleave;
 *   • a failure is reported through the platform logger with its reason
 *     instead of a swallowed `console.warn`, because it means every sign-in,
 *     refresh and verification call is about to fail.
 *
 * In dev/test the env-driven factory returns the in-memory store, which has no
 * `ensureTable`; nothing is bootstrapped there (no database is involved).
 */
function bootstrapIdentitySchemaIfPostgres(store: object): void {
  if (typeof (store as { ensureTable?: unknown }).ensureTable !== 'function') return;
  void ensureIdentitySchema().catch((error: unknown) => {
    logger.error('Identity schema bootstrap failed — identity writes will fail until resolved', {
      reason: error instanceof Error ? error.message : String(error),
    });
  });
}

/** Register all identity infrastructure services with the DI container */
export function registerIdentityServices(): void {
  // Database
  container.register('identity.db', async () => {
    // eslint-disable-next-line @typescript-eslint/await-thenable
    await initializeDatabase();
    return {};
  });

  // Repository
  container.register<IdentityRepository>('identity.repository', () => {
    return new PostgresIdentityRepository();
  });

  // Cache
  container.register<UserCache>('identity.cache', () => {
    return new UserCache();
  });

  // Event Publisher
  container.register<IdentityEventPublisher>('identity.event-publisher', () => {
    const eventBus = container.has('event-bus')
      ? (container.resolve('event-bus') as InMemoryEventBus)
      : new InMemoryEventBus();
    return new IdentityEventPublisher(eventBus);
  });

  // Auth Services
  container.register<TokenService>('identity.token-service', () => {
    return new TokenService();
  });

  container.register<PasswordService>('identity.password-service', () => {
    return new PasswordService();
  });

  container.register<GoogleProvider>('identity.google-provider', () => {
    return new GoogleProvider();
  });

  container.register<VerificationTokenStore>('identity.verification-token-store', () => {
    const store = createVerificationTokenStore();
    bootstrapIdentitySchemaIfPostgres(store);
    return store;
  });

  container.register<OAuthStateStore>('identity.oauth-state-store', () => {
    const store = createOAuthStateStore();
    bootstrapIdentitySchemaIfPostgres(store);
    return store;
  });

  container.register<RefreshTokenDenylistStore>('identity.refresh-token-denylist', () => {
    const store = createRefreshTokenDenylistStore();
    bootstrapIdentitySchemaIfPostgres(store);
    return store;
  });

  container.register<AuthService>('identity.auth-service', () => {
    const repository = container.resolve('identity.repository') as IdentityRepository;
    const eventPublisher = container.resolve('identity.event-publisher') as IdentityEventPublisher;
    const verificationTokenStore = container.resolve(
      'identity.verification-token-store',
    ) as VerificationTokenStore;
    const oauthStateStore = container.resolve('identity.oauth-state-store') as OAuthStateStore;
    const refreshTokenDenylist = container.resolve(
      'identity.refresh-token-denylist',
    ) as RefreshTokenDenylistStore;
    return new AuthService(repository, eventPublisher, {
      verificationTokenStore,
      oauthStateStore,
      refreshTokenDenylist,
    });
  });

  // Authorization Services
  container.register<AuthorizationService>('identity.authorization-service', () => {
    return new AuthorizationService();
  });

  // Observability Services
  container.register<IdentityMetrics>('identity.metrics', () => {
    return new IdentityMetrics();
  });

  container.register<IdentityAuditor>('identity.auditor', () => {
    return new IdentityAuditor();
  });

  container.register<IdentityTracer>('identity.tracer', () => {
    return new IdentityTracer();
  });
}

/** Define the identity module for the module registry */
export const identityModule: ModuleDefinition = {
  name: 'identity',
  description: 'Identity, authentication, authorization, and observability service',
  version: '0.1.0',
  dependencies: ['core'],
  register: () => {
    registerIdentityServices();
  },
  initialize: async () => {
    // eslint-disable-next-line @typescript-eslint/await-thenable
    await initializeDatabase();
  },
  shutdown: async () => {
    await closeDatabase();
  },
};

/** Self-register the module */
moduleRegistry.register(identityModule);
