// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Enterprise Knowledge Graph
// EI-009 — Enterprise Knowledge Intelligence Platform
// Implements the abstract KnowledgeGraph interface by traversing the
// relationship edges persisted by any KnowledgeRepository. Hermetic
// and deterministic — the default for tests and dev.
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeGraph } from '../domain/graph/KnowledgeGraph.js';
import type { KnowledgeRepository } from '../domain/repository/KnowledgeRepository.js';
import type { KnowledgeGraphTraversal, KnowledgeItem } from '../types/knowledge-types.js';

const DEFAULT_MAX_DEPTH = 3;

export class InMemoryKnowledgeGraph implements KnowledgeGraph {
  constructor(private readonly repository: KnowledgeRepository) {}

  async getNeighbors(knowledgeId: string): Promise<KnowledgeItem[]> {
    const edges = await this.repository.listRelationshipsForItem(knowledgeId);
    const neighborIds = edges
      .map((edge) => (edge.sourceId === knowledgeId ? edge.targetId : edge.sourceId))
      .filter((id) => id !== knowledgeId);
    const items: KnowledgeItem[] = [];
    for (const id of neighborIds) {
      const item = await this.repository.findItemById(id);
      if (item) items.push(item);
    }
    return items;
  }

  async traverse(
    knowledgeId: string,
    maxDepth = DEFAULT_MAX_DEPTH,
  ): Promise<KnowledgeGraphTraversal> {
    const root = await this.repository.findItemById(knowledgeId);
    const visited: KnowledgeGraphTraversal['visited'] = [];
    if (!root) return { rootId: knowledgeId, depth: 0, visited };

    const seen = new Set<string>([knowledgeId]);
    const queue: Array<{ id: string; depth: number }> = [{ id: knowledgeId, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift() as { id: string; depth: number };
      const edges = await this.repository.listRelationshipsForItem(current.id);
      const neighbors = edges
        .map((edge) => (edge.sourceId === current.id ? edge.targetId : edge.sourceId))
        .filter((id) => id !== current.id);

      for (const neighborId of neighbors) {
        if (seen.has(neighborId)) continue;
        seen.add(neighborId);
        if (current.depth + 1 <= maxDepth) {
          queue.push({ id: neighborId, depth: current.depth + 1 });
        }
      }

      if (current.id !== knowledgeId) {
        const item = await this.repository.findItemById(current.id);
        if (item) {
          visited.push({
            knowledgeId: item.knowledgeId,
            title: item.title,
            depth: current.depth,
            relationships: edges,
          });
        }
      }
    }

    // Sort by depth so the UI renders hops left → right.
    visited.sort((a, b) => a.depth - b.depth);
    return {
      rootId: knowledgeId,
      depth: Math.min(
        maxDepth,
        visited.reduce((max, v) => Math.max(max, v.depth), 0),
      ),
      visited,
    };
  }

  async shortestPath(fromId: string, toId: string): Promise<string[]> {
    if (fromId === toId) return [fromId];
    const queue: string[][] = [[fromId]];
    const seen = new Set<string>([fromId]);

    while (queue.length > 0) {
      const path = queue.shift() as string[];
      const last = path[path.length - 1];
      if (last === undefined) continue;
      const edges = await this.repository.listRelationshipsForItem(last);
      const neighbors = edges
        .map((edge) => (edge.sourceId === last ? edge.targetId : edge.sourceId))
        .filter((id) => id !== last);

      for (const neighbor of neighbors) {
        if (neighbor === toId) return [...path, neighbor];
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
    return [];
  }
}
