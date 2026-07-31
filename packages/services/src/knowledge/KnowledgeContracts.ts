// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Service Contracts
// Formal query, command, event, and request definitions per ENG-002
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { IdentityInformation } from '@vedmoulya/information';
import type { KnowledgeCategoryValue, RelationshipCategory } from '@vedmoulya/domain';

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// Queries
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

export interface GetNodeQuery {
  type: 'GetNode';
  nodeId: string;
}

export interface GetGraphQuery {
  type: 'GetGraph';
  graphId: string;
}

export interface SearchNodesQuery {
  type: 'SearchNodes';
  query: string;
  page: number;
  limit: number;
  filters?: {
    categories?: KnowledgeCategoryValue[];
    tags?: string[];
    status?: string;
  };
}

export interface ListGraphsQuery {
  type: 'ListGraphs';
  page: number;
  limit: number;
}

export interface FindRelatedQuery {
  type: 'FindRelated';
  nodeId: string;
}

export interface GetNodeEdgesQuery {
  type: 'GetNodeEdges';
  nodeId: string;
}

export interface TraverseGraphQuery {
  type: 'TraverseGraph';
  startNodeId: string;
  maxDepth?: number;
}

export interface FindShortestPathQuery {
  type: 'FindShortestPath';
  startNodeId: string;
  endNodeId: string;
}

export interface AnalyzeImpactQuery {
  type: 'AnalyzeImpact';
  nodeId: string;
}

export interface DetectCyclesQuery {
  type: 'DetectCycles';
  graphId: string;
}

export interface GetGraphStatisticsQuery {
  type: 'GetGraphStatistics';
  graphId: string;
}

export type KnowledgeQuery =
  | GetNodeQuery
  | GetGraphQuery
  | SearchNodesQuery
  | ListGraphsQuery
  | FindRelatedQuery
  | GetNodeEdgesQuery
  | TraverseGraphQuery
  | FindShortestPathQuery
  | AnalyzeImpactQuery
  | DetectCyclesQuery
  | GetGraphStatisticsQuery;

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// Commands
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

export interface CreateGraphCommand {
  type: 'CreateGraph';
  label: string;
  description?: string;
}

export interface CreateNodeCommand {
  type: 'CreateNode';
  graphId: string;
  category: KnowledgeCategoryValue;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sourceType?: string;
  sourceDetail?: string;
  tags?: string[];
}

export interface UpdateNodeCommand {
  type: 'UpdateNode';
  nodeId: string;
  label?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  category?: KnowledgeCategoryValue;
}

export interface DeleteNodeCommand {
  type: 'DeleteNode';
  nodeId: string;
}

export interface CreateEdgeCommand {
  type: 'CreateEdge';
  graphId: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
  relationshipCategory: RelationshipCategory;
  label?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface DeleteEdgeCommand {
  type: 'DeleteEdge';
  edgeId: string;
}

export interface MergeNodesCommand {
  type: 'MergeNodes';
  sourceId: string;
  targetId: string;
  mergedLabel: string;
  mergedDescription?: string;
}

export interface SplitNodeCommand {
  type: 'SplitNode';
  nodeId: string;
  firstLabel: string;
  secondLabel: string;
  firstDescription?: string;
  secondDescription?: string;
  edgesForFirst: string[];
  edgesForSecond: string[];
}

export type KnowledgeCommand =
  | CreateGraphCommand
  | CreateNodeCommand
  | UpdateNodeCommand
  | DeleteNodeCommand
  | CreateEdgeCommand
  | DeleteEdgeCommand
  | MergeNodesCommand
  | SplitNodeCommand;

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// Events
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

export interface KnowledgeNodeCreatedEvent {
  type: 'knowledge.node.created';
  nodeId: string;
  graphId: string;
  category: KnowledgeCategoryValue;
  label: string;
  timestamp: Date;
  correlationId: string;
}

export interface KnowledgeNodeUpdatedEvent {
  type: 'knowledge.node.updated';
  nodeId: string;
  changedFields: string[];
  timestamp: Date;
  correlationId: string;
}

export interface KnowledgeNodeDeletedEvent {
  type: 'knowledge.node.deleted';
  nodeId: string;
  timestamp: Date;
  correlationId: string;
}

export interface KnowledgeEdgeCreatedEvent {
  type: 'knowledge.edge.created';
  edgeId: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
  timestamp: Date;
  correlationId: string;
}

export interface KnowledgeEdgeDeletedEvent {
  type: 'knowledge.edge.deleted';
  edgeId: string;
  timestamp: Date;
  correlationId: string;
}

export interface KnowledgeGraphCreatedEvent {
  type: 'knowledge.graph.created';
  graphId: string;
  label: string;
  timestamp: Date;
  correlationId: string;
}

export interface KnowledgeGraphDeletedEvent {
  type: 'knowledge.graph.deleted';
  graphId: string;
  timestamp: Date;
  correlationId: string;
}

export interface KnowledgeNodesMergedEvent {
  type: 'knowledge.nodes.merged';
  sourceId: string;
  targetId: string;
  mergedNodeId: string;
  timestamp: Date;
  correlationId: string;
}

export interface KnowledgeNodeSplitEvent {
  type: 'knowledge.node.split';
  originalId: string;
  firstNodeId: string;
  secondNodeId: string;
  timestamp: Date;
  correlationId: string;
}

export type KnowledgeContractEvent =
  | KnowledgeNodeCreatedEvent
  | KnowledgeNodeUpdatedEvent
  | KnowledgeNodeDeletedEvent
  | KnowledgeEdgeCreatedEvent
  | KnowledgeEdgeDeletedEvent
  | KnowledgeGraphCreatedEvent
  | KnowledgeGraphDeletedEvent
  | KnowledgeNodesMergedEvent
  | KnowledgeNodeSplitEvent;

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// Service Contract — Unified message wrapper
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

export type KnowledgeMessage = KnowledgeQuery | KnowledgeCommand | KnowledgeContractEvent;

export interface KnowledgeContractResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  /** Correlation ID for tracing */
  correlationId: string;
  /** Information model metadata if applicable */
  information?: IdentityInformation;
}
