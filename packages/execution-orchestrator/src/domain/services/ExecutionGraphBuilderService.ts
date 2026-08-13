// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Graph Builder Service
// EI-005 — Enterprise Execution Orchestrator
// Converts a strategy-shaped ExecutionGraphInput into an ExecutionGraph:
// nodes, edges (sequential/parallel/conditional), stages, parallel
// groups, critical path, and recovery checkpoints. No AI execution.
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionEdge,
  ExecutionEdgeType,
  ExecutionGraph,
  ExecutionGraphInput,
  ExecutionNode,
  ExecutionStage,
} from '../../types/orchestrator-types.js';
import { generateGraphId, createGraphId } from '../value-objects/Identifiers.js';

const PRIORITY_SCORE: Record<ExecutionGraphInput['priority'], number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  background: 1,
};

export class ExecutionGraphBuilderService {
  /**
   * Build a complete execution graph from a strategy-derived input.
   * Steps are chained in declaration order: each step depends on its
   * predecessor (sequential flow) or is marked parallel (no edge).
   */
  build(input: ExecutionGraphInput): ExecutionGraph {
    const graphId = generateGraphId();
    const nodes = this.buildNodes(input);
    const edges = this.buildEdges(input, nodes);
    const stages = this.buildStages(nodes);
    const parallelGroups = this.buildParallelGroups(input, nodes);
    const criticalPath = this.computeCriticalPath(input, nodes);
    const checkpoints = this.insertCheckpoints(nodes);

    const graph: ExecutionGraph = {
      graphId,
      strategyId: input.strategyId,
      goalId: input.goalId,
      goal: input.goal,
      nodes,
      edges,
      stages,
      parallelGroups,
      criticalPath,
      validated: false,
      validation: {
        passed: false,
        checks: [],
        summary: 'Graph built — awaiting validation.',
      },
      checkpoints,
      createdAt: new Date().toISOString(),
      version: '1.0.0',
    };
    return graph;
  }

  private buildNodes(input: ExecutionGraphInput): ExecutionNode[] {
    const basePriority = PRIORITY_SCORE[input.priority];
    return input.steps.map((step, idx) => {
      const totalWeight = input.steps.reduce((s, x) => s + x.weight, 0) || 1;
      const weightRatio = step.weight / totalWeight;
      const node: ExecutionNode = {
        nodeId: `node_${step.stepId}`,
        capability: step.capability,
        providerCandidates: step.eligibleFamilies,
        contextReference: [],
        priority: Math.max(1, basePriority - idx),
        dependencies: [],
        retryPolicy: { maxRetries: input.maxRetries, retryDelayMs: input.retryDelayMs },
        timeoutMs: Math.round((input.maxLatencyMs / input.steps.length) * 1.2),
        budget: {
          expectedTokens: Math.round(input.expectedTokens * weightRatio),
          maxCostUsd: Number((input.maxCostUsd * weightRatio).toFixed(2)),
          expectedLatencyMs: Math.round((input.maxLatencyMs / input.steps.length) * 0.8),
        },
        metadata: { flowType: step.flowType, weight: step.weight },
        status: 'pending',
        label: step.label,
      };
      return node;
    });
  }

