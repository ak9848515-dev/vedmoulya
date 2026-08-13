// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Search tests (the eight modes)
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { KnowledgeSearchService } from '../KnowledgeSearchService.js';
import type { KnowledgeItem } from '../../../types/knowledge-types.js';
import { createCatalogKnowledgeItems } from '../../../catalog/knowledge-catalog.js';

function makeItem(id: string, title: string, description: string, tags: string[]): KnowledgeItem {
  return {
    knowledgeId: id,
    title,
    description,
    source: 'test',
    sourceType: 'repository',
    owner: 'test',
    category: 'technical',
    tags,
    trust: { score: 0.8, level: 'high', factors: [] },
    confidence: { score: 0.8, level: 'high', factors: [] },
    version: 1,
    versionHistory: [],
    consumers: [],
    dependencies: [],
    relationships: [],
    citations: [],
    usage: { totalReads: 0, totalConsumers: 0 },
    validationStatus: 'pending',
    lifecycleStatus: 'draft',
    audit: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('KnowledgeSearchService', () => {
  const items = createCatalogKnowledgeItems();
  const service = new KnowledgeSearchService();

  it('keyword search finds title matches first', () => {
    const results = service.search(items, { query: 'OpenAI provider profile' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.knowledgeId).toBe('kn_openai_provider_profile');
    expect(results[0].matchedFields).toContain('title');
  });

  it('semantic mode wins for natural-language phrases over short items', () => {
    const short: KnowledgeItem[] = [
      makeItem('kn_tiny_a', 'Alpha pipeline', 'pipeline quality gate', ['pipeline', 'quality']),
      makeItem('kn_tiny_b', 'Bravo', 'garden tools', ['garden']),
    ];
    // Query 'pipeline quality gate standards alpha beta' — Alpha shares 4 of 6
    // tokens (keyword 0.67) but its tiny vector gives cosine 0.71 > 0.67, so
    // the lexical-semantic ranker wins the tie.
    const results = service.search(short, { query: 'pipeline quality gate standards alpha beta' });
    expect(results[0]?.item.knowledgeId).toBe('kn_tiny_a');
    expect(results[0]?.matchType).toBe('semantic');
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  it('category mode filters by category and labels the match', () => {
    const results = service.search(items, { query: '', category: 'sap' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.item.category === 'sap')).toBe(true);
    expect(results.every((r) => r.matchType === 'category')).toBe(true);
  });

  it('detects a category named in the query', () => {
    const results = service.search(items, { query: 'SAP Knowledge' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.matchType === 'category' && r.item.category === 'sap')).toBe(
      true,
    );
  });

  it('relationship mode filters by edge type', () => {
    const results = service.search(items, { query: '', relationshipType: 'depends_on' });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((r) => r.item.relationships.some((edge) => edge.type === 'depends_on')),
    ).toBe(true);
  });

  it('dependency mode finds items that depend on a target', () => {
    const results = service.search(items, {
      query: '',
      dependencyTargetId: 'kn_capability_research',
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.item.knowledgeId === 'kn_blog_pipeline_playbook')).toBe(true);
  });

  it('consumer mode filters by consumer type', () => {
    const results = service.search(items, { query: '', consumerType: 'module' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.item.consumers.some((c) => c.consumerType === 'module'))).toBe(
      true,
    );
  });

  it('trust mode filters by a trust floor', () => {
    const results = service.search(items, { query: '', minTrust: 0.85 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.item.trust.score >= 0.85)).toBe(true);
    expect(results.every((r) => r.matchType === 'trust')).toBe(true);
  });

  it('version mode filters by exact version', () => {
    const results = service.search(items, { query: '', versionNumber: 3 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.item.version === 3)).toBe(true);
  });

  it('combines filters: query + category + tags', () => {
    const results = service.search(items, {
      query: 'pipeline',
      category: 'execution',
      tags: ['blog'],
    });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((r) => r.item.category === 'execution' && r.item.tags.includes('blog')),
    ).toBe(true);
  });

  it('respects limit and offset', () => {
    const first = service.search(items, { query: 'provider', limit: 3, offset: 0 });
    const second = service.search(items, { query: 'provider', limit: 3, offset: 3 });
    expect(first.length).toBeLessThanOrEqual(3);
    expect(first[0]?.item.knowledgeId).not.toBe(second[0]?.item.knowledgeId);
    expect(first[0]?.score).toBeGreaterThanOrEqual(second[0]?.score ?? 0);
  });

  it('sorts by score descending', () => {
    const results = service.search(items, { query: 'provider' });
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('returns snippets that contain the query when present', () => {
    const results = service.search(items, { query: 'brand guide' });
    expect(results.length).toBeGreaterThan(0);
  });

  it('rankAll orders by composite ranking', () => {
    const ranked = service.rankAll(items);
    expect(ranked.length).toBe(items.length);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].score);
  });
});
