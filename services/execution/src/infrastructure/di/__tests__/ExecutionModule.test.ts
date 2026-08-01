// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Module registration unit tests
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mocks for @vedmoulya/core DI primitives
const mockContainer = vi.hoisted(() => {
  const registry = new Map<string, unknown>();
  return {
    registry,
    register: vi.fn((key: string, fn: () => unknown) => {
      registry.set(key, fn);
    }),
    has: vi.fn((key: string) => registry.has(key)),
    resolve: vi.fn((key: string) => registry.get(key)),
  };
});

const mockModuleRegistry = vi.hoisted(() => ({
  register: vi.fn(),
}));

const mockInMemoryEventBus = vi.hoisted(() => vi.fn());

// Minimal stand-in for the abstract BaseRepository base class (takes a name).
const mockBaseRepository = vi.hoisted(
  () =>
    class BaseRepository {
      protected readonly repositoryName: string;
      protected readonly logger: { child: (name: string) => unknown } = {
        child: () => ({}),
      };
      constructor(repositoryName: string) {
        this.repositoryName = repositoryName;
      }
    },
);

vi.mock('@vedmoulya/core', () => ({
  container: mockContainer,
  moduleRegistry: mockModuleRegistry,
  InMemoryEventBus: mockInMemoryEventBus,
  BaseRepository: mockBaseRepository,
}));

// Mock the DatabaseConnection to avoid touching real postgres
vi.mock('../../persistence/DatabaseConnection.js', () => ({
  initializeDatabase: vi.fn(),
  closeDatabase: vi.fn().mockResolvedValue(undefined),
}));

// Import AFTER mocks are registered
const { registerExecutionServices, executionModule } = await import('../ExecutionModule.js');

describe('ExecutionModule', () => {
  beforeEach(() => {
    mockContainer.registry.clear();
    mockContainer.register.mockClear();
    // Note: mockModuleRegistry.register is NOT cleared here — it fires once at
    // module import time (top-level moduleRegistry.register(executionModule)).
  });

  it('registers db, repository, cache, event publisher, and observability services', () => {
    registerExecutionServices();

    const registeredKeys = mockContainer.register.mock.calls.map((c) => c[0]);
    expect(registeredKeys).toEqual(
      expect.arrayContaining([
        'execution.db',
        'execution.repository',
        'execution.cache',
        'execution.event-publisher',
        'execution.metrics',
        'execution.auditor',
        'execution.tracer',
      ]),
    );
  });

  it('resolves the event publisher with a shared event-bus when present', () => {
    const sharedBus = { id: 'shared' };
    mockContainer.registry.set('event-bus', sharedBus);
    registerExecutionServices();

    // Grab the factory registered for the event publisher
    const factory = mockContainer.registry.get('execution.event-publisher') as () => unknown;
    expect(factory).toBeDefined();
    mockContainer.resolve.mockReturnValue(sharedBus);
    factory();
    expect(mockContainer.has).toHaveBeenCalledWith('event-bus');
  });

  it('executionModule exposes module metadata and register hook', () => {
    expect(executionModule.name).toBe('execution');
    expect(executionModule.version).toBe('0.1.0');
    expect(executionModule.dependencies).toEqual(['core']);
    expect(typeof executionModule.register).toBe('function');
    expect(typeof executionModule.initialize).toBe('function');
    expect(typeof executionModule.shutdown).toBe('function');
    executionModule.register();
    expect(mockContainer.register).toHaveBeenCalled();
  });

  it('executionModule initializes and shuts down cleanly', async () => {
    await expect(executionModule.initialize()).resolves.toBeUndefined();
    await expect(executionModule.shutdown()).resolves.toBeUndefined();
  });

  it('every registered factory resolves without throwing', () => {
    registerExecutionServices();

    for (const key of mockContainer.registry.keys()) {
      const factory = mockContainer.registry.get(key) as () => unknown;
      expect(typeof factory).toBe('function');
      expect(() => factory()).not.toThrow();
    }
  });

  it('self-registers with the module registry', () => {
    expect(mockModuleRegistry.register).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'execution' }),
    );
  });
});
