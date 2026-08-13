// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Memory Repository + Graph tests
// EI-010 — Enterprise Memory Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryMemoryRepository } from '../InMemoryMemoryRepository.js';
import { InMemoryMemoryGraph } from '../InMemoryMemoryGraph.js';
import {
  createCatalogMemoryItems,
  createCatalogMemoryRelationships,
} from '../../catalog/memory-catalog.js';

describe('InMemoryMemoryRepository', () => {
  let repo: InMemoryMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryMemoryRepository({
      items: createCatalogMemoryItems(),
      relationships: createCatalogMemoryRelationships(),
    });
  });

  it('saves and finds items', async () => {
    const items = createCatalogMemoryItems();
    const first = items[0] as NonNullable<(typeof items)[0]>;
    expect((await repo.findItemById(first.memoryId))?.memoryId).toBe(first.memoryId);
  });

  it('lists items with pagination and filters', async () => {
    const result = await repo.listItems({ type: 'provider' }, { page: 1, limit: 2 });
    expect(result.total).toBeGreaterThan(0);
    expect(result.data.every((i) => i.type === 'provider')).toBe(true);
    expect(result.data.length).toBeLessThanOrEqual(2);

    const goalFiltered = await repo.listItems(
      { relatedGoal: 'goal_blog_seed' },
      { page: 1, limit: 50 },
    );
    expect(goalFiltered.total).toBeGreaterThan(0);

    const important = await repo.listItems({ minImportance: 0.9 }, { page: 1, limit: 50 });
    expect(important.data.every((i) => i.importance.score >= 0.9)).toBe(true);
  });

  it('applies every filter branch', async () => {
    const full = await repo.listItems(
      {
        type: 'provider',
        sourceType: 'execution',
        lifecycleStatus: 'active',
        compressionState: 'summarized',
        retentionPolicy: 'long_term',
        owner: 'platform',
        tag: 'openai',
        relatedTask: 'task_blog_1',
        relatedCapability: 'reasoning',
        relatedProvider: 'openai',
        relatedProject: 'project_x',
        relatedUser: 'user_x',
        relatedContext: 'ctx_x',
        minImportance: 0.5,
        minConfidence: 0.5,
      },
      { page: 1, limit: 50 },
    );
    // Each filter must not crash; results only include matching rows.
    expect(full.data.every((i) => i.type === 'provider' && i.owner === 'platform')).toBe(true);

    const impossible = await repo.listItems(
      { relatedTask: 'task_does_not_exist' },
      { page: 1, limit: 50 },
    );
    expect(impossible.total).toBe(0);
  });

  it('lists by type and counts', async () => {
    const provider = await repo.listItemsByType('provider');
    expect(provider.length).toBeGreaterThan(0);
    expect(await repo.countItems()).toBe(createCatalogMemoryItems().length);
  });

  it('deletes items and scrubs their edges', async () => {
    const items = createCatalogMemoryItems();
    const first = items[0] as NonNullable<(typeof items)[0]>;
    const before = await repo.listRelationshipsForItem(first.memoryId);
    await repo.deleteItem(first.memoryId);
    expect(await repo.findItemById(first.memoryId)).toBeNull();
    expect((await repo.listRelationshipsForItem(first.memoryId)).length).toBeLessThan(
      before.length,
    );
  });

  it('manages relationships', async () => {
    const rels = await repo.listRelationships();
    expect(rels.length).toBeGreaterThan(0);
    expect((await repo.listRelationships('recalls')).length).toBeGreaterThan(0);
    expect(await repo.countRelationships()).toBe(createCatalogMemoryRelationships().length);
    const first = rels[0] as NonNullable<(typeof rels)[0]>;
    expect((await repo.findRelationshipById(first.relationshipId))?.relationshipId).toBe(
      first.relationshipId,
    );
    await repo.deleteRelationship(first.relationshipId);
    expect(await repo.findRelationshipById(first.relationshipId)).toBeNull();
  });
});

describe('InMemoryMemoryGraph', () => {
  let repo: InMemoryMemoryRepository;
  let graph: InMemoryMemoryGraph;

  beforeEach(() => {
    repo = new InMemoryMemoryRepository({
      items: createCatalogMemoryItems(),
      relationships: createCatalogMemoryRelationships(),
    });
    graph = new InMemoryMemoryGraph(repo);
  });

  it('finds neighbors of a memory', async () => {
    const neighbors = await graph.getNeighbors('mem_openai_reliability');
    expect(neighbors.length).toBeGreaterThan(0);
  });

  it('traverses with bounded depth', async () => {
    const traversal = await graph.traverse('mem_blog_goal_success_pattern', 2);
    expect(traversal.rootId).toBe('mem_blog_goal_success_pattern');
    expect(traversal.visited.length).toBeGreaterThan(0);
    expect(traversal.visited.every((v) => v.depth <= 2)).toBe(true);
  });

  it('returns empty traversal for unknown roots', async () => {
    const traversal = await graph.traverse('mem_ghost');
    expect(traversal.visited.length).toBe(0);
  });

  it('finds shortest paths', async () => {
    const path = await graph.shortestPath(
      'mem_blog_goal_success_pattern',
      'mem_blog_pipeline_playbook',
    );
    expect(path.length).toBeGreaterThan(1);
    expect(
      await graph.shortestPath('mem_blog_goal_success_pattern', 'mem_blog_goal_success_pattern'),
    ).toEqual(['mem_blog_goal_success_pattern']);
    expect((await graph.shortestPath('mem_ghost', 'mem_blog_pipeline_playbook')).length).toBe(0);
  });
});
