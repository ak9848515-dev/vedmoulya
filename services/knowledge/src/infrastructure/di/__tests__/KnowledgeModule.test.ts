// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Module registration unit tests
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';

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

vi.mock('../../persistence/DatabaseConnection.js', () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  closeDatabase: vi.fn().mockResolvedValue(undefined),
}));

const { registerKnowledgeServices, knowledgeModule } = await import('../KnowledgeModule.js');

describe('KnowledgeModule', () => {
  beforeEach(() => {
    mockContainer.registry.clear();
    mockContainer.register.mockClear();
  });

  it('registers db, repository, cache, event publisher, and observability services', () => {
    registerKnowledgeServices();

    const registeredKeys = mockContainer.register.mock.calls.map((c) => c[0]);
    expect(registeredKeys).toEqual(
      expect.arrayContaining([
        'knowledge.db',
        'knowledge.repository',
        'knowledge.cache',
        'knowledge.event-publisher',
        'knowledge.metrics',
        'knowledge.auditor',
        'knowledge.tracer',
      ]),
    );
  });

  it('resolves the event publisher with a shared event-bus when present', () => {
    const sharedBus = { id: 'shared' };
    mockContainer.registry.set('event-bus', sharedBus);
    registerKnowledgeServices();

    const factory = mockContainer.registry.get('knowledge.event-publisher') as () => unknown;
    expect(factory).toBeDefined();
    mockContainer.resolve.mockReturnValue(sharedBus);
    factory();
    expect(mockContainer.has).toHaveBeenCalledWith('event-bus');
  });

  it('every registered factory resolves without throwing', () => {
    registerKnowledgeServices();

    for (const key of mockContainer.registry.keys()) {
      const factory = mockContainer.registry.get(key) as () => unknown;
      expect(typeof factory).toBe('function');
      expect(() => factory()).not.toThrow();
    }
  });

  it('knowledgeModule exposes module metadata and register hook', () => {
    expect(knowledgeModule.name).toBe('knowledge');
    expect(knowledgeModule.version).toBe('0.1.0');
    expect(knowledgeModule.dependencies).toEqual(['core']);
    expect(typeof knowledgeModule.register).toBe('function');
    expect(typeof knowledgeModule.initialize).toBe('function');
    expect(typeof knowledgeModule.shutdown).toBe('function');
    knowledgeModule.register();
    expect(mockContainer.register).toHaveBeenCalled();
  });

  it('knowledgeModule initializes and shuts down cleanly', async () => {
    await expect(knowledgeModule.initialize()).resolves.toBeUndefined();
    await expect(knowledgeModule.shutdown()).resolves.toBeUndefined();
  });

  it('self-registers with the module registry', () => {
    expect(mockModuleRegistry.register).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'knowledge' }),
    );
  });
});
