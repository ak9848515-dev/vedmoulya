// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Knowledge Graph tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// PostgresKnowledgeGraph extends the in-memory traversal over the
// repository seam — these tests prove the production wiring resolves
// through the same contract.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { InMemoryKnowledgeRepository } from '../InMemoryKnowledgeRepository.js';
import { PostgresKnowledgeGraph } from '../PostgresKnowledgeGraph.js';
import {
  createCatalogKnowledgeItems,
  createCatalogKnowledgeRelationships,
} from '../../catalog/knowledge-catalog.js';

function seededGraph(): PostgresKnowledgeGraph {
  const repo = new InMemoryKnowledgeRepository({
    items: createCatalogKnowledgeItems(),
    relationships: createCatalogKnowledgeRelationships(),
  });
  return new PostgresKnowledgeGraph(repo);
}

describe('PostgresKnowledgeGraph', () => {
  it('returns neighbors in both directions', async () => {
    const graph = seededGraph();
    const neighbors = await graph.getNeighbors('kn_blog_pipeline_playbook');
    const ids = neighbors.map((n) => n.knowledgeId);
    expect(ids).toContain('kn_capability_research');
  });

  it('traverses breadth-first bounded by depth', async () => {
    const graph = seededGraph();
    const traversal = await graph.traverse('kn_blog_pipeline_playbook', 2);
    expect(traversal.rootId).toBe('kn_blog_pipeline_playbook');
    expect(traversal.visited.length).toBeGreaterThan(0);
    expect(traversal.visited.every((v) => v.depth <= 2)).toBe(true);
  });

  it('finds the shortest path and returns empty for disconnected pairs', async () => {
    const graph = seededGraph();
    const path = await graph.shortestPath('kn_blog_seed_goal', 'kn_capability_research');
    expect(path.length).toBeGreaterThan(1);
    expect(await graph.shortestPath('kn_mobile_release_notes', 'kn_sap_field_glossary')).toEqual(
      [],
    );
  });
});
