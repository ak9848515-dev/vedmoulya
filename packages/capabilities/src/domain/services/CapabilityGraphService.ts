// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Domain Service: Dependency Graph
// Builds and validates the capability dependency DAG, computes
// transitive dependencies and cycle detection.
// EI-001 — Enterprise Capability Registry & Marketplace
// ──────────────────────────────────────────────────────────────────

import type { Capability } from '../entities/Capability.js';
import type { CapabilityId } from '../value-objects/CapabilityId.js';

export interface CapabilityGraphNode {
  id: CapabilityId;
  name: string;
  /** Direct dependency ids. */
  dependencies: CapabilityId[];
  /** Depth in the DAG (longest path from a root). */
  depth: number;
  /** Whether this node is on the critical path (max depth chain). */
  critical: boolean;
}

export interface CapabilityGraph {
  nodes: CapabilityGraphNode[];
  /** Capability ids that have no dependencies (roots). */
  roots: CapabilityId[];
  /** Any detected cycles (list of id sequences). */
  cycles: CapabilityId[][];
  /** Ids of capabilities whose dependencies reference missing capabilities. */
  dangling: CapabilityId[];
}

export interface CycleDetectionResult {
  hasCycle: boolean;
  cycles: CapabilityId[][];
}

export class CapabilityGraphService {
  /**
   * Build the dependency graph for a set of capabilities.
   * Validates: self-dependency (entity guards), missing deps (dangling),
   * and cycles (DFS). Computes depth + critical path.
   */
  buildGraph(capabilities: readonly Capability[]): CapabilityGraph {
    const byId = new Map<CapabilityId, Capability>();
    for (const cap of capabilities) {
      byId.set(cap.id, cap);
    }

    const dangling: CapabilityId[] = [];
    const nodes: CapabilityGraphNode[] = capabilities.map((cap) => ({
      id: cap.id,
      name: cap.name,
      dependencies: [...cap.dependencies],
      depth: 0,
      critical: false,
    }));

    // Depth = longest path from a root (dependencies first).
    const memo = new Map<CapabilityId, number>();
    const visit = (id: CapabilityId): number => {
      const cached = memo.get(id);
      if (cached !== undefined) return cached;
      const node = nodes.find((n) => n.id === id);
      if (!node) return 0;
      if (node.dependencies.length === 0) {
        memo.set(id, 0);
        return 0;
      }
      let max = 0;
      for (const dep of node.dependencies) {
        if (!byId.has(dep)) dangling.push(id);
        max = Math.max(max, visit(dep) + 1);
      }
      memo.set(id, max);
      return max;
    };

    for (const node of nodes) {
      node.depth = visit(node.id);
    }

    // Critical path = deepest chain (nodes at max depth, traced backwards).
    const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
    const criticalIds = new Set<CapabilityId>();
    for (const node of nodes) {
      if (node.depth === maxDepth && maxDepth > 0) {
        let cursor = node;
        criticalIds.add(cursor.id);
        while (cursor.dependencies.length > 0) {
          const next = cursor.dependencies
            .map((d) => nodes.find((n) => n.id === d))
            .filter((n): n is CapabilityGraphNode => n !== undefined)
            .sort((a, b) => b.depth - a.depth)[0];
          if (!next) break;
          criticalIds.add(next.id);
          cursor = next;
        }
      }
    }
    for (const node of nodes) {
      node.critical = criticalIds.has(node.id);
    }

    const roots = nodes.filter((n) => n.dependencies.length === 0).map((n) => n.id);
    const cycleResult = this.detectCycles(capabilities);
    return {
      nodes,
      roots,
      cycles: cycleResult.cycles,
      dangling: [...new Set(dangling)],
    };
  }

  /** Detect cycles via DFS with a visitation stack. */
  detectCycles(capabilities: readonly Capability[]): CycleDetectionResult {
    const byId = new Map<CapabilityId, Capability>();
    for (const cap of capabilities) {
      byId.set(cap.id, cap);
    }

    const cycles: CapabilityId[][] = [];
    const visited = new Set<CapabilityId>();
    const stack = new Set<CapabilityId>();
    const path: CapabilityId[] = [];

    const dfs = (id: CapabilityId): void => {
      if (stack.has(id)) {
        const start = path.indexOf(id);
        if (start !== -1) {
          cycles.push([...path.slice(start), id]);
        }
        return;
      }
      if (visited.has(id)) return;

      visited.add(id);
      stack.add(id);
      path.push(id);

      const cap = byId.get(id);
      if (cap) {
        for (const dep of cap.dependencies) {
          if (byId.has(dep)) dfs(dep);
        }
      }

      stack.delete(id);
      path.pop();
    };

    for (const cap of capabilities) {
      if (!visited.has(cap.id)) dfs(cap.id);
    }

    return { hasCycle: cycles.length > 0, cycles };
  }

  /** Resolve all transitive dependencies of a capability (excludes itself). */
  getTransitiveDependencies(capabilities: readonly Capability[], id: CapabilityId): CapabilityId[] {
    const byId = new Map<CapabilityId, Capability>();
    for (const cap of capabilities) {
      byId.set(cap.id, cap);
    }

    const result = new Set<CapabilityId>();
    const visit = (current: CapabilityId): void => {
      const cap = byId.get(current);
      if (!cap) return;
      for (const dep of cap.dependencies) {
        if (dep === id || result.has(dep)) continue;
        result.add(dep);
        visit(dep);
      }
    };
    visit(id);
    return [...result];
  }
}
