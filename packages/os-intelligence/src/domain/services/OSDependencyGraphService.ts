// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Dependency Graph
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Builds the OS dependency graph from the catalog matrices:
//   - the PACKAGE build graph (real workspace package.json edges) —
//     the "no circular dependencies" gate (must be acyclic);
//   - the CONSULTATION matrix (who consults whom through ports) —
//     the integration matrix; cycles here are expected in an
//     integrated OS and are reported as informational.
// Cycle detection is an iterative DFS with a recursion stack.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access uses developer-provided literal keys against the
   closed engine-id union and catalog matrices — never attacker-controlled
   property names. */

import type { OSDependencyEdge, OSDependencyGraph, OSEngineId } from '../../types/os-types.js';
import { OS_ENGINE_IDS } from '../../types/os-types.js';
import {
  OS_CONSUMPTION_MATRIX,
  OS_CONSUMPTION_REASONS,
  OS_PACKAGE_DEPENDENCIES,
} from '../../catalog/os-catalog.js';

export class OSDependencyGraphService {
  /** Build the full OS dependency graph (pure — no engine consultation). */
  buildGraph(): OSDependencyGraph {
    const packageEdges = this.edges(OS_PACKAGE_DEPENDENCIES, 'package');
    const consultationEdges = this.edges(OS_CONSUMPTION_MATRIX, 'consultation');
    const packageCycles = this.findCycles(OS_PACKAGE_DEPENDENCIES);
    const consultationCycles = this.findCycles(OS_CONSUMPTION_MATRIX);
    return {
      nodes: [...OS_ENGINE_IDS],
      packageEdges,
      consultationEdges,
      packageCycles,
      consultationCycles,
      acyclic: packageCycles.length === 0,
      matrix: Object.fromEntries(
        OS_ENGINE_IDS.map((engine) => [engine, [...OS_CONSUMPTION_MATRIX[engine]]]),
      ) as Record<OSEngineId, OSEngineId[]>,
    };
  }

  private edges(
    matrix: Record<string, readonly OSEngineId[]>,
    kind: 'package' | 'consultation',
  ): OSDependencyEdge[] {
    const edges: OSDependencyEdge[] = [];
    const verifiedAt = new Date().toISOString();
    for (const [from, targets] of Object.entries(matrix)) {
      for (const to of targets) {
        const reason =
          kind === 'consultation'
            ? (OS_CONSUMPTION_REASONS[`${from}→${to}`] ?? 'integration edge')
            : 'package dependency (workspace package.json)';
        edges.push({ from: from as OSEngineId, to, reason, kind, valid: true, verifiedAt });
      }
    }
    return edges;
  }

  /**
   * Iterative DFS cycle detection. Returns every back-edge cycle found as
   * a node path (the first node of the cycle repeated at the end).
   */
  findCycles(matrix: Record<string, readonly OSEngineId[]>): OSEngineId[][] {
    const cycles: OSEngineId[][] = [];
    const visited = new Set<string>();
    const stack: string[] = [];
    const stackSet = new Set<string>();

    const dfs = (node: string): void => {
      if (stackSet.has(node)) {
        // Back edge: node is already on the recursion stack → cycle found.
        const start = stack.indexOf(node);
        const cycle = stack.slice(start).concat(node);
        cycles.push(cycle.map((id) => id as OSEngineId));
        return;
      }
      if (visited.has(node)) return;
      visited.add(node);
      stackSet.add(node);
      stack.push(node);
      for (const next of matrix[node] ?? []) {
        dfs(next);
      }
      stack.pop();
      stackSet.delete(node);
    };

    for (const node of Object.keys(matrix)) {
      if (!visited.has(node)) dfs(node);
    }
    return cycles;
  }
}
