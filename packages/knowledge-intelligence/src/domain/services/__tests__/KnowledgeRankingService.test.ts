// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Ranking tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { KnowledgeRankingService } from '../KnowledgeRankingService.js';
import type { KnowledgeItem } from '../../../types/knowledge-types.js';
import { createCatalogKnowledgeItems } from '../../../catalog/knowledge-catalog.js';

function item(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return { ...createCatalogKnowledgeItems()[0], ...overrides };
}

describe('KnowledgeRankingService', () => {
  const service = new KnowledgeRankingService();

  it('ranks items descending by composite score', () => {
    const items = [
      item({
        knowledgeId: 'kn_low',
        trust: { score: 0.3, level: 'low', factors: [] },
        confidence: { score: 0.3, level: 'low', factors: [] },
        usage: { totalReads: 0, totalConsumers: 0 },
      }),
      item({
        knowledgeId: 'kn_high',
        trust: { score: 0.95, level: 'high', factors: [] },
        confidence: { score: 0.9, level: 'high', factors: [] },
        usage: { totalReads: 100, totalConsumers: 3 },
      }),
    ];
    const ranked = service.rank(items);
    expect(ranked[0]?.item.knowledgeId).toBe('kn_high');
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it('rankOne exposes the four contribution weights', () => {
    const ranked = service.rankOne(item());
    expect(ranked.contributions.map((c) => c.factor)).toEqual([
      'trust',
      'confidence',
      'usage',
      'recency',
    ]);
    expect(ranked.contributions.map((c) => c.weight)).toEqual([0.5, 0.2, 0.15, 0.15]);
    expect(ranked.score).toBeGreaterThan(0);
    expect(ranked.score).toBeLessThanOrEqual(1);
  });

  it('saturates usage and recency contributions', () => {
    const ranked = service.rankOne(
      item({
        usage: { totalReads: 100_000, totalConsumers: 50 },
        updatedAt: new Date().toISOString(),
      }),
    );
    const usage = ranked.contributions.find((c) => c.factor === 'usage');
    const recency = ranked.contributions.find((c) => c.factor === 'recency');
    expect(usage?.value).toBeLessThanOrEqual(1);
    expect(recency?.value).toBeLessThanOrEqual(1);
  });

  it('topByTrust returns the highest-trusted items', () => {
    const top = service.topByTrust(createCatalogKnowledgeItems(), 3);
    expect(top.length).toBeLessThanOrEqual(3);
    expect(top[0]?.trust.score).toBeGreaterThanOrEqual(top[1]?.trust.score ?? 0);
  });

  it('topByConsumption returns the most-read items', () => {
    const top = service.topByConsumption(createCatalogKnowledgeItems(), 2);
    expect(top.length).toBeLessThanOrEqual(2);
    expect(top[0]?.usage.totalReads).toBeGreaterThanOrEqual(top[1]?.usage.totalReads ?? 0);
  });

  it('handles empty input', () => {
    expect(service.rank([])).toEqual([]);
    expect(service.topByTrust([])).toEqual([]);
    expect(service.topByConsumption([])).toEqual([]);
  });
});
