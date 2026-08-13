// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Catalog tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  createCatalogKnowledgeItemMap,
  createCatalogKnowledgeItems,
  createCatalogKnowledgeRelationships,
  hasAllKnowledgeCategories,
  SEED_KNOWLEDGE_SIZE,
} from '../knowledge-catalog.js';
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_SOURCE_TYPES } from '../../types/knowledge-types.js';
import { validateItem, validateRelationship } from '../../domain/rules/KnowledgeRules.js';

describe('knowledge-catalog', () => {
  const items = createCatalogKnowledgeItems();

  it('seeds the expected number of items with unique ids', () => {
    expect(items.length).toBe(SEED_KNOWLEDGE_SIZE);
    const ids = new Set(items.map((i) => i.knowledgeId));
    expect(ids.size).toBe(items.length);
  });

  it('covers all 14 knowledge categories', () => {
    expect(hasAllKnowledgeCategories(items)).toBe(true);
    for (const category of KNOWLEDGE_CATEGORIES) {
      expect(
        items.some((i) => i.category === category),
        `missing ${category}`,
      ).toBe(true);
    }
  });

  it('uses only known source types', () => {
    for (const item of items) {
      expect(KNOWLEDGE_SOURCE_TYPES).toContain(item.sourceType);
    }
  });

  it('produces shape-valid items', () => {
    for (const item of items) {
      const result = validateItem(item);
      expect(result.passed, `${item.knowledgeId}: ${result.message ?? ''}`).toBe(true);
    }
  });

  it('produces valid relationships that reference seed items only', () => {
    const ids = new Set(items.map((i) => i.knowledgeId));
    const relationships = createCatalogKnowledgeRelationships();
    expect(relationships.length).toBeGreaterThan(0);
    for (const edge of relationships) {
      expect(validateRelationship(edge).passed).toBe(true);
      expect(ids.has(edge.sourceId)).toBe(true);
      expect(ids.has(edge.targetId)).toBe(true);
    }
  });

  it('scores trust/confidence within bounds', () => {
    for (const item of items) {
      expect(item.trust.score).toBeGreaterThanOrEqual(0);
      expect(item.trust.score).toBeLessThanOrEqual(1);
      expect(item.confidence.score).toBeGreaterThanOrEqual(0);
      expect(item.confidence.score).toBeLessThanOrEqual(1);
    }
  });

  it('exposes the item map', () => {
    const map = createCatalogKnowledgeItemMap();
    expect(map.size).toBe(items.length);
    expect(map.get('kn_openai_provider_profile')?.category).toBe('ai');
  });

  it('references the other engines seed entities', () => {
    const ids = items.map((i) => i.knowledgeId);
    expect(ids).toContain('kn_blog_seed_goal');
    const joined = items
      .map((i) => `${i.title} ${i.description} ${i.source} ${i.tags.join(' ')}`)
      .join(' ');
    expect(joined).toContain('OpenAI');
    expect(joined).toContain('goal_blog_seed');
    expect(joined).toContain('EI-007');
    expect(joined).toContain('EI-008');
    expect(joined).toContain('plan_goal_blog_seed_seed');
  });
});
