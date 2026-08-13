// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Tests: ContextRankingService
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ContextRankingService } from '../services/ContextRankingService.js';
import type { ContextItem } from '../../types/context-types.js';

function createMockItem(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    contextId: 'test_ctx_001',
    source: 'knowledge_base',
    category: 'knowledge',
    priority: 'medium',
    importance: 0.7,
    confidence: 0.85,
    freshness: 0.8,
    size: 500,
    estimatedTokens: 125,
    language: 'en',
    tags: ['test', 'knowledge'],
    business: ['platform'],
    capability: ['reasoning', 'general_conversation'],
    version: '1.0.0',
    content: 'Test content for context ranking evaluation.',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceId: 'test_source_001',
    ...overrides,
  };
}

describe('ContextRankingService', () => {
  const service = new ContextRankingService();

  it('scores a single item with all 5 dimensions', () => {
    const item = createMockItem();
    const score = service.scoreItem(item, 'reasoning');

    expect(score).toHaveProperty('priorityScore');
    expect(score).toHaveProperty('relevanceScore');
    expect(score).toHaveProperty('freshnessScore');
    expect(score).toHaveProperty('businessScore');
    expect(score).toHaveProperty('confidenceScore');
    expect(score).toHaveProperty('finalScore');
    expect(score.priorityScore).toBeGreaterThanOrEqual(0);
    expect(score.priorityScore).toBeLessThanOrEqual(1);
    expect(score.finalScore).toBeGreaterThanOrEqual(0);
    expect(score.finalScore).toBeLessThanOrEqual(1);
  });

  it('gives higher scores for matching capability', () => {
    const item = createMockItem({ capability: ['reasoning'] });
    const matchingScore = service.scoreItem(item, 'reasoning');
    const nonMatchingScore = service.scoreItem(item, 'vision');

    expect(matchingScore.relevanceScore).toBeGreaterThan(nonMatchingScore.relevanceScore);
    expect(matchingScore.finalScore).toBeGreaterThan(nonMatchingScore.finalScore);
  });

  it('gives highest priority score to critical items', () => {
    const critical = createMockItem({ priority: 'critical' });
    const background = createMockItem({ priority: 'background' });
    const criticalScore = service.scoreItem(critical, 'reasoning');
    const backgroundScore = service.scoreItem(background, 'reasoning');

    expect(criticalScore.priorityScore).toBeGreaterThan(backgroundScore.priorityScore);
  });

  it('computes freshness score with decay over time', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const recent = createMockItem({ createdAt: new Date(now - day).toISOString() });
    const old = createMockItem({ createdAt: new Date(now - 100 * day).toISOString() });
    const recentScore = service.scoreItem(recent, 'reasoning');
    const oldScore = service.scoreItem(old, 'reasoning');

    expect(recentScore.freshnessScore).toBeGreaterThan(oldScore.freshnessScore);
  });

  it('business score is neutral when no business context provided', () => {
    const item = createMockItem({ business: ['platform'] });
    const score = service.scoreItem(item, 'reasoning');
    expect(score.businessScore).toBe(0.5);
  });

  it('business score increases with matching business context', () => {
    const item = createMockItem({ business: ['platform', 'business'] });
    const score = service.scoreItem(item, 'reasoning', undefined, ['platform']);
    expect(score.businessScore).toBeGreaterThan(0.5);
  });

  it('scores multiple items and returns a map', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', priority: 'critical' }),
      createMockItem({ contextId: 'ctx_002', priority: 'low' }),
      createMockItem({ contextId: 'ctx_003', priority: 'medium' }),
    ];
    const scores = service.scoreItems(items, 'reasoning');
    expect(scores.size).toBe(3);
    expect(scores.has('ctx_001')).toBe(true);
    expect(scores.has('ctx_002')).toBe(true);
    expect(scores.has('ctx_003')).toBe(true);
  });

  it('ranks items by final score descending', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', priority: 'low', capability: ['vision'] }),
      createMockItem({ contextId: 'ctx_002', priority: 'critical', capability: ['reasoning'] }),
      createMockItem({ contextId: 'ctx_003', priority: 'medium', capability: ['reasoning'] }),
    ];
    const scores = service.scoreItems(items, 'reasoning');
    const ranked = service.rankItems(items, scores);
    expect(ranked[0]!.contextId).toBe('ctx_002');
    expect(ranked[ranked.length - 1]!.contextId).toBe('ctx_001');
  });

  it('respects maxResults in rankItems', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001' }),
      createMockItem({ contextId: 'ctx_002' }),
      createMockItem({ contextId: 'ctx_003' }),
    ];
    const scores = service.scoreItems(items, 'reasoning');
    const ranked = service.rankItems(items, scores, 2);
    expect(ranked).toHaveLength(2);
  });

  it('gives confidence score equal to item confidence', () => {
    const item = createMockItem({ confidence: 0.75 });
    const score = service.scoreItem(item, 'reasoning');
    expect(score.confidenceScore).toBe(0.75);
  });

  it('boosts score when requestIntent overlaps item tags', () => {
    // Request capability must NOT match the item's capability: an exact match
    // short-circuits at 0.9 and never reaches the tag-overlap boost path.
    const item = createMockItem({ tags: ['platform', 'report'], capability: ['coding'] });
    const base = service.scoreItem(item, 'vision');
    const boosted = service.scoreItem(item, 'vision', 'weekly report');
    expect(boosted.relevanceScore).toBeGreaterThan(base.relevanceScore);
    expect(boosted.finalScore).toBeGreaterThanOrEqual(base.finalScore);
  });

  it('detects related capabilities for partial relevance', () => {
    const item = createMockItem({ capability: ['coding'] });
    const score = service.scoreItem(item, 'reasoning');
    // reasoning and coding are related
    expect(score.relevanceScore).toBeGreaterThan(0.3);
    expect(score.relevanceScore).toBeLessThan(0.9);
  });
});
