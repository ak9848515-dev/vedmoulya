// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain Service: KnowledgeGraphService
// ARC-003 — Domain operations for graph traversal, search, analysis
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeRepository } from '../repository/KnowledgeRepository.js';
import type { KnowledgeNode } from '../entities/KnowledgeNode.js';
import { KnowledgeEdge } from '../entities/KnowledgeEdge.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { KnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';
import type { GraphId } from '../value-objects/GraphId.js';
import { RelationshipType } from '../value-objects/RelationshipType.js';

// ── Result Types ──────────────────────────────────────────────────────────

export interface GraphOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TraversalResult {
  path: Array<{ node: KnowledgeNode; edge?: KnowledgeEdge }>;
  depth: number;
  totalCost: number;
}

export interface SearchResult {
  nodes: KnowledgeNode[];
  total: number;
  relevance: number; // 0.0 to 1.0
}

export interface ImpactResult {
  affectedNodes: KnowledgeNode[];
  affectedEdges: KnowledgeEdge[];
  impactLevel: 'low' | 'medium' | 'high';
  description: string;
}

export interface CycleDetectionResult {
  hasCycle: boolean;
  cycles: Array<{
    nodes: KnowledgeNodeId[];
    edges: string[];
  }>;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  categoryDistribution: Record<string, number>;
  relationshipDistribution: Record<string, number>;
  averageConnectivity: number;
  density: number;
}

/**
 * KnowledgeGraphService — domain service for graph operations.
 * Implements graph traversal, search, shortest path, impact analysis,
 * cycle detection, and statistical analysis.
 */
export class KnowledgeGraphService {
  private readonly repository: KnowledgeRepository;

  constructor(repository: KnowledgeRepository) {
    this.repository = repository;
  }

  // ── Node Operations ─────────────────────────────────────────────────────

