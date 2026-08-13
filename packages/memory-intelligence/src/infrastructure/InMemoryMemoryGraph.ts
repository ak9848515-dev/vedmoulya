// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Enterprise Memory Graph
// EI-010 — Enterprise Memory Intelligence Platform
// Implements the abstract MemoryGraph interface by traversing the
// relationship edges persisted by any MemoryRepository. Hermetic
// and deterministic — the default for tests and dev.
// ──────────────────────────────────────────────────────────────────

import type { MemoryGraph } from '../domain/graph/MemoryGraph.js';
import type { MemoryRepository } from '../domain/repository/MemoryRepository.js';
import type { MemoryGraphTraversal, MemoryItem } from '../types/memory-types.js';

const DEFAULT_MAX_DEPTH = 3;

export class InMemoryMemoryGraph implements MemoryGraph {
  constructor(private readonly repository: MemoryRepository) {}

  async getNeighbors(memoryId: string): Promise<MemoryItem[]> {
    const edges = await this.repository.listRelationshipsForItem(memoryId);
    const neighborIds = edges
      .map((edge) => (edge.sourceId === memoryId ? edge.targetId : edge.sourceId))
      .filter((id) => id !== memoryId);
    const items: MemoryItem[] = [];
    for (const id of neighborIds) {
      const item = await this.repository.findItemById(id);
      if (item) items.push(item);
    }
    return items;
  }

  async traverse(memoryId: string, maxDepth = DEFAULT_MAX_DEPTH): Promise<MemoryGraphTraversal> {
    const root = await this.repository.findItemById(memoryId);
    const visited: MemoryGraphTraversal['visited'] = [];
    if (!root) return { rootId: memoryId, depth: 0, visited };

    const seen = new Set<string>([memoryId]);
    const queue: Array<{ id: string; depth: number }> = [{ id: memoryId, depth: 0 }];

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

      if (current.id !== memoryId) {
        const item = await this.repository.findItemById(current.id);
        if (item) {
          visited.push({
            memoryId: item.memoryId,
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
      rootId: memoryId,
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
