// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Domain: Decision (Aggregate Root)
// ARC-003/ARC-004 — Core entity in the Decision Intelligence Engine
// Decision Engine owns reasoning — AI Orchestrator provides AI only.
// Knowledge Graph owns semantic truth. Memory Engine owns history.
// ──────────────────────────────────────────────────────────────────

import type { DecisionId } from '../value-objects/DecisionId.js';
import { DecisionStatus, type DecisionStatusValue } from '../value-objects/DecisionStatus.js';
import { DecisionPriority } from '../value-objects/DecisionPriority.js';
import { DecisionConfidence } from '../value-objects/DecisionConfidence.js';
import { DecisionVersion } from '../value-objects/DecisionVersion.js';
import { DecisionScore } from '../value-objects/DecisionScore.js';
import { DecisionRisk } from '../value-objects/DecisionRisk.js';
import { DecisionOpportunity } from '../value-objects/DecisionOpportunity.js';
import { DecisionConstraint } from '../value-objects/DecisionConstraint.js';
import { DecisionReasoning } from '../value-objects/DecisionReasoning.js';
import { DecisionOutcome } from '../value-objects/DecisionOutcome.js';
import type { DecisionEvent } from '../events/DecisionEvent.js';
import { createDecisionEvent } from '../events/DecisionEvent.js';

// ── Supporting Types ──────────────────────────────────────────────────────

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  score?: DecisionScore;
  risk?: DecisionRisk;
  opportunity?: DecisionOpportunity;
  pros: string[];
  cons: string[];
  estimatedEffort?: string;
  estimatedCost?: string;
}

export interface DecisionRequest {
  requester: string;
  reason: string;
  context: string;
  urgency?: string;
  deadline?: Date;
}

export interface DecisionEvidence {
  id: string;
  type: 'knowledge' | 'memory' | 'data' | 'expert_opinion' | 'research' | 'experiment';
  source: string;
  content: string;
  relevanceScore: number; // 0–1
  timestamp: Date;
}

export type DecisionCategory =
  | 'strategic'
  | 'tactical'
  | 'operational'
  | 'technical'
  | 'business'
  | 'career'
  | 'learning'
  | 'personal';

export type DecisionInitiator = 'user' | 'system' | 'ai_orchestrator' | 'scheduled' | 'external';

/**
 * Decision — the aggregate root of the Decision Intelligence Engine.
 *
 * Every decision must be:
 * - Explainable (recorded reasoning, assumptions, confidence)
 * - Traceable (versioned, timestamped, linked to evidence)
 * - Observable (events emitted for every state change)
 *
 * Decision Engine owns reasoning. AI Orchestrator provides AI capabilities only.
 */
export class Decision {
  private readonly _id: DecisionId;
  private _title: string;
  private _description: string;
  private readonly _category: DecisionCategory;
  private _status: DecisionStatus;
  private _priority: DecisionPriority;
  private _confidence: DecisionConfidence;
  private _version: DecisionVersion;
  private readonly _initiator: DecisionInitiator;

  // Decision components
  private readonly _request?: DecisionRequest;
  private _options: DecisionOption[];
  private _selectedOptionId?: string;
  private _evidence: DecisionEvidence[];
  private _constraints: DecisionConstraint[];
  private _reasoning?: DecisionReasoning;
  private _outcome?: DecisionOutcome;

  // Knowledge Graph & Memory references (never duplicate)
  private _knowledgeNodeIds: string[];
  private _memoryIds: string[];

  // Metadata
  private _tags: string[];
  private _metadata: Record<string, unknown>;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _completedAt?: Date;

  // Events
  private readonly _events: DecisionEvent[] = [];

