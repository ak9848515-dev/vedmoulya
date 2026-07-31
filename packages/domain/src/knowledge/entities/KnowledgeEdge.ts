// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: KnowledgeEdge
// ARC-003/D03 — Relationships connect entities into meaning
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';
import { RelationshipType } from '../value-objects/RelationshipType.js';
import { KnowledgeConfidence } from '../value-objects/KnowledgeConfidence.js';
import { KnowledgeStatus } from '../value-objects/KnowledgeStatus.js';
import { KnowledgeSource } from '../value-objects/KnowledgeSource.js';
import type { KnowledgeEvent } from '../events/KnowledgeEvent.js';
import { createEdgeEvent } from '../events/KnowledgeEvent.js';
import type { EntityStatus } from '@vedmoulya/core';

/**
 * KnowledgeEdge — a typed, directed relationship between two KnowledgeNodes.
 * Every relationship has a type, direction, meaning, and temporal context.
 */
export class KnowledgeEdge {
  private readonly _id: KnowledgeEdgeId;
  private readonly _graphId: GraphId;
  private readonly _sourceId: KnowledgeNodeId;
  private readonly _targetId: KnowledgeNodeId;
  private _type: RelationshipType;
  private _label: string;
  private _metadata: Record<string, unknown>;
  private _weight: number; // 0.0 to 1.0 — relative importance
  private _confidence: KnowledgeConfidence;
  private _status: KnowledgeStatus;
  private readonly _source: KnowledgeSource;
  private _entityStatus: EntityStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private readonly _events: KnowledgeEvent[] = [];

  constructor(props: {
    id: KnowledgeEdgeId;
    graphId: GraphId;
    sourceId: KnowledgeNodeId;
    targetId: KnowledgeNodeId;
    type: RelationshipType;
    label?: string;
    metadata?: Record<string, unknown>;
    weight?: number;
    confidence?: KnowledgeConfidence;
    status?: KnowledgeStatus;
    source?: KnowledgeSource;
    entityStatus?: EntityStatus;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this._id = props.id;
    this._graphId = props.graphId;
    this._sourceId = props.sourceId;
    this._targetId = props.targetId;
    this._type = props.type;
    this._label = props.label ?? props.type.label;
    this._metadata = props.metadata ?? {};
    this._weight = clampWeight(props.weight ?? 0.5);
    this._confidence = props.confidence ?? KnowledgeConfidence.medium();
    this._status = props.status ?? KnowledgeStatus.active();
    this._source = props.source ?? KnowledgeSource.systemGenerated('edge creation');
    this._entityStatus = props.entityStatus ?? 'active';
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  // ── Getters ─────────────────────────────────────────────────────────────

  get id(): KnowledgeEdgeId {
    return this._id;
  }
  get graphId(): GraphId {
    return this._graphId;
  }
  get sourceId(): KnowledgeNodeId {
    return this._sourceId;
  }
  get targetId(): KnowledgeNodeId {
    return this._targetId;
  }
  get type(): RelationshipType {
    return this._type;
  }
  get label(): string {
    return this._label;
  }
  get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }
  get weight(): number {
    return this._weight;
  }
  get confidence(): KnowledgeConfidence {
    return this._confidence;
  }
  get status(): KnowledgeStatus {
    return this._status;
  }
  get source(): KnowledgeSource {
    return this._source;
  }
  get entityStatus(): EntityStatus {
    return this._entityStatus;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Drain and return all pending domain events */
  pullEvents(): KnowledgeEvent[] {
    const events = [...this._events];
    this._events.length = 0;
    return events;
  }

  // ── Behaviour ───────────────────────────────────────────────────────────

  /** Update the relationship type */
  changeType(type: RelationshipType): void {
    const oldType = this._type.type;
    this._type = type;
    this._label = type.label;
    this._updatedAt = new Date();
    this._events.push(
      createEdgeEvent('knowledge.edge.updated', this._id, { oldType, newType: type.type }),
    );
  }

  /** Update weight */
  updateWeight(weight: number): void {
    this._weight = clampWeight(weight);
    this._updatedAt = new Date();
  }

  /** Update confidence */
  updateConfidence(confidence: KnowledgeConfidence): void {
    this._confidence = confidence;
    this._updatedAt = new Date();
  }

  /** Update metadata */
  updateMetadata(metadata: Record<string, unknown>): void {
    this._metadata = { ...this._metadata, ...metadata };
    this._updatedAt = new Date();
  }

  /** Validate and confirm the relationship */
  validate(): void {
    this._updatedAt = new Date();
    this._events.push(createEdgeEvent('knowledge.relationship.validated', this._id, {}));
  }

  /** Invalidate the relationship */
  invalidate(reason: string): void {
    this._status = KnowledgeStatus.invalidated(reason);
    this._updatedAt = new Date();
    this._events.push(createEdgeEvent('knowledge.relationship.invalidated', this._id, { reason }));
  }

  /** Soft-delete the edge */
  archive(): void {
    this._entityStatus = 'archived';
    this._status = KnowledgeStatus.archived('Edge archived');
    this._updatedAt = new Date();
    this._events.push(createEdgeEvent('knowledge.edge.deleted', this._id, {}));
  }

  // ── Factory ─────────────────────────────────────────────────────────────

  /** Create a new KnowledgeEdge */
  static create(props: {
    id: KnowledgeEdgeId;
    graphId: GraphId;
    sourceId: KnowledgeNodeId;
    targetId: KnowledgeNodeId;
    type: RelationshipType;
    label?: string;
    weight?: number;
    source?: KnowledgeSource;
    metadata?: Record<string, unknown>;
  }): KnowledgeEdge {
    if (props.sourceId === props.targetId) {
      throw new Error('Cannot create self-referencing edge');
    }

    const edge = new KnowledgeEdge({
      id: props.id,
      graphId: props.graphId,
      sourceId: props.sourceId,
      targetId: props.targetId,
      type: props.type,
      label: props.label,
      weight: props.weight,
      source: props.source,
      metadata: props.metadata,
    });

    edge._events.push(
      createEdgeEvent('knowledge.edge.created', props.id, {
        sourceId: props.sourceId,
        targetId: props.targetId,
        type: props.type.type,
      }),
    );

    return edge;
  }
}

function clampWeight(value: number): number {
  return Math.max(0, Math.min(1, value));
}
