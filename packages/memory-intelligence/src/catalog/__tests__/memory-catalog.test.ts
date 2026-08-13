// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory catalog tests
// EI-010 — Enterprise Memory Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  createCatalogMemoryItems,
  createCatalogMemoryRelationships,
  createCatalogMemoryItemMap,
  hasAllMemoryTypes,
  SEED_MEMORY_SIZE,
  SEED_MEMORY_RELATIONSHIPS_SIZE,
} from '../memory-catalog.js';

describe('memory catalog', () => {
  it('builds the seed registry with deterministic ids', () => {
    const items = createCatalogMemoryItems();
    expect(items.length).toBe(SEED_MEMORY_SIZE);
    expect(new Set(items.map((i) => i.memoryId)).size).toBe(items.length);
  });

  it('covers all 14 memory types', () => {
    expect(hasAllMemoryTypes(createCatalogMemoryItems())).toBe(true);
  });

  it('builds relationship edges that reference only seed items', () => {
    const items = createCatalogMemoryItems();
    const relationships = createCatalogMemoryRelationships();
    expect(relationships.length).toBe(SEED_MEMORY_RELATIONSHIPS_SIZE);
    const ids = new Set(items.map((i) => i.memoryId));
    for (const relationship of relationships) {
      expect(ids.has(relationship.sourceId)).toBe(true);
      expect(ids.has(relationship.targetId)).toBe(true);
      expect(relationship.relationshipId).toMatch(/^mrel_seed_/);
    }
  });

  it('builds the id → item convenience map', () => {
    const map = createCatalogMemoryItemMap();
    expect(map.size).toBe(SEED_MEMORY_SIZE);
    expect(map.get('mem_openai_reliability')?.type).toBe('provider');
  });

  it('seeded items carry importance, confidence, lifecycle, and audit', () => {
    for (const item of createCatalogMemoryItems()) {
      expect(item.importance.score).toBeGreaterThan(0);
      expect(item.confidence.score).toBeGreaterThan(0);
      expect(item.lifecycleStatus.length).toBeGreaterThan(0);
      expect(item.audit[0]?.action).toBe('captured');
    }
  });
});