  constructor(params: {
    id: DecisionId;
    title: string;
    description: string;
    category: DecisionCategory;
    status?: DecisionStatus;
    priority?: DecisionPriority;
    confidence?: DecisionConfidence;
    version?: DecisionVersion;
    initiator?: DecisionInitiator;
    request?: DecisionRequest;
    options?: DecisionOption[];
    evidence?: DecisionEvidence[];
    constraints?: DecisionConstraint[];
    reasoning?: DecisionReasoning;
    knowledgeNodeIds?: string[];
    memoryIds?: string[];
    tags?: string[];
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    updatedAt?: Date;
    completedAt?: Date;
  }) {
    this._id = params.id;
    this._title = params.title;
    this._description = params.description;
    this._category = params.category;
    this._status = params.status ?? DecisionStatus.requested();
    this._priority = params.priority ?? DecisionPriority.medium();
    this._confidence = params.confidence ?? DecisionConfidence.unknown();
    this._version = params.version ?? DecisionVersion.initial();
    this._initiator = params.initiator ?? 'user';
    this._request = params.request;
    this._options = params.options ?? [];
    this._evidence = params.evidence ?? [];
    this._constraints = params.constraints ?? [];
    this._reasoning = params.reasoning;
    this._knowledgeNodeIds = params.knowledgeNodeIds ?? [];
    this._memoryIds = params.memoryIds ?? [];
    this._tags = params.tags ?? [];
    this._metadata = params.metadata ?? {};
    this._createdAt = params.createdAt ?? new Date();
    this._updatedAt = params.updatedAt ?? new Date();
    this._completedAt = params.completedAt;
  }

  // ── Getters ─────────────────────────────────────────────────────────────

  get id(): DecisionId {
    return this._id;
  }
  get title(): string {
    return this._title;
  }
  get description(): string {
    return this._description;
  }
  get category(): DecisionCategory {
    return this._category;
  }
  get status(): DecisionStatus {
    return this._status;
  }
  get priority(): DecisionPriority {
    return this._priority;
  }
  get confidence(): DecisionConfidence {
    return this._confidence;
  }
  get version(): DecisionVersion {
    return this._version;
  }
  get initiator(): DecisionInitiator {
    return this._initiator;
  }
  get request(): DecisionRequest | undefined {
    return this._request;
  }
  get options(): readonly DecisionOption[] {
    return Object.freeze([...this._options]);
  }
  get selectedOptionId(): string | undefined {
    return this._selectedOptionId;
  }
  get selectedOption(): DecisionOption | undefined {
    return this._options.find((o) => o.id === this._selectedOptionId);
  }
  get evidence(): readonly DecisionEvidence[] {
    return Object.freeze([...this._evidence]);
  }
  get constraints(): readonly DecisionConstraint[] {
    return Object.freeze([...this._constraints]);
  }
  get reasoning(): DecisionReasoning | undefined {
    return this._reasoning;
  }
  get outcome(): DecisionOutcome | undefined {
    return this._outcome;
  }
  get knowledgeNodeIds(): readonly string[] {
    return Object.freeze([...this._knowledgeNodeIds]);
  }
  get memoryIds(): readonly string[] {
    return Object.freeze([...this._memoryIds]);
  }
  get tags(): readonly string[] {
    return Object.freeze([...this._tags]);
  }
  get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get completedAt(): Date | undefined {
    return this._completedAt;
  }

  /** Drain and return all pending domain events */
  pullEvents(): DecisionEvent[] {
    const events = [...this._events];
    this._events.length = 0;
    return events;
  }

  // ── State Transitions ───────────────────────────────────────────────────

  private transitionTo(status: DecisionStatusValue, reason?: string): void {
    if (!this._status.canTransitionTo(status)) {
      throw new Error(`Cannot transition decision from ${this._status.toString()} to ${status}`);
    }
    this._status = DecisionStatus.fromStatus(status, reason);
    this._version = this._version.bumpMinor();
    this._updatedAt = new Date();
    this._events.push(
      createDecisionEvent('decision.status_changed', this._id, {
        from: this._status.toString(),
        to: status,
        reason,
      }),
    );
  }

  // ── Behaviour ───────────────────────────────────────────────────────────

  /** Start analyzing a decision */
  startAnalysis(): void {
    this.transitionTo('analyzing');
  }

  /** Move to evaluation with options populated */
  startEvaluation(): void {
    if (this._options.length === 0) {
      throw new Error('Cannot evaluate decision without options');
    }
    this.transitionTo('evaluating');
  }

  /** Make the decision — select an option */
  decide(optionId: string, reasoning: DecisionReasoning): void {
    const option = this._options.find((o) => o.id === optionId);
    if (!option) {
      throw new Error(`Option not found: ${optionId}`);
    }
    this._selectedOptionId = optionId;
    this._reasoning = reasoning;
    this.transitionTo('decided');
    this._events.push(
      createDecisionEvent('decision.made', this._id, {
        selectedOptionId: optionId,
        optionLabel: option.label,
      }),
    );
  }