  /** Create a new node (validated through the repository) */
  async createNode(node: KnowledgeNode): Promise<GraphOperationResult<KnowledgeNode>> {
    try {
      const exists = await this.repository.nodeExists(node.id);
      if (exists) {
        return { success: false, error: `Node already exists: ${node.id}` };
      }
      await this.repository.saveNode(node);
      return { success: true, data: node };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /** Update an existing node */
  async updateNode(node: KnowledgeNode): Promise<GraphOperationResult<KnowledgeNode>> {
    try {
      const exists = await this.repository.nodeExists(node.id);
      if (!exists) {
        return { success: false, error: `Node not found: ${node.id}` };
      }
      await this.repository.updateNode(node);
      return { success: true, data: node };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /** Delete a node and all its edges */
  async deleteNode(nodeId: KnowledgeNodeId): Promise<GraphOperationResult> {
    try {
      // Remove all edges connected to this node
      const edges = await this.repository.findEdgesForNode(nodeId);
      for (const edge of edges) {
        await this.repository.deleteEdge(edge.id);
      }
      await this.repository.deleteNode(nodeId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /** Merge two nodes into one (redirect edges from source to target) */
  async mergeNodes(
    sourceId: KnowledgeNodeId,
    targetId: KnowledgeNodeId,
    mergedNode: KnowledgeNode,
  ): Promise<GraphOperationResult<KnowledgeNode>> {
    try {
      const [sourceEdges, targetEdges] = await Promise.all([
        this.repository.findEdgesForNode(sourceId),
        this.repository.findEdgesForNode(targetId),
      ]);

      // Delete all edges connected to source
      for (const edge of sourceEdges) {
        await this.repository.deleteEdge(edge.id);
      }

      // Recreate edges from source to point to target (if duplicates don't exist)
      for (const edge of sourceEdges) {
        const isDuplicate = targetEdges.some(
          (te) =>
            te.sourceId === edge.sourceId &&
            te.targetId === edge.targetId &&
            te.type.equals(edge.type),
        );
        if (!isDuplicate) {
          const newEdge = KnowledgeEdge.create({
            id: edge.id,
            graphId: edge.graphId,
            sourceId: edge.sourceId === sourceId ? targetId : edge.sourceId,
            targetId: edge.targetId === sourceId ? targetId : edge.targetId,
            type: edge.type,
            label: edge.label,
            weight: edge.weight,
          });
          await this.repository.saveEdge(newEdge);
        }
      }

      // Delete source node
      await this.repository.deleteNode(sourceId);

      // Save merged node
      await this.repository.updateNode(mergedNode);

      return { success: true, data: mergedNode };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /** Split a node into two, distributing edges */
  async splitNode(
    originalId: KnowledgeNodeId,
    firstNode: KnowledgeNode,
    secondNode: KnowledgeNode,
    edgesForFirst: KnowledgeEdgeId[],
    edgesForSecond: KnowledgeEdgeId[],
  ): Promise<GraphOperationResult<{ first: KnowledgeNode; second: KnowledgeNode }>> {
    try {
      const existingEdges = await this.repository.findEdgesForNode(originalId);

      // Save the two new nodes
      await this.repository.saveNode(firstNode);
      await this.repository.saveNode(secondNode);

      // Redirect edges to the appropriate split node
      for (const edge of existingEdges) {
        if (edgesForFirst.includes(edge.id)) {
          const newEdge = KnowledgeEdge.create({
            id: `${String(edge.id)}_split1` as unknown as KnowledgeEdgeId,
            graphId: edge.graphId,
            sourceId: edge.sourceId === originalId ? firstNode.id : edge.sourceId,
            targetId: edge.targetId === originalId ? firstNode.id : edge.targetId,
            type: edge.type,
            label: edge.label,
            weight: edge.weight,
          });
          await this.repository.saveEdge(newEdge);
        } else if (edgesForSecond.includes(edge.id)) {
          const newEdge = KnowledgeEdge.create({
            id: `${String(edge.id)}_split2` as unknown as KnowledgeEdgeId,
            graphId: edge.graphId,
            sourceId: edge.sourceId === originalId ? secondNode.id : edge.sourceId,
            targetId: edge.targetId === originalId ? secondNode.id : edge.targetId,
            type: edge.type,
            label: edge.label,
            weight: edge.weight,
          });
          await this.repository.saveEdge(newEdge);
        }
      }

      // Delete the original node
      await this.repository.deleteNode(originalId);

      return { success: true, data: { first: firstNode, second: secondNode } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ── Relationship Operations ──────────────────────────────────────────────

  /** Create a relationship (edge) between two nodes */
  async createRelationship(edge: KnowledgeEdge): Promise<GraphOperationResult<KnowledgeEdge>> {
    try {
      const sourceExists = await this.repository.nodeExists(edge.sourceId);
      const targetExists = await this.repository.nodeExists(edge.targetId);

      if (!sourceExists) {
        return { success: false, error: `Source node not found: ${edge.sourceId}` };
      }
      if (!targetExists) {
        return { success: false, error: `Target node not found: ${edge.targetId}` };
      }

      await this.repository.saveEdge(edge);
      return { success: true, data: edge };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /** Delete a relationship */
  async deleteRelationship(edgeId: KnowledgeEdgeId): Promise<GraphOperationResult> {
    try {
      await this.repository.deleteEdge(edgeId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ── Graph Traversal ──────────────────────────────────────────────────────

  /** Traverse the graph from a start node using BFS */
  async traverse(startNodeId: KnowledgeNodeId, maxDepth: number = 5): Promise<TraversalResult> {
    const visited = new Set<KnowledgeNodeId>();
    const path: Array<{ node: KnowledgeNode; edge?: KnowledgeEdge }> = [];
    const queue: Array<{ nodeId: KnowledgeNodeId; depth: number; edge?: KnowledgeEdge }> = [
      { nodeId: startNodeId, depth: 0 },
    ];

    visited.add(startNodeId);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      const node = await this.repository.findNodeById(current.nodeId);

      if (!node) continue;

      path.push({ node, edge: current.edge });

      if (current.depth >= maxDepth) continue;

      const edges = await this.repository.findEdgesForNode(current.nodeId);
      for (const edge of edges) {
        const neighborId = edge.sourceId === current.nodeId ? edge.targetId : edge.sourceId;
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ nodeId: neighborId, depth: current.depth + 1, edge });
        }
      }
    }

    return {
      path,
      depth: maxDepth,
      totalCost: path.length,
    };
  }

  /** Find the shortest path between two nodes using BFS (unweighted) */
  async findShortestPath(
    startId: KnowledgeNodeId,
    endId: KnowledgeNodeId,
  ): Promise<TraversalResult | null> {
    const visited = new Set<KnowledgeNodeId>();
    const parent = new Map<KnowledgeNodeId, { nodeId: KnowledgeNodeId; edge: KnowledgeEdge }>();
    const queue: KnowledgeNodeId[] = [startId];

    visited.add(startId);

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) break;

      if (currentId === endId) {
        // Reconstruct path
        const path: Array<{ node: KnowledgeNode; edge?: KnowledgeEdge }> = [];
        let cursor: KnowledgeNodeId | undefined = endId;

        const reversePath: Array<{ nodeId: KnowledgeNodeId; edge?: KnowledgeEdge }> = [];
        while (cursor && cursor !== startId) {
          const entry = parent.get(cursor);
          if (!entry) break;
          reversePath.push({ nodeId: cursor, edge: entry.edge });
          cursor = entry.nodeId;
        }
        reversePath.push({ nodeId: startId });
        reversePath.reverse();

        for (const step of reversePath) {
          const node = await this.repository.findNodeById(step.nodeId);
          if (node) {
            path.push({ node, edge: step.edge });
          }
        }

        return {
          path,
          depth: path.length,
          totalCost: path.length,
        };
      }

      const edges = await this.repository.findEdgesForNode(currentId);
      for (const edge of edges) {
        const neighborId = edge.sourceId === currentId ? edge.targetId : edge.sourceId;
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          parent.set(neighborId, { nodeId: currentId, edge });
          queue.push(neighborId);
        }
      }
    }

    return null; // No path found
  }

  // ── Search Operations ────────────────────────────────────────────────────

  /** Search nodes by label and description */
  async search(query: string, graphId?: GraphId): Promise<SearchResult> {
    const result = await this.repository.searchNodes(query, { page: 1, limit: 100 });
    let nodes = result.data;

    // If graphId specified, filter by graph
    if (graphId) {
      nodes = nodes.filter((n) => n.graphId === graphId);
    }

    return {
      nodes,
      total: nodes.length,
      relevance: nodes.length > 0 ? 0.8 : 0,
    };
  }

  /** Find related knowledge for a given node */
  async findRelatedKnowledge(nodeId: KnowledgeNodeId): Promise<SearchResult> {
    const node = await this.repository.findNodeById(nodeId);
    if (!node) {
      return { nodes: [], total: 0, relevance: 0 };
    }

    const edges = await this.repository.findEdgesForNode(nodeId);
    const relatedNodeIds = new Set<KnowledgeNodeId>();

    for (const edge of edges) {
      const neighborId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
      relatedNodeIds.add(neighborId);
    }

    const relatedNodes: KnowledgeNode[] = [];
    for (const id of relatedNodeIds) {
      const relatedNode = await this.repository.findNodeById(id);
      if (relatedNode) {
        relatedNodes.push(relatedNode);
      }
    }

    return {
      nodes: relatedNodes,
      total: relatedNodes.length,
      relevance: 1.0,
    };
  }

  // ── Dependency Graph ─────────────────────────────────────────────────────

  /** Build the dependency graph for a node (DEPENDS_ON relationships) */
  async getDependencyGraph(
    nodeId: KnowledgeNodeId,
  ): Promise<{ dependencies: KnowledgeNode[]; dependents: KnowledgeNode[] }> {
    const edges = await this.repository.findEdgesForNode(nodeId);
    const dependencies: KnowledgeNode[] = [];
    const dependents: KnowledgeNode[] = [];

    for (const edge of edges) {
      if (edge.type.equals(RelationshipType.DEPENDS_ON())) {
        const depNode = await this.repository.findNodeById(
          edge.targetId === nodeId ? edge.sourceId : edge.targetId,
        );
        if (depNode) {
          if (edge.targetId === nodeId) {
            dependencies.push(depNode); // node depends on depNode
          } else {
            dependents.push(depNode); // depNode depends on node
          }
        }
      }
    }

    return { dependencies, dependents };
  }

  // ── Impact Analysis ──────────────────────────────────────────────────────

  /** Analyze the impact of removing/altering a node */
  async analyzeImpact(nodeId: KnowledgeNodeId): Promise<ImpactResult> {
    const edges = await this.repository.findEdgesForNode(nodeId);
    const impactedNodeIds = new Set<KnowledgeNodeId>();
    const impactedEdges: KnowledgeEdge[] = [];

    for (const edge of edges) {
      impactedEdges.push(edge);
      const neighborId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
      impactedNodeIds.add(neighborId);
    }

    const impactedNodes: KnowledgeNode[] = [];
    for (const id of impactedNodeIds) {
      const node = await this.repository.findNodeById(id);
      if (node) impactedNodes.push(node);
    }

    const impactLevel =
      impactedEdges.length > 10 ? 'high' : impactedEdges.length > 3 ? 'medium' : 'low';

    return {
      affectedNodes: impactedNodes,
      affectedEdges: impactedEdges,
      impactLevel,
      description: `Removing this node would affect ${String(impactedNodes.length)} connected nodes across ${String(impactedEdges.length)} relationships`,
    };
  }

  // ── Cycle Detection ──────────────────────────────────────────────────────

  /** Detect cycles in the graph using DFS */
  async detectCycles(graphId: GraphId): Promise<CycleDetectionResult> {
    const nodes = await this.repository.findNodesByGraph(graphId, { page: 1, limit: 1000 });
    const nodeIds = nodes.data.map((n) => n.id);
    const white = new Set(nodeIds); // Unvisited
    const grey = new Set<KnowledgeNodeId>(); // In progress
    const black = new Set<KnowledgeNodeId>(); // Completed
    const cycles: Array<{ nodes: KnowledgeNodeId[]; edges: string[] }> = [];

    async function dfs(
      currentId: KnowledgeNodeId,
      repo: KnowledgeRepository,
      parentMap: Map<KnowledgeNodeId, KnowledgeNodeId>,
      edgeLabels: Map<string, string>,
    ): Promise<void> {
      white.delete(currentId);
      grey.add(currentId);

      const edges = await repo.findEdgesForNode(currentId);
      for (const edge of edges) {
        const neighborId = edge.sourceId === currentId ? edge.targetId : edge.sourceId;

        if (white.has(neighborId)) {
          parentMap.set(neighborId, currentId);
          edgeLabels.set(`${currentId}->${neighborId}`, edge.type.type);
          await dfs(neighborId, repo, parentMap, edgeLabels);
        } else if (grey.has(neighborId)) {
          // Found a cycle — reconstruct it
          const cycleNodes: KnowledgeNodeId[] = [neighborId, currentId];
          const cycleEdges: string[] = [edge.type.type];
          let cursor = currentId;
          while (cursor && cursor !== neighborId) {
            const parent = parentMap.get(cursor);
            if (!parent) break;
            cycleNodes.push(parent);
            const edgeKey = `${parent}->${cursor}`;
            const edgeType = edgeLabels.get(edgeKey);
            if (edgeType) cycleEdges.push(edgeType);
            cursor = parent;
          }
          cycleNodes.reverse();
          cycles.push({ nodes: cycleNodes, edges: cycleEdges });
        }
      }

      grey.delete(currentId);
      black.add(currentId);
    }

    const parentMap = new Map<KnowledgeNodeId, KnowledgeNodeId>();
    const edgeLabels = new Map<string, string>();

    for (const nodeId of nodeIds) {
      if (white.has(nodeId)) {
        await dfs(nodeId, this.repository, parentMap, edgeLabels);
      }
    }

    return {
      hasCycle: cycles.length > 0,
      cycles,
    };
  }

  // ── Validation ───────────────────────────────────────────────────────────

  /** Validate that a node can be safely added to a graph */
  async validateNodeAddition(
    node: KnowledgeNode,
    _graphId: GraphId,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!node.label || node.label.trim().length === 0) {
      errors.push('Node label is required');
    }
    if (node.label && node.label.length > 200) {
      errors.push('Node label must be at most 200 characters');
    }

    const existing = await this.repository.findNodeById(node.id);
    if (existing) {
      errors.push(`Node with ID ${node.id} already exists`);
    }

    return { valid: errors.length === 0, errors };
  }

  /** Get graph statistics */
  async getGraphStatistics(graphId: GraphId): Promise<GraphStats> {
    const nodeCount = await this.repository.countNodes(graphId);
    const edgeCount = await this.repository.countEdges(graphId);
    const categoryDist = await this.repository.countNodesByCategory(graphId);

    // Get all edges for distribution analysis
    // const _allCategories = Object.keys(categoryDist); // kept for documentation

    // Calculate connectivity
    const connectivity = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0;
    const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

    return {
      nodeCount,
      edgeCount,
      categoryDistribution: categoryDist,
      relationshipDistribution: {},
      averageConnectivity: connectivity,
      density,
    };
  }
}
