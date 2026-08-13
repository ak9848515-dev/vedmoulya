// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Graph Validator Service
// EI-005 — Enterprise Execution Orchestrator
// Validates: graph structure, nodes, edges, budgets, dependencies,
// context, capabilities, and cycle-freedom (DAG). Returns a full
// validation report — never executes anything.
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionGraph,
  ExecutionGraphValidation,
  ExecutionGraphValidationCheck,
} from '../../types/orchestrator-types.js';

export class ExecutionGraphValidatorService {
  validate(graph: ExecutionGraph): ExecutionGraphValidation {
    const checks: ExecutionGraphValidationCheck[] = [];

    checks.push(this.checkGraphIdentity(graph));
    checks.push(this.checkNodesPresent(graph));
    checks.push(this.checkEdgesReferenceNodes(graph));
    checks.push(this.checkNoCycles(graph));
    checks.push(this.checkDependenciesResolvable(graph));
    checks.push(this.checkBudgetsFinite(graph));
    checks.push(this.checkCapabilitiesPresent(graph));
    checks.push(this.checkStagesComplete(graph));
    checks.push(this.checkCriticalPath(graph));

    const passed = checks.every((c) => c.passed);
    const failedCount = checks.filter((c) => !c.passed).length;
    return {
      passed,
      checks,
      summary: passed
        ? 'Execution graph is valid: DAG, budgets, dependencies, capabilities, and stages all pass.'
        : `Execution graph has ${String(failedCount)} validation issue(s).`,
    };
  }

