// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Knowledge Graph tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { InMemoryKnowledgeRepository } from '../InMemoryKnowledgeRepository.js';
import { InMemoryKnowledgeGraph } from '../InMemoryKnowledgeGraph.js';
import {
  createCatalogKnowledgeItems,
  createCatalogKnowledgeRelationships,
} from '../../catalog/knowledge-catalog.js';

function seededGraph(): InMemoryKnowledgeGraph {
  const repo = new InMemoryKnowledgeRepository({
    items: createCatalogKnowledgeItems(),
    relationships: createCatalogKnowledgeRelationships(),
  });
  return new InMemoryKnowledgeGraph(repo);
}

describe('InMemoryKnowledgeGraph', () => {
  it('returns neighbors in both directions', async () => {
    const graph = seededGraph();
    const neighbors = await graph.getNeighbors('kn_blog_pipeline_playbook');
    const ids = neighbors.map((n) => n.knowledgeId);
    expect(ids).toContain('kn_capability_research');
    expect(ids).toContain('kn_blog_pipeline_playbook_v1');
    // Reverse direction: items that link TO the playbook.
    const inbound = await graph.getNeighbors('kn_blog_seed_goal');
    expect(inbound.map((n) => n.knowledgeId)).toContain('kn_blog_pipeline_playbook');
  });

  it('traverses breadth-first bounded by depth', async () => {
    const graph = seededGraph();
    const traversal = await graph.traverse('kn_blog_pipeline_playbook', 1);
    expect(traversal.rootId).toBe('kn_blog_pipeline_playbook');
    expect(traversal.visited.length).toBeGreaterThan(0);
    expect(traversal.visited.every((v) => v.depth <= 1)).toBe(true);
  });

  it('finds the shortest path between connected items', async () => {
    const graph = seededGraph();
    const path = await graph.shortestPath('kn_blog_seed_goal', 'kn_capability_research');
    expect(path.length).toBeGreaterThan(1);
    expect(path[0]).toBe('kn_blog_seed_goal');
    expect(path[path.length - 1]).toBe('kn_capability_research');
    // The path must be a valid edge chain.
    const repo = new InMemoryKnowledgeRepository({
      items: createCatalogKnowledgeItems(),
      relationships: createCatalogKnowledgeRelationships(),
    });
    for (let i = 0; i < path.length - 1; i += 1) {
      const edges = await repo.listRelationshipsForItem(path[i]);
      expect(edges.some((e) => e.sourceId === path[i + 1] || e.targetId === path[i + 1])).toBe(
        true,
      );
    }
  });

  it('returns an empty path for disconnected items', async () => {
    const graph = seededGraph();
    const path = await graph.shortestPath('kn_mobile_release_notes', 'kn_sap_field_glossary');
    expect(path).toEqual([]);
  });

  it('handles unknown roots and self paths', async () => {
    const graph = seededGraph();
    expect((await graph.traverse('kn_ghost')).visited).toEqual([]);
    expect(await graph.shortestPath('kn_1', 'kn_1')).toEqual(['kn_1']);
  });
});
