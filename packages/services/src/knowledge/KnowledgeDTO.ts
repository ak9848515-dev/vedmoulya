// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Application DTOs
// Data Transfer Objects for knowledge graph API
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeCategoryValue, RelationshipCategory } from '@vedmoulya/domain';

// ── Node DTOs ─────────────────────────────────────────────────────────────

export interface KnowledgeNodeDTO {
  id: string;
  graphId: string;
  category: KnowledgeCategoryValue;
  label: string;
  description: string;
  metadata: Record<string, unknown>;
  status: string;
  confidence: string;
  confidenceScore: number;
  sourceType: string;
  sourceDetail: string;
  qualityScore: number;
  version: string;
  entityStatus: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateNodeDTO {
  graphId: string;
  category: KnowledgeCategoryValue;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sourceType?: string;
  sourceDetail?: string;
  tags?: string[];
}

export interface UpdateNodeDTO {
  label?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  category?: KnowledgeCategoryValue;
}

// ── Edge DTOs ─────────────────────────────────────────────────────────────

export interface KnowledgeEdgeDTO {
  id: string;
  graphId: string;
  sourceId: string;
  targetId: string;
  type: string;
  category: string;
  label: string;
  weight: number;
  confidence: string;
  status: string;
  entityStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEdgeDTO {
  graphId: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
  relationshipCategory: RelationshipCategory;
  label?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
  sourceType?: string;
  sourceDetail?: string;
}

// ── Graph DTOs ────────────────────────────────────────────────────────────

export interface KnowledgeGraphDTO {
  graphId: string;
  label: string;
  description: string;
  nodeCount: number;
  edgeCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGraphDTO {
  label: string;
  description?: string;
}

// ── Traversal DTOs ────────────────────────────────────────────────────────

export interface TraversalStepDTO {
  node: KnowledgeNodeDTO;
  edge?: KnowledgeEdgeDTO;
}

export interface TraversalResultDTO {
  path: TraversalStepDTO[];
  depth: number;
  totalCost: number;
}

// ── Search DTOs ───────────────────────────────────────────────────────────

export interface SearchResultDTO {
  nodes: KnowledgeNodeDTO[];
  total: number;
  relevance: number;
}

export interface RelatedKnowledgeDTO {
  nodes: KnowledgeNodeDTO[];
  total: number;
  relevance: number;
}

// ── Impact Analysis DTOs ──────────────────────────────────────────────────

export interface ImpactResultDTO {
  affectedNodes: KnowledgeNodeDTO[];
  affectedEdges: KnowledgeEdgeDTO[];
  impactLevel: 'low' | 'medium' | 'high';
  description: string;
}

// ── Graph Statistics DTOs ─────────────────────────────────────────────────

export interface GraphStatisticsDTO {
  nodeCount: number;
  edgeCount: number;
  categoryDistribution: Record<string, number>;
  relationshipDistribution: Record<string, number>;
  averageConnectivity: number;
  density: number;
}

// ── Cycle Detection DTOs ──────────────────────────────────────────────────

export interface CycleResultDTO {
  hasCycle: boolean;
  cycles: Array<{
    nodes: string[];
    edges: string[];
  }>;
}

// ── Merge/Split DTOs ──────────────────────────────────────────────────────

export interface MergeNodesDTO {
  sourceId: string;
  targetId: string;
  mergedLabel: string;
  mergedDescription?: string;
}

export interface SplitNodeDTO {
  nodeId: string;
  firstLabel: string;
  secondLabel: string;
  firstDescription?: string;
  secondDescription?: string;
  edgesForFirst: string[];
  edgesForSecond: string[];
}

// ── List DTOs ─────────────────────────────────────────────────────────────

export interface KnowledgeNodeListDTO {
  nodes: KnowledgeNodeDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface KnowledgeEdgeListDTO {
  edges: KnowledgeEdgeDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface KnowledgeGraphListDTO {
  graphs: KnowledgeGraphDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
