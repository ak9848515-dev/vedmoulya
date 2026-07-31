// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: KnowledgeNode
// ARC-003 — Fundamental entity in the Knowledge Graph
// Every node represents a meaningful concept in a person's life journey
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import { KnowledgeStatus } from '../value-objects/KnowledgeStatus.js';
import { KnowledgeConfidence } from '../value-objects/KnowledgeConfidence.js';
import { KnowledgeSource } from '../value-objects/KnowledgeSource.js';
import { KnowledgeVersion } from '../value-objects/KnowledgeVersion.js';
import { KnowledgeQuality } from '../value-objects/KnowledgeQuality.js';
import { KnowledgeLineage } from '../value-objects/KnowledgeLineage.js';
import type { KnowledgeEvent } from '../events/KnowledgeEvent.js';
import { createNodeEvent } from '../events/KnowledgeEvent.js';
import type { EntityStatus } from '@vedmoulya/core';

/**
 * KnowledgeNode — the fundamental entity in the Knowledge Graph.
 * Maps to ARC-003/D02 Entity Model.
 * Every node is uniquely identified, categorized, versioned, and traceable.
 */
export class KnowledgeNode {
  private readonly _id: KnowledgeNodeId;
  private readonly _graphId: GraphId;
  private _category: KnowledgeCategory;
  private _label: string;
  private _description: string;
  private _metadata: Record<string, unknown>;
  private _status: KnowledgeStatus;
  private _confidence: KnowledgeConfidence;
  private readonly _source: KnowledgeSource;
  private _quality: KnowledgeQuality;
  private _version: KnowledgeVersion;
  private readonly _lineage: KnowledgeLineage;
  private _entityStatus: EntityStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _tags: string[];
  private readonly _events: KnowledgeEvent[] = [];

  constructor(props: {
    id: KnowledgeNodeId;
    graphId: GraphId;
    category: KnowledgeCategory;
    label: string;
    description?: string;
    metadata?: Record<string, unknown>;
    status?: KnowledgeStatus;
    confidence?: KnowledgeConfidence;
    source?: KnowledgeSource;
    quality?: KnowledgeQuality;
    version?: KnowledgeVersion;
    lineage?: KnowledgeLineage;
    entityStatus?: EntityStatus;
    createdAt?: Date;
    updatedAt?: Date;
    tags?: string[];
  }) {
    this._id = props.id;
    this._graphId = props.graphId;
    this._category = props.category;
    this._label = props.label;
    this._description = props.description ?? '';
    this._metadata = props.metadata ?? {};
    this._status = props.status ?? KnowledgeStatus.draft();
    this._confidence = props.confidence ?? KnowledgeConfidence.unknown();
    this._source = props.source ?? KnowledgeSource.systemGenerated('node creation');
    this._quality = props.quality ?? KnowledgeQuality.initial();
    this._version = props.version ?? KnowledgeVersion.initial();
    this._lineage =
      props.lineage ??
      KnowledgeLineage.initial('knowledge.node.created', props.id, `Node created: ${props.label}`);
    this._entityStatus = props.entityStatus ?? 'active';
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
    this._tags = props.tags ?? [];
  }

  // ── Getters ─────────────────────────────────────────────────────────────

  get id(): KnowledgeNodeId {
    return this._id;
  }
  get graphId(): GraphId {
    return this._graphId;
  }
  get category(): KnowledgeCategory {
    return this._category;
  }
  get label(): string {
    return this._label;
  }
  get description(): string {
    return this._description;
  }
  get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }
  get status(): KnowledgeStatus {
    return this._status;
  }
  get confidence(): KnowledgeConfidence {
    return this._confidence;
  }
  get source(): KnowledgeSource {
    return this._source;
  }
  get quality(): KnowledgeQuality {
    return this._quality;
  }
  get version(): KnowledgeVersion {
    return this._version;
  }
  get lineage(): KnowledgeLineage {
    return this._lineage;
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
  get tags(): readonly string[] {
    return Object.freeze([...this._tags]);
  }

  /** Drain and return all pending domain events */
  pullEvents(): KnowledgeEvent[] {
    const events = [...this._events];
    this._events.length = 0;
    return events;
  }

  // ── Behaviour ───────────────────────────────────────────────────────────

  /** Update the node's label and description */
  update(label: string, description?: string): void {
    this._label = label;
    if (description !== undefined) this._description = description;
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
    this._events.push(createNodeEvent('knowledge.node.updated', this._id, { label, description }));
  }

  /** Update metadata */
  updateMetadata(metadata: Record<string, unknown>): void {
    this._metadata = { ...this._metadata, ...metadata };
    this._updatedAt = new Date();
    this._events.push(createNodeEvent('knowledge.node.updated', this._id, { metadata }));
  }

  /** Change the node's category */
  changeCategory(category: KnowledgeCategory): void {
    const old = this._category;
    this._category = category;
    this._version = this._version.bumpMinor();
    this._updatedAt = new Date();
    this._events.push(
      createNodeEvent('knowledge.node.updated', this._id, {
        oldCategory: old.value,
        newCategory: category.value,
      }),
    );
  }

  /** Transition the node's lifecycle status */
  transitionStatus(newStatus: KnowledgeStatus): void {
    if (!this._status.canTransitionTo(newStatus.state)) {
      throw new Error(`Cannot transition from ${this._status.state} to ${newStatus.state}`);
    }
    const oldState = this._status.state;
    this._status = newStatus;
    this._updatedAt = new Date();
    this._events.push(
      createNodeEvent('knowledge.node.status_changed', this._id, {
        from: oldState,
        to: newStatus.state,
        reason: newStatus.reason,
      }),
    );
  }

  /** Update confidence */
  updateConfidence(confidence: KnowledgeConfidence): void {
    this._confidence = confidence;
    this._updatedAt = new Date();
  }

  /** Update quality metrics */
  updateQuality(quality: KnowledgeQuality): void {
    this._quality = quality;
    this._updatedAt = new Date();
    this._events.push(
      createNodeEvent('knowledge.quality.scored', this._id, { overall: quality.overall }),
    );
  }

  /** Add a tag */
  addTag(tag: string): void {
    if (!this._tags.includes(tag)) {
      this._tags.push(tag);
      this._updatedAt = new Date();
    }
  }

  /** Remove a tag */
  removeTag(tag: string): void {
    this._tags = this._tags.filter((t) => t !== tag);
    this._updatedAt = new Date();
  }

  /** Soft-delete the node */
  archive(): void {
    this._entityStatus = 'archived';
    this._status = KnowledgeStatus.archived('Node archived');
    this._updatedAt = new Date();
    this._events.push(
      createNodeEvent('knowledge.node.status_changed', this._id, { to: 'archived' }),
    );
  }

  // ── Factory ─────────────────────────────────────────────────────────────

  /** Create a new KnowledgeNode */
  static create(props: {
    id: KnowledgeNodeId;
    graphId: GraphId;
    category: KnowledgeCategory;
    label: string;
    description?: string;
    metadata?: Record<string, unknown>;
    source?: KnowledgeSource;
    tags?: string[];
  }): KnowledgeNode {
    const node = new KnowledgeNode({
      id: props.id,
      graphId: props.graphId,
      category: props.category,
      label: props.label,
      description: props.description,
      metadata: props.metadata,
      source: props.source,
      tags: props.tags,
    });

    node._events.push(
      createNodeEvent('knowledge.node.created', props.id, {
        category: props.category.value,
        label: props.label,
      }),
    );

    return node;
  }
}
