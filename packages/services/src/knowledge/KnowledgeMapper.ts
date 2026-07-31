// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Mapper
// Maps between domain entities and DTOs
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeNode, KnowledgeEdge, KnowledgeGraph } from '@vedmoulya/domain';
import type {
  KnowledgeNodeDTO,
  KnowledgeEdgeDTO,
  KnowledgeGraphDTO,
  TraversalStepDTO,
} from './KnowledgeDTO.js';

export const KnowledgeMapper = {
  /** Map a KnowledgeNode entity to a node DTO */
  toNodeDTO(node: KnowledgeNode): KnowledgeNodeDTO {
    return {
      id: node.id,
      graphId: node.graphId,
      category: node.category.value,
      label: node.label,
      description: node.description,
      metadata: node.metadata,
      status: node.status.state,
      confidence: node.confidence.level,
      confidenceScore: node.confidence.score,
      sourceType: node.source.type,
      sourceDetail: node.source.detail,
      qualityScore: node.quality.overall,
      version: node.version.toString(),
      entityStatus: node.entityStatus,
      tags: [...node.tags],
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    };
  },

  /** Map a KnowledgeEdge entity to an edge DTO */
  toEdgeDTO(edge: KnowledgeEdge): KnowledgeEdgeDTO {
    return {
      id: edge.id,
      graphId: edge.graphId,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      type: edge.type.type,
      category: edge.type.category,
      label: edge.label,
      weight: edge.weight,
      confidence: edge.confidence.level,
      status: edge.status.state,
      entityStatus: edge.entityStatus,
      createdAt: edge.createdAt.toISOString(),
      updatedAt: edge.updatedAt.toISOString(),
    };
  },

  /** Map a KnowledgeGraph aggregate to a graph DTO */
  toGraphDTO(graph: KnowledgeGraph, nodeCount?: number, edgeCount?: number): KnowledgeGraphDTO {
    return {
      graphId: graph.graphId,
      label: graph.label,
      description: graph.description,
      nodeCount: nodeCount ?? graph.nodeCount,
      edgeCount: edgeCount ?? graph.edgeCount,
      status: graph.status.state,
      createdAt: graph.createdAt.toISOString(),
      updatedAt: graph.updatedAt.toISOString(),
    };
  },

  /** Map traversal step (node + optional edge) to DTO */
  toTraversalStepDTO(step: { node: KnowledgeNode; edge?: KnowledgeEdge }): TraversalStepDTO {
    return {
      node: KnowledgeMapper.toNodeDTO(step.node),
      edge: step.edge ? KnowledgeMapper.toEdgeDTO(step.edge) : undefined,
    };
  },

  /** Map multiple nodes to node DTOs */
  toNodeDTOs(nodes: KnowledgeNode[]): KnowledgeNodeDTO[] {
    return nodes.map((n) => KnowledgeMapper.toNodeDTO(n));
  },

  /** Map multiple edges to edge DTOs */
  toEdgeDTOs(edges: KnowledgeEdge[]): KnowledgeEdgeDTO[] {
    return edges.map((e) => KnowledgeMapper.toEdgeDTO(e));
  },
};