  /** Mark as implementing */
  startImplementation(): void {
    this.transitionTo('implementing');
  }

  /** Complete the decision with outcome */
  complete(outcome: DecisionOutcome): void {
    this._outcome = outcome;
    this._completedAt = new Date();
    this.transitionTo('completed');
    this._events.push(
      createDecisionEvent('decision.completed', this._id, {
        result: outcome.result,
      }),
    );
  }

  /** Mark as reviewed */
  review(): void {
    this.transitionTo('reviewed');
  }

  /** Archive the decision */
  archive(reason?: string): void {
    this.transitionTo('archived', reason);
    this._events.push(createDecisionEvent('decision.archived', this._id, { reason }));
  }

  /** Cancel the decision */
  cancel(reason: string): void {
    this.transitionTo('cancelled', reason);
    this._events.push(createDecisionEvent('decision.cancelled', this._id, { reason }));
  }

  // ── Option Management ───────────────────────────────────────────────────

  /** Add an option */
  addOption(option: DecisionOption): void {
    if (this._options.some((o) => o.id === option.id)) {
      throw new Error(`Option already exists: ${option.id}`);
    }
    this._options = [...this._options, option];
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
    this._events.push(
      createDecisionEvent('decision.option_added', this._id, {
        optionId: option.id,
        label: option.label,
      }),
    );
  }

  /** Score an option */
  scoreOption(optionId: string, score: DecisionScore): void {
    const index = this._options.findIndex((o) => o.id === optionId);
    if (index === -1) throw new Error(`Option not found: ${optionId}`);
    const updated = [...this._options];
    updated[index] = { ...(updated[index] as DecisionOption), score };
    this._options = updated;
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
  }

  /** Assign risk to an option */
  assessRisk(optionId: string, risk: DecisionRisk): void {
    const index = this._options.findIndex((o) => o.id === optionId);
    if (index === -1) throw new Error(`Option not found: ${optionId}`);
    const updated = [...this._options];
    updated[index] = { ...(updated[index] as DecisionOption), risk };
    this._options = updated;
    this._updatedAt = new Date();
  }

  /** Assign opportunity to an option */
  assessOpportunity(optionId: string, opportunity: DecisionOpportunity): void {
    const index = this._options.findIndex((o) => o.id === optionId);
    if (index === -1) throw new Error(`Option not found: ${optionId}`);
    const updated = [...this._options];
    updated[index] = { ...(updated[index] as DecisionOption), opportunity };
    this._options = updated;
    this._updatedAt = new Date();
  }

  /** Remove an option */
  removeOption(optionId: string): void {
    this._options = this._options.filter((o) => o.id !== optionId);
    if (this._selectedOptionId === optionId) this._selectedOptionId = undefined;
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
  }

