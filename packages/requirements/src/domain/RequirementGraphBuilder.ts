// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Requirement Graph Builder
// EPIC-009 — Phase 4. Builds the requirement dependency graph:
// dependencies, downstream impact, blockers, architecture-changing
// requirements and cycle detection. Requirements with UNKNOWN status
// that others depend on are blockers.
// ──────────────────────────────────────────────────────────────────

import type {
  Requirement,
  RequirementEdge,
  RequirementGraph,
  RequirementNode,
  RequirementSet,
} from '../types/requirement-types.js';
import type { RequirementConflict } from '../types/requirement-types.js';

export interface GraphBuildInput {
  sessionId: string;
  requirements: RequirementSet;
  conflicts?: RequirementConflict[];
}

/** Categories that change the architecture when altered. */
const ARCHITECTURE_CHANGING_CATEGORIES = new Set([
  'security',
  'deployment',
  'data',
  'integration',
  'ai',
]);

export class RequirementGraphBuilder {
  build(input: GraphBuildInput): RequirementGraph {
    const { requirements } = input;
    const nodes: RequirementNode[] = requirements.requirements.map((r) => ({
      id: r.id,
      description: r.description,
      category: r.category,
      priority: r.priority,
      status: r.status,
    }));

    const edges: RequirementEdge[] = [];
    const dependencies: Record<string, string[]> = {};
    const downstream: Record<string, string[]> = {};
    const idSet = new Set(requirements.requirements.map((r) => r.id));

    for (const r of requirements.requirements) {
      const deps = r.dependencies.filter((d) => idSet.has(d));
      dependencies[r.id] = deps;
      for (const dep of deps) {
        edges.push({ from: r.id, to: dep, kind: 'dependency' });
        downstream[dep] = [...(downstream[dep] ?? []), r.id];
      }
    }

    // Conflict edges (Phase 11 output feeds the graph).
    for (const conflict of input.conflicts ?? []) {
      edges.push({ from: conflict.reqAId, to: conflict.reqBId, kind: 'conflict' });
    }

    // Blockers: requirements that are UNKNOWN and are dependencies of others.
    const unknown = new Set(
      requirements.requirements.filter((r) => r.status === 'UNKNOWN').map((r) => r.id),
    );
    const blockers: Array<{ requirementId: string; blockedBy: string[] }> = [];
    for (const r of requirements.requirements) {
      const blocking = (dependencies[r.id] ?? []).filter((d) => unknown.has(d));
      if (blocking.length > 0) {
        blockers.push({ requirementId: r.id, blockedBy: blocking });
      }
    }

    const architectureChanging = requirements.requirements
      .filter((r) => ARCHITECTURE_CHANGING_CATEGORIES.has(r.category) || r.priority === 'CRITICAL')
      .map((r) => r.id);

    const cycles = detectCycles(requirements.requirements);

    const roots = requirements.requirements
      .filter((r) => (dependencies[r.id] ?? []).length === 0)
      .map((r) => r.id);
    const leaves = requirements.requirements
      .filter((r) => (downstream[r.id] ?? []).length === 0)
      .map((r) => r.id);

    return {
      sessionId: input.sessionId,
      nodes,
      edges,
      dependencies,
      downstream,
      blockers,
      architectureChanging,
      cycles,
      roots,
      leaves,
    };
  }
}

/** Detect dependency cycles via three-color DFS. */
function detectCycles(reqs: Requirement[]): Array<{ ids: string[] }> {
  const adj = new Map<string, string[]>();
  for (const r of reqs) {
    adj.set(r.id, r.dependencies.slice());
  }
  const color = new Map<string, 'white' | 'gray' | 'black'>();
  const stack: string[] = [];
  const cycles: Array<{ ids: string[] }> = [];
  for (const r of reqs) {
    if ((color.get(r.id) ?? 'white') === 'white') {
      visit(r.id);
    }
  }
  return cycles;

  function visit(node: string): void {
    color.set(node, 'gray');
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      const c = color.get(next) ?? 'white';
      if (c === 'gray') {
        const idx = stack.indexOf(next);
        if (idx >= 0) {
          cycles.push({ ids: [...stack.slice(idx), next] });
        }
      } else if (c === 'white') {
        visit(next);
      }
    }
    stack.pop();
    color.set(node, 'black');
  }
}
