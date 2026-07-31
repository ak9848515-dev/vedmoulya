// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Domain: Memory
// ARC-003/ARC-004 — Core entity in the Memory Engine
// Memory is NOT Knowledge — memory stores experience, observation,
// reflection, and context. Knowledge Graph remains the semantic truth.
// ──────────────────────────────────────────────────────────────────

import type { MemoryId } from '../value-objects/MemoryId.js';
import { MemoryCategory } from '../value-objects/MemoryCategory.js';
import { MemoryImportance } from '../value-objects/MemoryImportance.js';
import { MemoryConfidence } from '../value-objects/MemoryConfidence.js';
import { MemoryStrength } from '../value-objects/MemoryStrength.js';
import { MemoryFreshness } from '../value-objects/MemoryFreshness.js';
import { MemoryState } from '../value-objects/MemoryState.js';
import { MemorySource } from '../value-objects/MemorySource.js';
import { MemoryVersion } from '../value-objects/MemoryVersion.js';
import { MemoryRetentionPolicy } from '../value-objects/MemoryRetentionPolicy.js';
import type { MemoryEvent } from '../events/MemoryEvent.js';
import { createMemoryEvent } from '../events/MemoryEvent.js';
import type { EntityStatus } from '@vedmoulya/core';

/**
 * Memory — the fundamental entity in the Memory Engine.
 * Memory stores experiential data: observations, experiences,
 * reflections, context, and history.
 *
 * Memory REFERS to Knowledge Graph entities but NEVER duplicates them.
 * Knowledge Graph is the single source of semantic truth.
 */