  /** Get ranked options by score (highest first) */
  getRankedOptions(): DecisionOption[] {
    return [...this._options]
      .filter((o) => o.score)
      .sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0));
  }

  /** Detect conflicting options (same pros/cons overlap) */
  detectConflicts(): Array<{ optionA: string; optionB: string; reason: string }> {
    const conflicts: Array<{ optionA: string; optionB: string; reason: string }> = [];
    for (let i = 0; i < this._options.length; i++) {
      for (let j = i + 1; j < this._options.length; j++) {
        const a = this._options[i] as DecisionOption;
        const b = this._options[j] as DecisionOption;
        const sharedPros = a.pros.filter((p) => b.pros.includes(p));
        if (sharedPros.length > 0) {
          conflicts.push({
            optionA: a.id,
            optionB: b.id,
            reason: `Shared advantages: ${sharedPros.join(', ')}`,
          });
        }
      }
    }
    return conflicts;
  }

  // ── Evidence Management ────────────────────────────────────────────────

  /** Add evidence */
  addEvidence(evidence: DecisionEvidence): void {
    this._evidence = [...this._evidence, evidence];
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
  }

  // ── Constraint Management ───────────────────────────────────────────────

  /** Add a constraint */
  addConstraint(constraint: DecisionConstraint): void {
    this._constraints = [...this._constraints, constraint];
    this._updatedAt = new Date();
  }

  /** Evaluate constraints against all options — returns options that violate hard constraints */
  evaluateConstraints(): Array<{ optionId: string; violated: DecisionConstraint[] }> {
    return this._options.map((option) => {
      const violated = this._constraints.filter(
        (c) => c.isHard && !this.meetsConstraint(option, c),
      );
      return { optionId: option.id, violated };
    });
  }

  private meetsConstraint(option: DecisionOption, constraint: DecisionConstraint): boolean {
    // Simple constraint evaluation — can be extended with specific constraint logic
    switch (constraint.type) {
      case 'must':
      case 'requirement':
        return option.pros.some((p) =>
          p.toLowerCase().includes(constraint.description.toLowerCase()),
        );
      case 'must_not':
        return !option.cons.some((c) =>
          c.toLowerCase().includes(constraint.description.toLowerCase()),
        );
      default:
        return true; // Soft constraints don't block
    }
  }

  // ── Knowledge Graph & Memory Integration ────────────────────────────────

  /** Link to a Knowledge Graph node (never duplicate knowledge) */
  linkKnowledgeNode(nodeId: string): void {
    if (!this._knowledgeNodeIds.includes(nodeId)) {
      this._knowledgeNodeIds = [...this._knowledgeNodeIds, nodeId];
      this._updatedAt = new Date();
      this._events.push(createDecisionEvent('decision.knowledge_linked', this._id, { nodeId }));
    }
  }

  /** Link to a Memory entry (reference only, never duplicate) */
  linkMemory(memoryId: string): void {
    if (!this._memoryIds.includes(memoryId)) {
      this._memoryIds = [...this._memoryIds, memoryId];
      this._updatedAt = new Date();
      this._events.push(createDecisionEvent('decision.memory_linked', this._id, { memoryId }));
    }
  }

  // ── Priority & Confidence ───────────────────────────────────────────────

  /** Update priority */
  updatePriority(priority: DecisionPriority): void {
    this._priority = priority;
    this._updatedAt = new Date();
  }

  /** Update confidence */
  updateConfidence(confidence: DecisionConfidence): void {
    this._confidence = confidence;
    this._updatedAt = new Date();
    this._events.push(
      createDecisionEvent('decision.confidence_updated', this._id, {
        level: confidence.level,
        score: confidence.score,
      }),
    );
  }

  /** Re-evaluate the decision — increments major version */
  reEvaluate(reason: string): void {
    this._version = this._version.bumpMajor();
    this._updatedAt = new Date();
    this._events.push(createDecisionEvent('decision.reevaluated', this._id, { reason }));
  }

  // ── Update Methods ──────────────────────────────────────────────────────

  /** Update the decision title */
  updateTitle(title: string): void {
    this._title = title;
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
  }

  /** Update the decision description */
  updateDescription(description: string): void {
    this._description = description;
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
  }

  // ── Tags & Metadata ─────────────────────────────────────────────────────

  addTag(tag: string): void {
    if (!this._tags.includes(tag)) {
      this._tags = [...this._tags, tag];
      this._updatedAt = new Date();
    }
  }

  removeTag(tag: string): void {
    this._tags = this._tags.filter((t) => t !== tag);
    this._updatedAt = new Date();
  }

  updateMetadata(data: Record<string, unknown>): void {
    this._metadata = { ...this._metadata, ...data };
    this._updatedAt = new Date();
  }

  // ── Factory ─────────────────────────────────────────────────────────────

  /** Create a new Decision */
  static create(params: {
    id: DecisionId;
    title: string;
    description: string;
    category: DecisionCategory;
    priority?: DecisionPriority;
    initiator?: DecisionInitiator;
    request?: DecisionRequest;
    knowledgeNodeIds?: string[];
    memoryIds?: string[];
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Decision {
    const decision = new Decision({
      id: params.id,
      title: params.title,
      description: params.description,
      category: params.category,
      priority: params.priority,
      initiator: params.initiator,
      request: params.request,
      knowledgeNodeIds: params.knowledgeNodeIds,
      memoryIds: params.memoryIds,
      tags: params.tags,
      metadata: params.metadata,
    });

    decision._events.push(
      createDecisionEvent('decision.created', params.id, {
        title: params.title,
        category: params.category,
        initiator: params.initiator ?? 'user',
      }),
    );

    return decision;
  }
}
