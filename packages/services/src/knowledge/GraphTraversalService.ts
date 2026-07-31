// ──────────────────────────────────────────────────────────────────
// VedMoulya — Graph Traversal Service
// Application service for graph traversal operations
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { BaseService } from '@vedmoulya/core';
import type { KnowledgeRepository, KnowledgeNode, KnowledgeEdge } from '@vedmoulya/domain';
import { KnowledgeGraphService, createKnowledgeNodeId } from '@vedmoulya/domain';
import { KnowledgeMapper } from './KnowledgeMapper.js';
import type {
  TraversalResultDTO,
  TraversalStepDTO,
  KnowledgeNodeDTO,
  KnowledgeEdgeDTO,
} from './KnowledgeDTO.js';

export interface TraversalFilter {
  maxDepth?: number;
  relationshipTypes?: string[];
  categories?: string[];
  minConfidence?: string;
}

export interface SubgraphDTO {
  nodes: KnowledgeNodeDTO[];
  edges: KnowledgeEdgeDTO[];
}

interface TraversalPathStep {
  node: KnowledgeNode;
  edge?: KnowledgeEdge;
}

/**
 * GraphTraversalService — application-level graph traversal operations.
 * Provides filtered traversal, subgraph extraction, and path finding
 * with application-level validation and transformation.
 */
export class GraphTraversalService extends BaseService {
  private readonly repository: KnowledgeRepository;
  private readonly graphService: KnowledgeGraphService;

  constructor(repository: KnowledgeRepository) {
    super('graph-traversal');
    this.repository = repository;
    this.graphService = new KnowledgeGraphService(repository);
  }

  /** Traverse the graph with optional filters */
  async traverseWithFilter(
    startNodeId: string,
    filter?: TraversalFilter,
  ): Promise<TraversalResultDTO> {
    const nid = createKnowledgeNodeId(startNodeId);
    const result = await this.graphService.traverse(nid, filter?.maxDepth);

    // Apply post-traversal filtering
    let filteredPath: TraversalPathStep[] = result.path;

    if (filter?.relationshipTypes && filter.relationshipTypes.length > 0) {
      filteredPath = filteredPath.filter((step: TraversalPathStep) => {
        if (!step.edge || !filter.relationshipTypes) return true;
        return filter.relationshipTypes.includes(step.edge.type.type);
      });
    }

    if (filter?.categories && filter.categories.length > 0) {
      filteredPath = filteredPath.filter(
        (step: TraversalPathStep) =>
          filter.categories && filter.categories.includes(step.node.category.value),
      );
    }

    if (filter?.minConfidence) {
      const minScore =
        filter.minConfidence === 'high' ? 0.8 : filter.minConfidence === 'medium' ? 0.5 : 0.3;
      filteredPath = filteredPath.filter((step: TraversalPathStep) => {
        if (!step.edge) return true;
        return step.edge.confidence.score >= minScore;
      });
    }

    return {
      path: filteredPath.map((step: TraversalPathStep) => KnowledgeMapper.toTraversalStepDTO(step)),
      depth: result.depth,
      totalCost: result.totalCost,
    };
  }

  /** Extract a subgraph centered on a node at specified depth */
  async extractSubgraph(nodeId: string, depth: number = 2): Promise<SubgraphDTO> {
    const result = await this.traverseWithFilter(nodeId, { maxDepth: depth });
    const nodeDTOs: KnowledgeNodeDTO[] = result.path.map((p: TraversalStepDTO) => p.node);
    const edgeDTOs: KnowledgeEdgeDTO[] = result.path
      .filter((p: TraversalStepDTO): p is TraversalStepDTO & { edge: KnowledgeEdgeDTO } => !!p.edge)
      .map((p: TraversalStepDTO & { edge: KnowledgeEdgeDTO }) => p.edge);

    const uniqueNodes = new Map<string, KnowledgeNodeDTO>();
    const uniqueEdges = new Map<string, KnowledgeEdgeDTO>();

    for (const node of nodeDTOs) {
      uniqueNodes.set(node.id, node);
    }
    for (const edge of edgeDTOs) {
      uniqueEdges.set(edge.id, edge);
    }

    return {
      nodes: Array.from(uniqueNodes.values()),
      edges: Array.from(uniqueEdges.values()),
    };
  }

  /** Find all paths between two nodes (up to maxPaths) */
  async findAllPaths(startNodeId: string, endNodeId: string): Promise<TraversalResultDTO[]> {
    const sid = createKnowledgeNodeId(startNodeId);
    const eid = createKnowledgeNodeId(endNodeId);

    const result = await this.graphService.findShortestPath(sid, eid);
    if (!result) return [];

    return [
      {
        path: result.path.map((step: TraversalPathStep) => ({
          node: KnowledgeMapper.toNodeDTO(step.node),
          edge: step.edge ? KnowledgeMapper.toEdgeDTO(step.edge) : undefined,
        })),
        depth: result.depth,
        totalCost: result.totalCost,
      },
    ];
  }

  /** Get the dependency chain for a node */
  async getDependencyChain(nodeId: string): Promise<{
    dependencies: KnowledgeNodeDTO[];
    dependents: KnowledgeNodeDTO[];
  }> {
    const nid = createKnowledgeNodeId(nodeId);
    const result = await this.graphService.getDependencyGraph(nid);
    return {
      dependencies: result.dependencies.map((n) => KnowledgeMapper.toNodeDTO(n)),
      dependents: result.dependents.map((n) => KnowledgeMapper.toNodeDTO(n)),
    };
  }
}
