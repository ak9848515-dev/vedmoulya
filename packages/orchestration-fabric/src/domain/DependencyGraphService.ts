// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Dependency Graph Service
// SPRINT-093 — Intelligent Request Queuing + Concurrency Control
//
// Builds, validates, and queries dependency graphs between work items.
// Supports:
// - Sequential chains: A → B → C
// - Fan-in/merge: A, B, C → D
// - Fan-out/split: D → E, F
// - Cycle detection
// - Critical path computation
// - Parallel group identification
// - Topological ordering
// ──────────────────────────────────────────────────────────────────

import type { WorkItem } from '../types/work-item.js';
import type {
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  GraphValidationResult,
  DependencyGraphInput,
  ReadyWorkSnapshot,
} from '../types/dependency-graph.js';

// ── Graph Builder ─────────────────────────────────────────────────────────

export class DependencyGraphService {
  private counter = 0;

  /**
   * Build a dependency graph from a set of work items.
   * The work items' `dependencies` arrays define the edges.
   */
  buildGraph(input: DependencyGraphInput): DependencyGraph {
    const graphId = `depgraph_${++this.counter}_${Date.now()}`;
    const nodes = new Map<string, DependencyNode>();
    const edges: DependencyEdge[] = [];

    // Create nodes for ALL work items (including those without dependencies)
    // so that dependency edges can be properly tracked
    for (const item of input.workItems) {
      if (!nodes.has(item.id)) {
        nodes.set(item.id, {
          workItemId: item.id,
          status: item.status,
          upstream: [],
          downstream: [],
          depth: 0,
          onCriticalPath: false,
        });
      }
    }

    // Create edges from dependencies
    for (const item of input.workItems) {
      for (const depId of item.dependencies) {
        // Add dependency node if not already present
        if (!nodes.has(depId)) {
          nodes.set(depId, {
            workItemId: depId,
            status: 'pending',
            upstream: [],
            downstream: [],
            depth: 0,
            onCriticalPath: false,
          });
        }
        edges.push({
          from: depId,
          to: item.id,
          type: 'dependency',
        });
        const upstreamNode = nodes.get(depId);
        const downstreamNode = nodes.get(item.id);
        if (upstreamNode && downstreamNode) {
          upstreamNode.downstream.push(item.id);
          downstreamNode.upstream.push(depId);
        }
      }
    }

    // Add additional edges
    if (input.additionalEdges) {
      for (const edge of input.additionalEdges) {
        if (nodes.has(edge.from) && nodes.has(edge.to)) {
          edges.push(edge);
          const upstreamNode = nodes.get(edge.from);
          const downstreamNode = nodes.get(edge.to);
          if (upstreamNode && downstreamNode) {
            upstreamNode.downstream.push(edge.to);
            downstreamNode.upstream.push(edge.from);
          }
        }
      }
    }

    // Validate
    const validation = this.validateGraph(nodes, edges);

    // Compute depths (BFS from roots)
    this.computeDepths(nodes, edges);

    // Compute critical path
    const criticalPath = this.computeCriticalPath(nodes);

    // Mark critical path nodes
    for (const nodeId of criticalPath) {
      const node = nodes.get(nodeId);
      if (node) node.onCriticalPath = true;
    }

    // Compute execution order (topological sort)
    const executionOrder = this.topologicalSort(nodes, edges);

    // Identify root and leaf nodes
    const rootNodes = Array.from(nodes.values())
      .filter((n) => n.upstream.length === 0)
      .map((n) => n.workItemId);

    const leafNodes = Array.from(nodes.values())
      .filter((n) => n.downstream.length === 0)
      .map((n) => n.workItemId);

    // Compute max parallelism (maximum number of nodes with depth = d for any d)
    const depthGroups = new Map<number, string[]>();
    for (const node of nodes.values()) {
      const group = depthGroups.get(node.depth) ?? [];
      group.push(node.workItemId);
      depthGroups.set(node.depth, group);
    }
    const maxParallelism = Math.max(1, ...Array.from(depthGroups.values()).map((g) => g.length));

    const now = new Date().toISOString();
    return {
      graphId,
      nodes,
      edges,
      isAcyclic: validation.valid,
      cyclePath: validation.valid ? [] : this.findCycle(nodes, edges),
      validation,
      rootNodes,
      leafNodes,
      criticalPath,
      maxParallelism,
      executionOrder,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get work items that are ready to execute (all dependencies satisfied).
   */
  getReadyWorkItems(
    graph: DependencyGraph,
    workItemStore: Map<string, WorkItem>,
  ): ReadyWorkSnapshot {
    const readyItems: WorkItem[] = [];
    const waitingItems: Array<{ workItemId: string; waitingFor: string[] }> = [];

    for (const node of graph.nodes.values()) {
      const workItem = workItemStore.get(node.workItemId);
      if (!workItem) continue;

      // Skip completed/failed/cancelled items
      if (['completed', 'failed', 'cancelled', 'expired'].includes(workItem.status)) {
        continue;
      }

      // Check if all upstream dependencies are completed
      const pendingUpstream = node.upstream.filter((depId) => {
        const depItem = workItemStore.get(depId);
        return depItem && depItem.status !== 'completed';
      });

      if (pendingUpstream.length === 0) {
        readyItems.push(workItem);
      } else {
        waitingItems.push({
          workItemId: node.workItemId,
          waitingFor: pendingUpstream,
        });
      }
    }

    return {
      readyItems,
      waitingItems,
      maxParallelism: graph.maxParallelism,
      snapshotAt: new Date().toISOString(),
    };
  }

  /**
   * Update the status of a work item in the graph and return newly ready items.
   */
  onWorkItemCompleted(
    graph: DependencyGraph,
    completedWorkItemId: string,
    workItemStore: Map<string, WorkItem>,
  ): WorkItem[] {
    const node = graph.nodes.get(completedWorkItemId);
    if (!node) return [];

    // Update node status
    const workItem = workItemStore.get(completedWorkItemId);
    if (workItem) {
      node.status = workItem.status;
    }

    // Check downstream nodes for readiness
    const newlyReady: WorkItem[] = [];
    for (const downstreamId of node.downstream) {
      const downstreamNode = graph.nodes.get(downstreamId);
      if (!downstreamNode) continue;

      const downstreamItem = workItemStore.get(downstreamId);
      if (!downstreamItem) continue;

      // Skip if already completed/failed/cancelled
      if (['completed', 'failed', 'cancelled', 'expired'].includes(downstreamItem.status)) {
        continue;
      }

      // Check if all upstream dependencies are now completed
      const allUpstreamCompleted = downstreamNode.upstream.every((depId) => {
        const depItem = workItemStore.get(depId);
        return depItem && depItem.status === 'completed';
      });

      if (allUpstreamCompleted) {
        newlyReady.push(downstreamItem);
      }
    }

    return newlyReady;
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  private validateGraph(
    nodes: Map<string, DependencyNode>,
    edges: DependencyEdge[],
  ): GraphValidationResult {
    const checks: GraphValidationResult['checks'] = [];

    // Check 1: All dependency references exist
    const allNodeIds = new Set(nodes.keys());
    let allRefsValid = true;
    for (const edge of edges) {
      if (!allNodeIds.has(edge.from) || !allNodeIds.has(edge.to)) {
        allRefsValid = false;
        break;
      }
    }
    checks.push({
      name: 'dependency_references',
      passed: allRefsValid,
      detail: allRefsValid
        ? 'All dependency references resolve to existing work items'
        : 'Some dependency references point to non-existent work items',
    });

    // Check 2: No self-loops
    const hasSelfLoop = edges.some((e) => e.from === e.to);
    checks.push({
      name: 'no_self_loops',
      passed: !hasSelfLoop,
      detail: hasSelfLoop ? 'Graph contains self-loop edges' : 'No self-loops detected',
    });

    // Check 3: Acyclicity (DFS-based cycle detection)
    const cycle = this.findCycle(nodes, edges);
    const isAcyclic = cycle.length === 0;
    checks.push({
      name: 'acyclicity',
      passed: isAcyclic,
      detail: isAcyclic ? 'Graph is acyclic (DAG)' : `Cycle detected: ${cycle.join(' → ')}`,
    });

    const valid = checks.every((c) => c.passed);
    return {
      valid,
      checks,
      summary: valid
        ? `Graph is valid: ${nodes.size} nodes, ${edges.length} edges, acyclic`
        : `Graph is invalid: ${checks
            .filter((c) => !c.passed)
            .map((c) => c.name)
            .join(', ')}`,
    };
  }

  private findCycle(nodes: Map<string, DependencyNode>, edges: DependencyEdge[]): string[] {
    const adjacency = new Map<string, string[]>();
    for (const node of nodes.keys()) {
      adjacency.set(node, []);
    }
    for (const edge of edges) {
      const list = adjacency.get(edge.from);
      if (list) list.push(edge.to);
    }

    const color = new Map<string, number>();
    const parent = new Map<string, string>();

    for (const node of nodes.keys()) {
      color.set(node, 0);
    }

    for (const node of nodes.keys()) {
      if (color.get(node) !== 0) continue;
      const cycle = this.dfsCycle(node, adjacency, color, parent);
      if (cycle.length > 0) return cycle;
    }

    return [];
  }

  private dfsCycle(
    u: string,
    adjacency: Map<string, string[]>,
    color: Map<string, number>,
    parent: Map<string, string>,
  ): string[] {
    color.set(u, 1); // GRAY
    const neighbors = adjacency.get(u) ?? [];
    for (const v of neighbors) {
      if (color.get(v) === 1) {
        // Found cycle — reconstruct path
        const cycle: string[] = [v, u];
        let current = u;
        while (current !== v) {
          current = parent.get(current) ?? v;
          if (current !== v) cycle.push(current);
        }
        return cycle.reverse();
      }
      if (color.get(v) === 0) {
        parent.set(v, u);
        const cycle = this.dfsCycle(v, adjacency, color, parent);
        if (cycle.length > 0) return cycle;
      }
    }
    color.set(u, 2); // BLACK
    return [];
  }

  private computeDepths(nodes: Map<string, DependencyNode>, _edges: DependencyEdge[]): void {
    // BFS from root nodes
    const roots = Array.from(nodes.values()).filter((n) => n.upstream.length === 0);
    const queue: Array<{ id: string; depth: number }> = roots.map((r) => ({
      id: r.workItemId,
      depth: 0,
    }));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const entry = queue.shift();
      if (entry === undefined) break;
      const { id, depth } = entry;
      if (visited.has(id)) continue;
      visited.add(id);

      const node = nodes.get(id);
      if (node) {
        node.depth = Math.max(node.depth, depth);
      }

      for (const downstreamId of node?.downstream ?? []) {
        if (!visited.has(downstreamId)) {
          queue.push({ id: downstreamId, depth: depth + 1 });
        }
      }
    }
  }

  private computeCriticalPath(nodes: Map<string, DependencyNode>): string[] {
    // Find the longest path from any root to any leaf
    const roots = Array.from(nodes.values()).filter((n) => n.upstream.length === 0);
    let longestPath: string[] = [];

    for (const root of roots) {
      const path = this.dfsLongestPath(root.workItemId, nodes, new Map());
      if (path.length > longestPath.length) {
        longestPath = path;
      }
    }

    return longestPath;
  }

  private dfsLongestPath(
    nodeId: string,
    nodes: Map<string, DependencyNode>,
    memo: Map<string, string[]>,
  ): string[] {
    if (memo.has(nodeId)) return memo.get(nodeId) ?? [];

    const node = nodes.get(nodeId);
    if (!node || node.downstream.length === 0) {
      memo.set(nodeId, [nodeId]);
      return [nodeId];
    }

    let longest: string[] = [];
    for (const downstreamId of node.downstream) {
      const path = this.dfsLongestPath(downstreamId, nodes, memo);
      if (path.length > longest.length) {
        longest = path;
      }
    }

    const result = [nodeId, ...longest];
    memo.set(nodeId, result);
    return result;
  }

  private topologicalSort(nodes: Map<string, DependencyNode>, edges: DependencyEdge[]): string[] {
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes.keys()) {
      adjacency.set(node, []);
      inDegree.set(node, 0);
    }
    for (const edge of edges) {
      adjacency.get(edge.from)?.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift();
      if (node === undefined) break;
      sorted.push(node);
      for (const neighbor of adjacency.get(node) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    return sorted;
  }
}