  /** True when a graph contains no directed cycles (DFS with 3-coloring). */
  isDag(graph: ExecutionGraph): boolean {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const n of graph.nodes) adj.set(n.nodeId, []);
    for (const e of graph.edges) {
      adj.get(e.from)?.push(e.to);
    }
    const visit = (nodeId: string): boolean => {
      const c = color.get(nodeId) ?? WHITE;
      if (c === GRAY) return false;
      if (c === BLACK) return true;
      color.set(nodeId, GRAY);
      for (const next of adj.get(nodeId) ?? []) {
        if (!visit(next)) return false;
      }
      color.set(nodeId, BLACK);
      return true;
    };
    for (const n of graph.nodes) {
      if (!visit(n.nodeId)) return false;
    }
    return true;
  }

  /** Find the first cycle as a node chain (empty when acyclic). */
  findCycle(graph: ExecutionGraph): string[] {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    const stack: string[] = [];
    const adj = new Map<string, string[]>();
    for (const n of graph.nodes) adj.set(n.nodeId, []);
    for (const e of graph.edges) {
      adj.get(e.from)?.push(e.to);
    }
    const visit = (nodeId: string): string[] => {
      const c = color.get(nodeId) ?? WHITE;
      if (c === BLACK) return [];
      if (c === GRAY) {
        const idx = stack.indexOf(nodeId);
        return stack.slice(idx);
      }
      color.set(nodeId, GRAY);
      stack.push(nodeId);
      for (const next of adj.get(nodeId) ?? []) {
        const cycle = visit(next);
        if (cycle.length > 0) return cycle;
      }
      stack.pop();
      color.set(nodeId, BLACK);
      return [];
    };
    for (const n of graph.nodes) {
      const cycle = visit(n.nodeId);
      if (cycle.length > 0) return cycle;
    }
    return [];
  }

  private checkGraphIdentity(graph: ExecutionGraph): ExecutionGraphValidationCheck {
    const ok = Boolean(graph.graphId && graph.strategyId && graph.goalId);
    return {
      check: 'graph-identity',
      passed: ok,
      detail: ok
        ? `Graph ${graph.graphId} for strategy ${graph.strategyId}.`
        : 'Graph is missing graphId, strategyId, or goalId.',
    };
  }

  private checkNodesPresent(graph: ExecutionGraph): ExecutionGraphValidationCheck {
    const ok = graph.nodes.length > 0;
    return {
      check: 'nodes-present',
      passed: ok,
      detail: ok ? `${String(graph.nodes.length)} node(s) defined.` : 'Graph has no nodes.',
    };
  }

  private checkEdgesReferenceNodes(graph: ExecutionGraph): ExecutionGraphValidationCheck {
    const ids = new Set(graph.nodes.map((n) => n.nodeId));
    const bad = graph.edges.filter((e) => !ids.has(e.from) || !ids.has(e.to));
    return {
      check: 'edges-reference-nodes',
      passed: bad.length === 0,
      detail:
        bad.length === 0
          ? 'All edges reference existing nodes.'
          : `${String(bad.length)} edge(s) reference unknown nodes.`,
    };
  }

  private checkNoCycles(graph: ExecutionGraph): ExecutionGraphValidationCheck {
    const cycle = this.findCycle(graph);
    return {
      check: 'acyclic',
      passed: cycle.length === 0,
      detail:
        cycle.length === 0
          ? 'Graph is a DAG (no cycles).'
          : `Cycle detected: ${cycle.join(' → ')}.`,
    };
  }

  private checkDependenciesResolvable(graph: ExecutionGraph): ExecutionGraphValidationCheck {
    const ids = new Set(graph.nodes.map((n) => n.nodeId));
    const missing = graph.nodes.flatMap((n) =>
      n.dependencies.filter((d) => !ids.has(d)).map((d) => `${n.nodeId}→${d}`),
    );
    return {
      check: 'dependencies-resolvable',
      passed: missing.length === 0,
      detail:
        missing.length === 0
          ? 'All node dependencies resolve to existing nodes.'
          : `Unresolvable dependencies: ${missing.join(', ')}.`,
    };
  }

  private checkBudgetsFinite(graph: ExecutionGraph): ExecutionGraphValidationCheck {
    const bad = graph.nodes.filter(
      (n) =>
        !Number.isFinite(n.budget.expectedTokens) ||
        !Number.isFinite(n.budget.maxCostUsd) ||
        !Number.isFinite(n.timeoutMs) ||
        n.timeoutMs <= 0,
    );
    return {
      check: 'budgets-finite',
      passed: bad.length === 0,
      detail:
        bad.length === 0
          ? 'All node budgets and timeouts are finite and positive.'
          : `${String(bad.length)} node(s) have invalid budgets or timeouts.`,
    };
  }

  private checkCapabilitiesPresent(graph: ExecutionGraph): ExecutionGraphValidationCheck {
    const bad = graph.nodes.filter((n) => n.capability.length === 0);
    return {
      check: 'capabilities-present',
      passed: bad.length === 0,
      detail:
        bad.length === 0
          ? 'Every node declares a capability.'
          : `${String(bad.length)} node(s) are missing a capability.`,
    };
  }

  private checkStagesComplete(graph: ExecutionGraph): ExecutionGraphValidationCheck {
    const nodeIds = new Set(graph.nodes.map((n) => n.nodeId));
    const staged = new Set(graph.stages.flatMap((s) => s.nodeIds));
    const missing = [...nodeIds].filter((id) => !staged.has(id));
    return {
      check: 'stages-cover-nodes',
      passed: missing.length === 0,
      detail:
        missing.length === 0
          ? 'Every node is assigned to a stage.'
          : `Nodes not in any stage: ${missing.join(', ')}.`,
    };
  }

  private checkCriticalPath(graph: ExecutionGraph): ExecutionGraphValidationCheck {
    const ids = new Set(graph.nodes.map((n) => n.nodeId));
    const bad = graph.criticalPath.filter((id) => !ids.has(id));
    return {
      check: 'critical-path-resolvable',
      passed: bad.length === 0 && graph.criticalPath.length > 0,
      detail:
        bad.length === 0 && graph.criticalPath.length > 0
          ? `Critical path resolves (${String(graph.criticalPath.length)} node(s)).`
          : 'Critical path is empty or references unknown nodes.',
    };
  }
}
