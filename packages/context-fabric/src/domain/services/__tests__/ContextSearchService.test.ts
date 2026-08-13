// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Search tests
// APP-001 — Post-V1 Application Platform Layer
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  ConfidenceStrategy,
  ContextSearchService,
  GraphProximityStrategy,
  KeywordStrategy,
  MemoryRelevanceStrategy,
  MetadataStrategy,
  RecencyStrategy,
} from '../ContextSearchService.js';
import type { ContextEntity, ContextRetrievalQuery } from '../../../types/fabric-types.js';

const now = new Date().toISOString();

function entity(overrides: Partial<ContextEntity> & { entityId: string }): ContextEntity {
  return {
    graph: 'personal',
    type: 'document',
    label: 'default label',
    ownerId: 'user_001',
    tags: [],
    confidence: 0.8,
    lifecycle: 'active',
    source: 'import',
    provenance: {
      source: 'import',
      sourceId: overrides.entityId,
      createdAt: now,
      updatedAt: now,
      producedBy: 'test',
      confidence: 0.8,
    },
    permissions: {
      owner: 'user_001',
      scope: 'private',
      allowedUsers: [],
      allowedRoles: [],
      capability: [],
      grantedAt: now,
    },
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const query: ContextRetrievalQuery = {
  userId: 'user_001',
  query: 'enterprise blog platform',
};

describe('Retrieval strategies', () => {
  it('keyword strategy scores on token overlap', () => {
    const strategy = new KeywordStrategy();
    const match = entity({
      entityId: 'e1',
      label: 'Enterprise Blog Platform',
      description: 'The enterprise blog platform for insights',
    });
    const miss = entity({ entityId: 'e2', label: 'Customer invoices' });
    expect(strategy.score(match, query)).toBeGreaterThan(0);
    expect(strategy.score(miss, query)).toBe(0);
  });

  it('metadata strategy enforces filters', () => {
    const strategy = new MetadataStrategy();
    const doc = entity({ entityId: 'e1', source: 'document', type: 'document' });
    const memory = entity({ entityId: 'e2', source: 'memory', type: 'memory' });
    expect(strategy.score(doc, { ...query, filters: { sources: ['document'] } })).toBe(1);
    expect(strategy.score(memory, { ...query, filters: { sources: ['document'] } })).toBe(0);
    expect(strategy.score(doc, { ...query, filters: { minConfidence: 0.9 } })).toBe(0);
  });

  it('recency strategy decays with age', () => {
    const strategy = new RecencyStrategy(now);
    const fresh = entity({ entityId: 'e1', updatedAt: now });
    const old = entity({
      entityId: 'e2',
      updatedAt: new Date(Date.now() - 365 * 86_400_000).toISOString(),
    });
    expect(strategy.score(fresh, query)).toBeCloseTo(1, 1);
    expect(strategy.score(old, query)).toBeLessThan(0.1);
  });

  it('confidence strategy returns entity confidence', () => {
    const strategy = new ConfidenceStrategy();
    expect(strategy.score(entity({ entityId: 'e1', confidence: 0.75 }), query)).toBe(0.75);
  });

  it('memory relevance strategy returns the mapped recall weight', () => {
    const strategy = new MemoryRelevanceStrategy(new Map([['e1', 0.9]]));
    expect(strategy.score(entity({ entityId: 'e1' }), query)).toBe(0.9);
    expect(strategy.score(entity({ entityId: 'e2' }), query)).toBe(0);
  });

  it('graph proximity strategy reasons about the anchor', () => {
    const strategy = new GraphProximityStrategy();
    const reason = strategy.reason(entity({ entityId: 'e1' }), { ...query, goalId: 'goal_x' });
    expect(reason).toContain('goal_x');
  });
});

describe('ContextSearchService (hybrid retrieval)', () => {
  it('ranks matches above misses and respects the limit', async () => {
    const service = new ContextSearchService();
    const candidates = [
      entity({
        entityId: 'match',
        label: 'Enterprise Blog Platform',
        description: 'the enterprise platform',
      }),
      entity({ entityId: 'weak', label: 'Blog', description: 'a blog' }),
      entity({ entityId: 'miss', label: 'Invoices', description: 'nothing relevant' }),
    ];
    const result = await service.search(candidates, { ...query, limit: 2 });
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].entityId).toBe('match');
    expect(result.ranking[0].reasons.length).toBeGreaterThan(0);
    expect(result.total).toBe(3);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('boosts graph-connected entities when an anchor is present', async () => {
    const service = new ContextSearchService({
      neighbors: async (id: string) =>
        id === 'connected'
          ? [{ relationshipId: 'r', fromId: 'connected', toId: 'goal_x' } as never]
          : [],
    });
    const candidates = [
      entity({ entityId: 'connected', label: 'connected doc' }),
      entity({ entityId: 'isolated', label: 'isolated doc' }),
    ];
    const result = await service.search(candidates, { ...query, goalId: 'goal_x' });
    expect(result.entities[0].entityId).toBe('connected');
    expect(result.ranking[0].components.graph_proximity).toBeGreaterThan(0);
  });

  it('returns empty ranking for an empty candidate pool', async () => {
    const service = new ContextSearchService();
    const result = await service.search([], query);
    expect(result.entities).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('supports custom strategy sets', async () => {
    const service = new ContextSearchService(undefined, {
      strategies: [new MemoryRelevanceStrategy(new Map([['e1', 0.99]]))],
    });
    const result = await service.search(
      [entity({ entityId: 'e1' }), entity({ entityId: 'e2' })],
      query,
      { memory_relevance: 1 },
    );
    expect(result.entities[0].entityId).toBe('e1');
  });
});
