// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Memory Graph
// EI-010 — Enterprise Memory Intelligence Platform
// The abstract graph interface — the seam behind which a dedicated
// graph store (Neo4j, PostgreSQL + ltree, …) can be swapped in later.
// Today both implementations (InMemoryMemoryGraph and
// PostgresMemoryGraph) traverse the relationship edges persisted by
// the MemoryRepository, so the platform is migration-ready without
// coupling to any graph database.
//
// Relationship traversal is bounded by `maxDepth` so worst-case work is
// O(fan-out^maxDepth) — acceptable for the platform catalog scale.
// ──────────────────────────────────────────────────────────────────

import type { MemoryItem } from '../../types/memory-types.js';
import type { MemoryGraphTraversal } from '../../types/memory-types.js';

export interface MemoryGraph {
  /** All memories directly connected to `memoryId` (either direction). */
  getNeighbors(memoryId: string): Promise<MemoryItem[]>;

  /** Breadth-first traversal from `memoryId` up to `maxDepth` hops. */
  traverse(memoryId: string, maxDepth?: number): Promise<MemoryGraphTraversal>;

  /** Shortest path (BFS) between two memories; empty array when unreachable. */
  shortestPath(fromId: string, toId: string): Promise<string[]>;
}
