// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory pipeline services tests
// EI-010 — Enterprise Memory Intelligence Platform
// Covers Retrieval, Compression, Consolidation, Expiration,
// Relationship, Citation, and Analytics services.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MemoryRetrievalService } from '../MemoryRetrievalService.js';
import { MemoryCompressionService } from '../MemoryCompressionService.js';
import { MemoryConsolidationService } from '../MemoryConsolidationService.js';
import { MemoryExpirationService } from '../MemoryExpirationService.js';
import { MemoryRelationshipService } from '../MemoryRelationshipService.js';
import { MemoryCitationService } from '../MemoryCitationService.js';
import { MemoryAnalyticsService } from '../MemoryAnalyticsService.js';
import type { MemoryItem, MemoryRelationship } from '../../../types/memory-types.js';
import { createCatalogMemoryItems } from '../../../catalog/memory-catalog.js';

function item(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    memoryId: 'mem_1',
    type: 'provider',
    title: 'OpenAI reliability memory',
    content: 'Three consecutive runs completed with high quality on the reasoning stage.',
    source: 'execution history',
    sourceType: 'execution',
    owner: 'platform',
    tags: ['openai', 'reliability'],
    importance: { score: 0.8, level: 'high', factors: [] },
    confidence: { score: 0.85, level: 'high', factors: [] },
    usage: { totalRetrievals: 5, totalConsumers: 1, frequency: 2, recency: 0.9 },
    lifecycleStatus: 'active',
    compressionState: 'summarized',
    retentionPolicy: 'long_term',
    consumers: [],
    relationships: [],
    citations: [],
    audit: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('MemoryRetrievalService', () => {
  const svc = new MemoryRetrievalService();

  it('retrieves by related goal', () => {
    const result = svc.retrieve(
      [item(), item({ memoryId: 'mem_2', title: 'Unrelated', relatedGoal: undefined })],
      { relatedGoal: 'goal_blog_seed' },
    );
    expect(result.length).toBe(0); // no item linked to that goal
    const linked = svc.retrieve([item({ relatedGoal: 'goal_blog_seed' })], {
      relatedGoal: 'goal_blog_seed',
    });
    expect(linked[0]?.matchType).toBe('goal');
    expect(linked[0]?.score).toBeGreaterThan(0.8);
  });

  it('retrieves by similarity with a query', () => {
    const result = svc.retrieve([item()], { query: 'OpenAI reliability reasoning runs' });
    expect(result.length).toBe(1);
    expect(result[0]?.score).toBeGreaterThan(0.5);
  });

  it('filters by time range and importance', () => {
    const result = svc.retrieve(
      [item(), item({ memoryId: 'mem_2', createdAt: '2026-01-01T00:00:00.000Z' })],
      { from: '2026-07-01T00:00:00.000Z', minImportance: 0.9 },
    );
    expect(result.length).toBe(0); // minImportance 0.9 excludes both
  });

  it('includes inactive memories only when asked', () => {
    const expired = item({ memoryId: 'mem_e', lifecycleStatus: 'expired' });
    expect(svc.retrieve([expired], { query: 'OpenAI' }).length).toBe(0);
    expect(svc.retrieve([expired], { query: 'OpenAI', includeInactive: true }).length).toBe(1);
  });

  it('returns an empty list when nothing matches', () => {
    expect(svc.retrieve([item()], { query: 'zzzzz-nonexistent' }).length).toBe(0);
  });
});

describe('MemoryCompressionService', () => {
  const svc = new MemoryCompressionService();
  const longContent = [
    'The blog pipeline requires a research stage before drafting.',
    'Provider fallback order is anthropic then google then deepseek.',
    'The review stage must approve every client-facing draft.',
    'Budget envelopes are capped at one dollar for this goal.',
  ].join(' ');

  it('compresses to the summarized state with a shorter summary', () => {
    const memory = item({ content: longContent });
    const result = svc.compress(memory, { target: 'summarized' });
    expect(result.compressionState).toBe('summarized');
    expect(result.afterLength).toBeLessThan(result.beforeLength);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('collapses single-sentence content to collapsed immediately', () => {
    const result = svc.compress(item({ content: 'Just one sentence here.' }), {
      target: 'summarized',
    });
    expect(result.compressionState).toBe('collapsed');
  });

  it('supports the collapsed target and never returns an empty summary', () => {
    const memory = item({ content: '   ' });
    const result = svc.compress(memory, { target: 'collapsed' });
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('splits sentences and scores them', () => {
    const memory = item({
      content: 'First sentence. Second sentence with OpenAI provider. Third!',
    });
    const sentences = svc.sentences(memory.content);
    expect(sentences.length).toBe(3);
    const scored = svc.scoreSentences(sentences, memory);
    expect(scored.length).toBe(3);
  });
});

describe('MemoryConsolidationService', () => {
  const svc = new MemoryConsolidationService();

  it('finds candidates that share an entity and title overlap', () => {
    const a = item({
      memoryId: 'mem_a',
      title: 'OpenAI reliability note',
      relatedProvider: 'openai',
    });
    const b = item({
      memoryId: 'mem_b',
      title: 'OpenAI reliability note two',
      relatedProvider: 'openai',
    });
    const c = item({ memoryId: 'mem_c', title: 'Budget track', relatedProvider: 'anthropic' });
    const candidates = svc.findCandidates([a, b, c]);
    expect(candidates.length).toBe(1);
    expect(candidates[0]?.duplicates.length).toBe(1);
  });

  it('merges duplicates into a stronger memory', () => {
    const a = item({
      memoryId: 'mem_a',
      title: 'OpenAI reliability note',
      relatedProvider: 'openai',
      usage: { totalRetrievals: 2, totalConsumers: 0, frequency: 1, recency: 0.5 },
    });
    const b = item({
      memoryId: 'mem_b',
      title: 'OpenAI reliability note two',
      relatedProvider: 'openai',
      usage: { totalRetrievals: 3, totalConsumers: 0, frequency: 4, recency: 0.8 },
    });
    const { consolidated, mergedCount } = svc.consolidate({ primary: a, duplicates: [b] });
    expect(mergedCount).toBe(2);
    expect(consolidated.usage.frequency).toBe(5);
    expect(consolidated.usage.totalRetrievals).toBe(5);
    expect(consolidated.audit.some((e) => e.action === 'consolidated')).toBe(true);
  });
});

describe('MemoryExpirationService', () => {
  const svc = new MemoryExpirationService();

  it('expires memories past their expiresAt with an audit', () => {
    const overdue = item({ memoryId: 'mem_o', expiresAt: '2026-01-01T00:00:00.000Z' });
    const result = svc.expire([overdue], { now: '2026-08-01T00:00:00.000Z' });
    expect(result.expired.length).toBe(1);
    expect(result.expired[0]?.lifecycleStatus).toBe('expired');
    expect(result.expired[0]?.audit[0]?.action).toBe('expired');
  });

  it('purges ephemeral memories when asked', () => {
    const overdue = item({
      memoryId: 'mem_p',
      retentionPolicy: 'ephemeral',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    const result = svc.expire([overdue], { purge: true, now: '2026-08-01T00:00:00.000Z' });
    expect(result.purged.length).toBe(1);
    expect(result.expired.length).toBe(0);
  });

  it('keeps permanent memories alive', () => {
    const permanent = item({
      memoryId: 'mem_perm',
      retentionPolicy: 'permanent',
      expiresAt: undefined,
    });
    const result = svc.expire([permanent], { now: '2026-08-01T00:00:00.000Z' });
    expect(result.active.length).toBe(1);
    expect(svc.isExpired(permanent)).toBe(false);
  });
});

describe('MemoryRelationshipService', () => {
  const svc = new MemoryRelationshipService();

  it('detects follows/similar_to/contradicts edges', () => {
    const earlier = item({
      memoryId: 'mem_earlier',
      title: 'Google vision failure note',
      type: 'failure',
      relatedProvider: 'google',
      createdAt: '2026-07-01T00:00:00.000Z',
    });
    const later = item({
      memoryId: 'mem_later',
      title: 'Google vision failure retry',
      type: 'failure',
      relatedProvider: 'google',
      createdAt: '2026-08-01T00:00:00.000Z',
    });
    const success = item({
      memoryId: 'mem_ok',
      title: 'Vision stage success',
      type: 'success',
      relatedProvider: 'google',
    });
    const edges = svc.detectRelationships(later, [earlier, success], 'platform');
    expect(edges.some((e) => e.type === 'follows' && e.targetId === 'mem_earlier')).toBe(true);
    expect(edges.some((e) => e.type === 'similar_to' && e.targetId === 'mem_earlier')).toBe(true);
    expect(edges.some((e) => e.type === 'contradicts' && e.targetId === 'mem_ok')).toBe(true);
  });

  it('enforces integrity: self-loops and duplicates rejected', () => {
    const edge: MemoryRelationship = {
      relationshipId: 'mrel_1',
      type: 'recalls',
      sourceId: 'mem_a',
      targetId: 'mem_b',
      weight: 0.7,
      actor: 'platform',
      createdAt: '2026-08-01T00:00:00.000Z',
    };
    expect(svc.checkIntegrity(edge, []).allowed).toBe(true);
    expect(svc.checkIntegrity({ ...edge, sourceId: 'mem_a', targetId: 'mem_a' }, []).allowed).toBe(
      false,
    );
    expect(svc.checkIntegrity(edge, [edge]).allowed).toBe(false);
  });

  it('bounded edge detection respects maxEdges', () => {
    const registry = Array.from({ length: 20 }, (_, i) =>
      item({
        memoryId: `mem_${i}`,
        title: `OpenAI reliability run ${i}`,
        relatedProvider: 'openai',
      }),
    );
    const edges = svc.detectRelationships(item(), registry, 'platform', { maxEdges: 4 });
    expect(edges.length).toBeLessThanOrEqual(4);
  });
});

describe('MemoryCitationService', () => {
  const svc = new MemoryCitationService();

  it('verifies citations against the source reliability table', () => {
    const verified = svc.verify(
      [
        {
          citationId: 'mcit_1',
          sourceId: 'x',
          sourceTitle: 'X',
          sourceType: 'execution',
          reference: 'r',
          retrievedAt: '2026-08-01T00:00:00.000Z',
          verified: false,
        },
      ],
      'system',
    );
    expect(verified[0]?.verified).toBe(true);
  });

  it('builds a citation and honors explicit verification', () => {
    const citation = svc.cite(
      { sourceId: 'doc/1', sourceTitle: 'Doc', reference: '§2', verified: false },
      '2026-08-01T00:00:00.000Z',
    );
    expect(citation.citationId).toMatch(/^mcit_/);
    expect(citation.verified).toBe(false);
    const trusted = svc.cite(
      { sourceId: 'doc/1', sourceTitle: 'Doc', reference: '§2' },
      '2026-08-01T00:00:00.000Z',
    );
    expect(trusted.verified).toBe(true);
  });
});

describe('MemoryAnalyticsService', () => {
  const svc = new MemoryAnalyticsService();

  it('aggregates the catalog with distributions and a 14-day trend', () => {
    const analytics = svc.aggregate(createCatalogMemoryItems());
    expect(analytics.totals.memories).toBeGreaterThan(0);
    expect(analytics.byType.provider).toBeGreaterThan(0);
    expect(analytics.totals.relationships).toBeGreaterThan(0);
    expect(analytics.totals.avgImportance).toBeGreaterThan(0);
    expect(analytics.trend.length).toBe(14);
    expect(analytics.usageTop[0]?.title).toBeDefined();
  });

  it('handles the empty registry', () => {
    const analytics = svc.aggregate([]);
    expect(analytics.totals.memories).toBe(0);
    expect(analytics.totals.avgImportance).toBe(0);
    expect(analytics.consumersTop.length).toBe(0);
  });
});
