// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain Events
// All domain events emitted by the Knowledge Graph bounded context
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { KnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export type KnowledgeEventType =
  | 'knowledge.node.created'
  | 'knowledge.node.updated'
  | 'knowledge.node.deleted'
  | 'knowledge.node.merged'
  | 'knowledge.node.split'
  | 'knowledge.node.status_changed'
  | 'knowledge.edge.created'
  | 'knowledge.edge.updated'
  | 'knowledge.edge.deleted'
  | 'knowledge.graph.created'
  | 'knowledge.graph.updated'
  | 'knowledge.graph.archived'
  | 'knowledge.graph.snapshot'
  | 'knowledge.relationship.validated'
  | 'knowledge.relationship.invalidated'
  | 'knowledge.search.executed'
  | 'knowledge.search.failed'
  | 'knowledge.traversal.executed'
  | 'knowledge.impact.analyzed'
  | 'knowledge.cycle.detected'
  | 'knowledge.quality.scored'
  | 'knowledge.validation.failed'
  | 'knowledge.sync.requested'
  | 'knowledge.sync.completed'
  | 'knowledge.recommendation.preparation.started'
  | 'knowledge.recommendation.preparation.completed';

export interface KnowledgeEvent {
  type: KnowledgeEventType;
  nodeId?: KnowledgeNodeId;
  edgeId?: KnowledgeEdgeId;
  graphId?: GraphId;
  timestamp: Date;
  data: Record<string, unknown>;
}

// ── Event Factory Helpers ─────────────────────────────────────────────────

export function createKnowledgeEvent(
  type: KnowledgeEventType,
  data: Record<string, unknown> = {},
): KnowledgeEvent {
  return { type, timestamp: new Date(), data };
}

export function createNodeEvent(
  type: KnowledgeEventType,
  nodeId: KnowledgeNodeId,
  data: Record<string, unknown> = {},
): KnowledgeEvent {
  return { type, nodeId, timestamp: new Date(), data };
}

export function createEdgeEvent(
  type: KnowledgeEventType,
  edgeId: KnowledgeEdgeId,
  data: Record<string, unknown> = {},
): KnowledgeEvent {
  return { type, edgeId, timestamp: new Date(), data };
}

export function createGraphEvent(
  type: KnowledgeEventType,
  graphId: GraphId,
  data: Record<string, unknown> = {},
): KnowledgeEvent {
  return { type, graphId, timestamp: new Date(), data };
}
