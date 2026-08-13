// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Knowledge Repository tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { InMemoryKnowledgeRepository } from '../InMemoryKnowledgeRepository.js';
import {
  createCatalogKnowledgeItems,
  createCatalogKnowledgeRelationships,
} from '../../catalog/knowledge-catalog.js';

describe('InMemoryKnowledgeRepository', () => {
  it('saves and finds items', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const items = createCatalogKnowledgeItems();
    await repo.saveItem(items[0]);
    expect(await repo.findItemById(items[0].knowledgeId)).toEqual(items[0]);
    expect(await repo.findItemById('missing')).toBeNull();
    expect(await repo.countItems()).toBe(1);
  });

  it('lists items with filters and pagination', async () => {
    const repo = new InMemoryKnowledgeRepository({ items: createCatalogKnowledgeItems() });
    const sap = await repo.listItems({ category: 'sap' }, { page: 1, limit: 10 });
    expect(sap.total).toBeGreaterThan(0);
    expect(sap.data.every((i) => i.category === 'sap')).toBe(true);

    const trusted = await repo.listItems({ minTrust: 0.85 }, { page: 1, limit: 10 });
    expect(trusted.data.every((i) => i.trust.score >= 0.85)).toBe(true);

    const page2 = await repo.listItems({}, { page: 2, limit: 5 });
    expect(page2.page).toBe(2);
    expect(page2.total).toBe(30);

    const tagged = await repo.listItems({ tag: 'blog' }, { page: 1, limit: 50 });
    expect(tagged.data.every((i) => i.tags.includes('blog'))).toBe(true);
  });

  it('lists by category and deletes items (including their edges)', async () => {
    const repo = new InMemoryKnowledgeRepository({
      items: createCatalogKnowledgeItems(),
      relationships: createCatalogKnowledgeRelationships(),
    });
    const ai = await repo.listItemsByCategory('ai');
    expect(ai.length).toBeGreaterThan(0);

    await repo.deleteItem('kn_blog_pipeline_playbook');
    const remaining = await repo.listRelationshipsForItem('kn_blog_pipeline_playbook');
    expect(remaining.length).toBe(0);
    // Edges pointing AT the deleted item are cleaned too.
    const allEdges = await repo.listRelationships();
    expect(allEdges.some((e) => e.targetId === 'kn_blog_pipeline_playbook')).toBe(false);
  });

  it('manages relationship edges', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const items = createCatalogKnowledgeItems();
    const relationships = createCatalogKnowledgeRelationships();
    for (const item of items) await repo.saveItem(item);
    for (const edge of relationships) await repo.saveRelationship(edge);

    expect(await repo.countRelationships()).toBe(relationships.length);
    const byType = await repo.listRelationships('depends_on');
    expect(byType.length).toBeGreaterThan(0);
    expect(byType.every((e) => e.type === 'depends_on')).toBe(true);

    const forItem = await repo.listRelationshipsForItem('kn_blog_pipeline_playbook');
    expect(forItem.length).toBeGreaterThan(0);

    await repo.deleteRelationship(forItem[0].relationshipId);
    expect(await repo.findRelationshipById(forItem[0].relationshipId)).toBeNull();
  });

  it('seeds from a constructor', async () => {
    const items = createCatalogKnowledgeItems();
    const repo = new InMemoryKnowledgeRepository({ items });
    expect(await repo.countItems()).toBe(items.length);
  });
});
