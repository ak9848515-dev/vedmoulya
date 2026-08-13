// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Tests: ContextMapper
// EI-003 — Enterprise Context Intelligence Engine
// Covers summaryToDTO key-defaulting and whyRelevant branch paths.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ContextMapper } from '../ContextMapper.js';
import type { ContextItem, ContextScore } from '../../types/context-types.js';

function makeItem(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    contextId: 'ctx_map_001',
    source: 'knowledge_base',
    category: 'knowledge',
    priority: 'high',
    importance: 0.8,
    confidence: 0.9,
    freshness: 0.9,
    size: 400,
    estimatedTokens: 100,
    language: 'en',
    tags: ['test'],
    business: ['platform'],
    capability: ['reasoning'],
    version: '1.0.0',
    content: 'Context content for mapping.',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceId: 'src_001',
    ...overrides,
  };
}

function makeScore(overrides: Partial<ContextScore> = {}): ContextScore {
  return {
    finalScore: 0.9,
    priorityScore: 0.9,
    relevanceScore: 0.8,
    freshnessScore: 0.9,
    businessScore: 0.9,
    confidenceScore: 0.9,
    ...overrides,
  };
}

describe('ContextMapper', () => {
  it('summaryToDTO defaults unknown keys to 0', () => {
    const summary = ContextMapper.summaryToDTO(
      3,
      250,
      { knowledge_base: 2, unknown_source: 7 },
      { knowledge: 2, bogus: 9 },
      { high: 2, nope: 3 },
    );
    expect(summary.total).toBe(3);
    expect(summary.totalTokens).toBe(250);
    expect(summary.countBySource.knowledge_base).toBe(2);
    expect(summary.countBySource.conversation_memory).toBe(0);
    expect(summary.countByCategory.knowledge).toBe(2);
    expect(summary.countByPriority.high).toBe(2);
  });

  it('explanationToDTO builds a whyRelevant with all signals', () => {
    const item = makeItem({ business: ['platform', 'growth'] });
    const score = makeScore({
      priorityScore: 0.95,
      freshnessScore: 0.95,
      businessScore: 0.95,
    });
    const dto = ContextMapper.explanationToDTO(item, score);
    expect(dto.whyRelevant).toContain('High priority');
    expect(dto.whyRelevant).toContain('Recently created');
    expect(dto.whyRelevant).toContain('Matches current business context');
    expect(dto.scoreBreakdown).toContain('Priority');
  });

  it('explanationToDTO falls back when all scores are low', () => {
    const item = makeItem({ business: [] });
    const score = makeScore({
      priorityScore: 0.2,
      freshnessScore: 0.2,
      businessScore: 0.2,
      relevanceScore: 0.2,
      confidenceScore: 0.2,
    });
    const dto = ContextMapper.explanationToDTO(item, score);
    expect(dto.whyRelevant).toContain('Context item from');
  });

  it('previewToDTO truncates long snippets', () => {
    const item = makeItem({ content: 'x'.repeat(500) });
    const dto = ContextMapper.previewToDTO(item, makeScore());
    expect(dto.snippet.length).toBe(203); // 200 chars + '...'
    expect(dto.snippet.endsWith('...')).toBe(true);
    expect(dto.score).toBeDefined();
  });

  it('discoveryToDTO maps scores into a record', () => {
    const scores = new Map([
      ['ctx_map_001', makeScore()],
      ['ctx_map_002', makeScore({ finalScore: 0.5 })],
    ]);
    const dto = ContextMapper.discoveryToDTO([makeItem()], scores, { sources: ['knowledge_base'] });
    expect(dto.total).toBe(1);
    expect(dto.scores.ctx_map_001?.finalScore).toBe(0.9);
    expect(dto.scores.ctx_map_002?.finalScore).toBe(0.5);
    expect(dto.appliedFilters).toEqual({ sources: ['knowledge_base'] });
  });
});
