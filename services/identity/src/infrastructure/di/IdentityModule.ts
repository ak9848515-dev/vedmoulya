// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Module Registration
// Registers all identity infrastructure services with DI container
// ──────────────────────────────────────────────────────────────────

import { container, moduleRegistry } from '@vedmoulya/core';
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
    // SPRINT-045 — bootstrap the email-verification token table idempotently
    // (estate convention). Fire-and-forget: in production/staging the Postgres
    // store is used and the DDL is required; in dev/test the in-memory store
    // is used and ensureTable is a no-op-safe optional call.
    const withEnsure = store as VerificationTokenStore & { ensureTable?(): Promise<void> };
    void withEnsure.ensureTable?.().catch((error: unknown) => {
      console.warn('Verification token table creation failed', error);
    });
    return store;
  });

  container.register<AuthService>('identity.auth-service', () => {
    const repository = container.resolve('identity.repository') as IdentityRepository;
    const eventPublisher = container.resolve('identity.event-publisher') as IdentityEventPublisher;
    const verificationTokenStore = container.resolve(
      'identity.verification-token-store',
    ) as VerificationTokenStore;
    return new AuthService(repository, eventPublisher, { verificationTokenStore });
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