  private buildEdges(input: ExecutionGraphInput, nodes: ExecutionNode[]): ExecutionEdge[] {
    const edges: ExecutionEdge[] = [];
    const seqEdges: Array<{ from: number; to: number; type: ExecutionEdgeType }> = [];

    for (let i = 0; i < input.steps.length; i++) {
      const step = input.steps[i];
      if (!step) continue;
      if (step.flowType === 'sequential' && i > 0) {
        seqEdges.push({ from: i - 1, to: i, type: 'sequential' });
      } else if (step.flowType === 'conditional' && i > 0) {
        seqEdges.push({ from: i - 1, to: i, type: 'conditional' });
      } else if (step.flowType === 'optional' && i > 0) {
        seqEdges.push({ from: i - 1, to: i, type: 'conditional' });
      }
    }

    // Parallel steps are grouped; add a merge edge from the last parallel
    // node to the next sequential node after the group.
    let parallelOpen = false;
    let lastParallelIndex = -1;
    for (let i = 0; i < input.steps.length; i++) {
      const step = input.steps[i];
      if (!step) continue;
      if (step.flowType === 'parallel') {
        parallelOpen = true;
        lastParallelIndex = i;
      } else if (parallelOpen && step.flowType === 'sequential') {
        seqEdges.push({ from: lastParallelIndex, to: i, type: 'merge' });
        parallelOpen = false;
      }
    }

    for (const e of seqEdges) {
      edges.push({
        edgeId: `edge_${nodes[e.from]?.nodeId ?? String(e.from)}_${nodes[e.to]?.nodeId ?? String(e.to)}`,
        from: nodes[e.from]?.nodeId ?? '',
        to: nodes[e.to]?.nodeId ?? '',
        type: e.type,
        metadata: {},
      });
    }

    // Wire dependencies onto nodes for the scheduler + validator.
    for (const edge of edges) {
      const target = nodes.find((n) => n.nodeId === edge.to);
      if (target) target.dependencies.push(edge.from);
    }
    return edges;
  }

  private buildStages(nodes: ExecutionNode[]): ExecutionStage[] {
    // One stage per node keeps stages explicit and debuggable; stage id is
    // derived from the node label for readability.
    return nodes.map((node, idx) => ({
      stageId: `stage_${node.nodeId.replace('node_', '')}`,
      name: node.label,
      nodeIds: [node.nodeId],
      order: idx + 1,
      status: 'pending',
    }));
  }

  private buildParallelGroups(input: ExecutionGraphInput, nodes: ExecutionNode[]): string[][] {
    const groups: string[][] = [];
    let current: string[] = [];
    for (const step of input.steps) {
      if (step.flowType === 'parallel') {
        current.push(`node_${step.stepId}`);
      } else if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    }
    if (current.length > 0) groups.push(current);
    // (nodes param is part of the public shape; groups are derived from steps)
    void nodes;
    return groups;
  }

  /** Longest dependency chain (by node count) — simple LPT-style critical path. */
  computeCriticalPath(_input: ExecutionGraphInput, nodes: ExecutionNode[]): string[] {
    const depth = new Map<string, number>();
    const parent = new Map<string, string>();
    const visit = (nodeId: string): number => {
      const cached = depth.get(nodeId);
      if (cached !== undefined) return cached;
      const node = nodes.find((n) => n.nodeId === nodeId);
      if (!node) return 0;
      let best = 0;
      let bestParent = '';
      for (const dep of node.dependencies) {
        const d = visit(dep);
        if (d > best) {
          best = d;
          bestParent = dep;
        }
      }
      depth.set(nodeId, best + 1);
      if (bestParent) parent.set(nodeId, bestParent);
      return best + 1;
    };
    for (const node of nodes) visit(node.nodeId);
    let tail = '';
    let maxDepth = -1;
    for (const [nodeId, d] of depth) {
      if (d > maxDepth) {
        maxDepth = d;
        tail = nodeId;
      }
    }
    const path: string[] = [];
    let cur = tail;
    while (cur) {
      path.unshift(cur);
      cur = parent.get(cur) ?? '';
    }
    return path;
  }

  /** Insert a checkpoint after each sequential milestone node. */
  private insertCheckpoints(nodes: ExecutionNode[]): ExecutionGraph['checkpoints'] {
    const checkpoints = nodes.map((node, idx) => ({
      checkpointId: `ckpt_${node.nodeId.replace('node_', '')}`,
      nodeId: node.nodeId,
      completedNodeIds: nodes.slice(0, idx).map((n) => n.nodeId),
      createdAt: new Date().toISOString(),
      metadata: { stage: idx + 1 },
    }));
    return checkpoints;
  }

  static createGraphId(id: string): string {
    return createGraphId(id);
  }
}
