// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Trust Score tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { KnowledgeTrustScoreService } from '../KnowledgeTrustScoreService.js';
import type { KnowledgeItem } from '../../../types/knowledge-types.js';
import { createCatalogKnowledgeItems } from '../../../catalog/knowledge-catalog.js';

function baseItem(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  const seed = createCatalogKnowledgeItems()[0];
  return {
    ...seed,
    citations: [],
    consumers: [],
    usage: { totalReads: 0, totalConsumers: 0 },
    validationStatus: 'unvalidated',
    lifecycleStatus: 'draft',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('KnowledgeTrustScoreService', () => {
  const service = new KnowledgeTrustScoreService();

  it('scores within [0, 1] and derives a level', () => {
    const score = service.score(baseItem());
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(1);
    expect(['low', 'medium', 'high']).toContain(score.level);
    expect(score.factors.length).toBeGreaterThan(0);
  });

  it('ranks validated repository sources above unvalidated manual ones', () => {
    const trustworthy = service.score(
      baseItem({
        sourceType: 'repository',
        validationStatus: 'validated',
        citations: [
          {
            citationId: 'c1',
            sourceId: 's',
            sourceTitle: 'S',
            sourceType: 'repository',
            reference: 'r',
            retrievedAt: new Date().toISOString(),
            verified: true,
          },
          {
            citationId: 'c2',
            sourceId: 's',
            sourceTitle: 'S',
            sourceType: 'repository',
            reference: 'r',
            retrievedAt: new Date().toISOString(),
            verified: true,
          },
          {
            citationId: 'c3',
            sourceId: 's',
            sourceTitle: 'S',
            sourceType: 'repository',
            reference: 'r',
            retrievedAt: new Date().toISOString(),
            verified: true,
          },
        ],
        consumers: [
          {
            consumerId: 'c',
            consumerType: 'engine',
            consumerLabel: 'E',
            usageCount: 5,
            firstUsedAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString(),
          },
        ],
        usage: { totalReads: 50, totalConsumers: 1 },
      }),
    );
    const shaky = service.score(
      baseItem({
        sourceType: 'manual',
        validationStatus: 'failed',
        updatedAt: '2025-01-01T00:00:00.000Z',
      }),
    );
    expect(trustworthy.score).toBeGreaterThan(shaky.score);
    expect(trustworthy.level).toBe('high');
  });

  it('penalizes high-criticality dependencies', () => {
    const clean = service.score(baseItem({ dependencies: [] }));
    const risky = service.score(
      baseItem({
        dependencies: [
          { dependencyId: 'd1', targetId: 'kn_x', type: 'depends_on', criticality: 'high' },
          { dependencyId: 'd2', targetId: 'kn_y', type: 'depends_on', criticality: 'high' },
          { dependencyId: 'd3', targetId: 'kn_z', type: 'depends_on', criticality: 'high' },
        ],
      }),
    );
    expect(clean.score).toBeGreaterThan(risky.score);
  });

  it('recency decays for very old items', () => {
    const fresh = service.score(baseItem());
    const ancient = service.score(baseItem({ updatedAt: '2020-01-01T00:00:00.000Z' }));
    expect(fresh.score).toBeGreaterThanOrEqual(ancient.score);
  });

  it('respects custom options (citation saturation)', () => {
    const strict = new KnowledgeTrustScoreService({ citationSaturation: 10 });
    const loose = new KnowledgeTrustScoreService({ citationSaturation: 1 });
    const item = baseItem({
      citations: [
        {
          citationId: 'c1',
          sourceId: 's',
          sourceTitle: 'S',
          sourceType: 'document',
          reference: 'r',
          retrievedAt: new Date().toISOString(),
          verified: false,
        },
      ],
    });
    expect(loose.score(item).score).toBeGreaterThanOrEqual(strict.score(item).score);
  });
});
