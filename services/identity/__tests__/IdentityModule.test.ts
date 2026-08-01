// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Identity Module (DI)
// Verifies service registration, module definition, and lifecycle hooks
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { container, moduleRegistry } from '@vedmoulya/core';

// Mock the database connection module so registration never opens a real pool.
const mockInitializeDatabase = vi.fn();
const mockCloseDatabase = vi.fn();
vi.mock('../src/infrastructure/persistence/DatabaseConnection.js', () => ({
  initializeDatabase: (...args: unknown[]) => mockInitializeDatabase(...args),
  closeDatabase: (...args: unknown[]) => mockCloseDatabase(...args),
  getDatabase: vi.fn(),
}));

import {
  registerIdentityServices,
  identityModule,
} from '../src/infrastructure/di/IdentityModule.js';

const SERVICE_KEYS = [
  'identity.db',
  'identity.repository',
  'identity.cache',
  'identity.event-publisher',
  'identity.token-service',
  'identity.password-service',
  'identity.google-provider',
  'identity.auth-service',
  'identity.authorization-service',
  'identity.metrics',
  'identity.auditor',
  'identity.tracer',
];

describe('IdentityModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitializeDatabase.mockResolvedValue({});
    mockCloseDatabase.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Avoid leaking singletons into other test files that use the global container.
    container.clear();
  });

  describe('registerIdentityServices', () => {
    it('registers all identity services with the container', () => {
      registerIdentityServices();
      for (const key of SERVICE_KEYS) {
        expect(container.has(key)).toBe(true);
      }
    });

    it('resolves the repository as a singleton instance', () => {
      registerIdentityServices();
      const first = container.resolve('identity.repository');
      const second = container.resolve('identity.repository');
      expect(first).toBe(second);
      expect(first).toBeDefined();
    });

    it('resolves the auth service wired with repository and event publisher', () => {
      registerIdentityServices();
      const authService = container.resolve('identity.auth-service');
      expect(authService).toBeDefined();
      expect(authService).toHaveProperty('signInWithEmail');
    });

    it('reuses a pre-registered event-bus when present', () => {
      const bus = { publish: vi.fn() };
      container.register('event-bus', () => bus);
      registerIdentityServices();
      const publisher = container.resolve('identity.event-publisher') as {
        eventBus?: { publish: () => void };
      };
      expect(publisher.eventBus).toBe(bus);
    });
  });

  describe('identityModule definition', () => {
    it('declares the expected metadata', () => {
      expect(identityModule.name).toBe('identity');
      expect(identityModule.description).toContain('Identity');
      expect(identityModule.version).toBe('0.1.0');
      expect(identityModule.dependencies).toContain('core');
    });

    it('register() calls registerIdentityServices', () => {
      const spy = vi.fn();
      const original = identityModule.register;
      // register() takes a container arg; wrap to observe invocation.
      identityModule.register = (c: unknown) => {
        spy(c);
        original(c);
      };
      try {
        identityModule.register(container);
        expect(spy).toHaveBeenCalled();
        expect(container.has('identity.repository')).toBe(true);
      } finally {
        identityModule.register = original;
      }
    });

    it('initialize() opens the database', async () => {
      await identityModule.initialize();
      expect(mockInitializeDatabase).toHaveBeenCalled();
    });

    it('shutdown() closes the database', async () => {
      await identityModule.shutdown();
      expect(mockCloseDatabase).toHaveBeenCalled();
    });
  });

  describe('module registry self-registration', () => {
    it('is registered in the module registry under "identity"', () => {
      const registered = moduleRegistry.get('identity');
      expect(registered).toBeDefined();
      expect(registered?.name).toBe('identity');
    });
  });
});
