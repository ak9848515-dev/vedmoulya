// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Knowledge Graph
// EI-009 — Enterprise Knowledge Intelligence Platform
// The abstract graph interface — the seam behind which a dedicated
// graph store (Neo4j, PostgreSQL + ltree, …) can be swapped in later.
// Today both implementations (InMemoryKnowledgeGraph and
// PostgresKnowledgeGraph) traverse the relationship edges persisted by
// the KnowledgeRepository, so the platform is migration-ready without
// coupling to any graph database.
//
// Relationship traversal is bounded by `maxDepth` so worst-case work is
// O(fan-out^maxDepth) — acceptable for the platform catalog scale.
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeItem } from '../../types/knowledge-types.js';
import type { KnowledgeGraphTraversal } from '../../types/knowledge-types.js';

export interface KnowledgeGraph {
  /** All items directly connected to `knowledgeId` (either direction). */
  getNeighbors(knowledgeId: string): Promise<KnowledgeItem[]>;

  /** Breadth-first traversal from `knowledgeId` up to `maxDepth` hops. */
  traverse(knowledgeId: string, maxDepth?: number): Promise<KnowledgeGraphTraversal>;

  /** Shortest path (BFS) between two items; empty array when unreachable. */
  shortestPath(fromId: string, toId: string): Promise<string[]>;
}