export class Memory {
  private readonly _id: MemoryId;
  private _category: MemoryCategory;
  private _title: string;
  private _content: string;
  private _importance: MemoryImportance;
  private _confidence: MemoryConfidence;
  private _strength: MemoryStrength;
  private _freshness: MemoryFreshness;
  private _state: MemoryState;
  private readonly _source: MemorySource;
  private _version: MemoryVersion;
  private _retentionPolicy: MemoryRetentionPolicy;
  private _entityStatus: EntityStatus;
  private _knowledgeNodeId?: string; // Reference to Knowledge Graph node (never duplicate)
  private _metadata: Record<string, unknown>;
  private _tags: string[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _lastRecalledAt?: Date;
  private readonly _events: MemoryEvent[] = [];

  constructor(props: {
    id: MemoryId;
    category: MemoryCategory;
    title: string;
    content: string;
    importance?: MemoryImportance;
    confidence?: MemoryConfidence;
    strength?: MemoryStrength;
    freshness?: MemoryFreshness;
    state?: MemoryState;
    source?: MemorySource;
    version?: MemoryVersion;
    retentionPolicy?: MemoryRetentionPolicy;
    entityStatus?: EntityStatus;
    knowledgeNodeId?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
    createdAt?: Date;
    updatedAt?: Date;
    lastRecalledAt?: Date;
  }) {
    this._id = props.id;
    this._category = props.category;
    this._title = props.title;
    this._content = props.content;
    this._importance = props.importance ?? MemoryImportance.medium();
    this._confidence = props.confidence ?? MemoryConfidence.medium();
    this._strength = props.strength ?? MemoryStrength.initial();
    this._freshness = props.freshness ?? MemoryFreshness.initial();
    this._state = props.state ?? MemoryState.active();
    this._source = props.source ?? MemorySource.systemGenerated('memory creation');
    this._version = props.version ?? MemoryVersion.initial();
    this._retentionPolicy = props.retentionPolicy ?? MemoryRetentionPolicy.shortTerm();
    this._entityStatus = props.entityStatus ?? 'active';
    this._knowledgeNodeId = props.knowledgeNodeId;
    this._metadata = props.metadata ?? {};
    this._tags = props.tags ?? [];
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
    this._lastRecalledAt = props.lastRecalledAt;
  }

  // ── Getters ─────────────────────────────────────────────────────────────

  get id(): MemoryId {
    return this._id;
  }
  get category(): MemoryCategory {
    return this._category;
  }
  get title(): string {
    return this._title;
  }
  get content(): string {
    return this._content;
  }
  get importance(): MemoryImportance {
    return this._importance;
  }
  get confidence(): MemoryConfidence {
    return this._confidence;
  }
  get strength(): MemoryStrength {
    return this._strength;
  }
  get freshness(): MemoryFreshness {
    return this._freshness;
  }
  get state(): MemoryState {
    return this._state;
  }
  get source(): MemorySource {
    return this._source;
  }
  get version(): MemoryVersion {
    return this._version;
  }
  get retentionPolicy(): MemoryRetentionPolicy {
    return this._retentionPolicy;
  }
  get entityStatus(): EntityStatus {
    return this._entityStatus;
  }
  get knowledgeNodeId(): string | undefined {
    return this._knowledgeNodeId;
  }
  get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }
  get tags(): readonly string[] {
    return Object.freeze([...this._tags]);
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get lastRecalledAt(): Date | undefined {
    return this._lastRecalledAt;
  }

  /** Drain and return all pending domain events */
  pullEvents(): MemoryEvent[] {
    const events = [...this._events];
    this._events.length = 0;
    return events;
  }

  // ── Behaviour ───────────────────────────────────────────────────────────

  /** Update memory content and metadata */
  update(title: string, content: string): void {
    this._title = title;
    this._content = content;
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
    this._events.push(createMemoryEvent('memory.updated', this._id, { title, content }));
  }

  /** Recall the memory — strengthens retrieval and refreshes freshness */
  recall(): void {
    this._strength = this._strength.successfulRecall();
    this._freshness = this._freshness.recall();
    this._state = MemoryState.recalled();
    this._lastRecalledAt = new Date();
    this._updatedAt = new Date();
    this._version = this._version.bumpPatch();
    this._events.push(createMemoryEvent('memory.recalled', this._id, {}));
  }

  /** Fail to recall — weakens retrieval strength */
  failedRecall(): void {
    this._strength = this._strength.failedRecall();
    this._state = MemoryState.decaying('Failed recall');
    this._updatedAt = new Date();
    this._events.push(createMemoryEvent('memory.recalled', this._id, { success: false }));
  }

  /** Increase importance based on relevance */
  increaseImportance(delta: number): void {
    this._importance = this._importance.boost(delta);
    this._updatedAt = new Date();
  }

  /** Decrease importance due to decay */
  decreaseImportance(delta: number): void {
    this._importance = this._importance.reduce(delta);
    this._updatedAt = new Date();
  }

  /** Strengthen confidence with corroborating evidence */
  strengthenConfidence(amount: number): void {
    this._confidence = this._confidence.strengthen(amount);
    this._updatedAt = new Date();
  }

  /** Weaken confidence due to contradictory evidence */
  weakenConfidence(amount: number): void {
    this._confidence = this._confidence.weaken(amount);
    this._updatedAt = new Date();
  }

  /** Apply decay based on elapsed time */
  applyDecay(elapsedHours: number): void {
    this._strength = this._strength.decay(elapsedHours);
    if (this._strength.isWeak() && this._state.isActive) {
      this._state = MemoryState.decaying('Strength below threshold');
    }
    this._updatedAt = new Date();
  }

  /** Link this memory to a Knowledge Graph node */
  linkToKnowledgeNode(knowledgeNodeId: string): void {
    this._knowledgeNodeId = knowledgeNodeId;
    this._version = this._version.bumpMinor();
    this._updatedAt = new Date();
    this._events.push(createMemoryEvent('memory.knowledge_linked', this._id, { knowledgeNodeId }));
  }

  /** Unlink from Knowledge Graph node */
  unlinkFromKnowledgeNode(): void {
    const previousId = this._knowledgeNodeId;
    this._knowledgeNodeId = undefined;
    this._version = this._version.bumpMinor();
    this._updatedAt = new Date();
    this._events.push(
      createMemoryEvent('memory.knowledge_unlinked', this._id, { previousNodeId: previousId }),
    );
  }

  /** Merge another memory into this one */
  merge(other: Memory): void {
    this._content = `${this._content}\n\n---\n\n${other._content}`;
    this._importance =
      this._importance.score >= other._importance.score ? this._importance : other._importance;
    this._confidence =
      this._confidence.score >= other._confidence.score ? this._confidence : other._confidence;
    this._tags = [...new Set([...this._tags, ...other._tags])];
    this._version = this._version.bumpMinor();
    this._updatedAt = new Date();
    this._events.push(createMemoryEvent('memory.merged', this._id, { mergedId: other._id }));
  }

  /** Change the memory's category */
  changeCategory(category: MemoryCategory): void {
    this._category = category;
    this._version = this._version.bumpMinor();
    this._updatedAt = new Date();
  }

  /** Update retention policy */
  changeRetentionPolicy(policy: MemoryRetentionPolicy): void {
    this._retentionPolicy = policy;
    this._updatedAt = new Date();
  }

  /** Archive the memory */
  archive(reason?: string): void {
    this._state = MemoryState.archived(reason);
    this._entityStatus = 'archived';
    this._updatedAt = new Date();
    this._events.push(createMemoryEvent('memory.archived', this._id, { reason }));
  }

  /** Restore from archive */
  restore(): void {
    this._state = MemoryState.active();
    this._entityStatus = 'active';
    this._updatedAt = new Date();
    this._events.push(createMemoryEvent('memory.restored', this._id, {}));
  }

  /** Forget the memory (permanent deletion flag) */
  forget(reason?: string): void {
    this._state = MemoryState.forgotten(reason);
    this._entityStatus = 'archived';
    this._updatedAt = new Date();
    this._events.push(createMemoryEvent('memory.forgotten', this._id, { reason }));
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

  /** Update metadata */
  updateMetadata(metadata: Record<string, unknown>): void {
    this._metadata = { ...this._metadata, ...metadata };
    this._updatedAt = new Date();
  }

  // ── Factory ─────────────────────────────────────────────────────────────

  /** Create a new Memory */
  static create(props: {
    id: MemoryId;
    category: MemoryCategory;
    title: string;
    content: string;
    importance?: MemoryImportance;
    confidence?: MemoryConfidence;
    source?: MemorySource;
    knowledgeNodeId?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    retentionPolicy?: MemoryRetentionPolicy;
  }): Memory {
    const memory = new Memory({
      id: props.id,
      category: props.category,
      title: props.title,
      content: props.content,
      importance: props.importance,
      confidence: props.confidence,
      source: props.source,
      knowledgeNodeId: props.knowledgeNodeId,
      tags: props.tags,
      metadata: props.metadata,
      retentionPolicy: props.retentionPolicy,
    });

    memory._events.push(
      createMemoryEvent('memory.created', props.id, {
        category: props.category.value,
        title: props.title,
      }),
    );

    return memory;
  }
}
