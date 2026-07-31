// ──────────────────────────────────────────────────────────────────
// VedMoulya — AIRequest Entity (Aggregate Root)
// Core domain entity representing an AI provider request
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import { AIRequestId } from '../value-objects/AIRequestId.js';
import { Capability } from '../value-objects/Capability.js';
import { Prompt } from '../value-objects/Prompt.js';
import { TokenUsage } from '../value-objects/TokenUsage.js';
import { CostEstimate } from '../value-objects/CostEstimate.js';
import { ProviderId } from '../value-objects/ProviderId.js';
import type { QualityTier, AIResponse, FailureReason } from '../../types/index.js';

export type AIRequestStatus =
  'pending' | 'routing' | 'executing' | 'completed' | 'failed' | 'fallback';

export class AIRequest {
  private _status: AIRequestStatus;
  private _response: AIResponse | null = null;
  private _failureReason: FailureReason | null = null;
  private _selectedProvider: ProviderId | null = null;
  private _attempts: number = 0;
  private _tokenUsage: TokenUsage | null = null;
  private readonly _costEstimate: CostEstimate | null = null;
  private _startedAt: Date | null = null;
  private _completedAt: Date | null = null;
  private _domainEvents: DomainEvent[] = [];

  private constructor(
    public readonly id: AIRequestId,
    public readonly capability: Capability,
    public readonly prompt: Prompt,
    public readonly qualityTier: QualityTier,
    public readonly userId: string | null,
    public readonly conversationId: string | null,
    public readonly constraints: Record<string, unknown>,
    public readonly metadata: Record<string, unknown>,
    public readonly createdAt: Date,
  ) {
    this._status = 'pending';
  }

  static create(params: {
    id?: AIRequestId;
    capability: Capability;
    prompt: Prompt;
    qualityTier: QualityTier;
    userId?: string;
    conversationId?: string;
    constraints?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): AIRequest {
    const request = new AIRequest(
      params.id ?? AIRequestId.create(),
      params.capability,
      params.prompt,
      params.qualityTier,
      params.userId ?? null,
      params.conversationId ?? null,
      params.constraints ?? {},
      params.metadata ?? {},
      new Date(),
    );
    request.addDomainEvent(new AIRequestCreatedEvent(request.id));
    return request;
  }

  // ── Status ──────────────────────────────────────────────────────────────

  get status(): AIRequestStatus {
    return this._status;
  }
  get response(): AIResponse | null {
    return this._response;
  }
  get failureReason(): FailureReason | null {
    return this._failureReason;
  }
  get selectedProvider(): ProviderId | null {
    return this._selectedProvider;
  }
  get attempts(): number {
    return this._attempts;
  }
  get tokenUsage(): TokenUsage | null {
    return this._tokenUsage;
  }
  get costEstimate(): CostEstimate | null {
    return this._costEstimate;
  }
  get startedAt(): Date | null {
    return this._startedAt;
  }
  get completedAt(): Date | null {
    return this._completedAt;
  }
  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  // ── Behavior ────────────────────────────────────────────────────────────

  assignProvider(providerId: ProviderId): void {
    if (this._status !== 'pending') {
      throw new Error('Cannot assign provider to non-pending request');
    }
    this._selectedProvider = providerId;
    this._status = 'routing';
    this.addDomainEvent(new AIRequestRoutedEvent(this.id, providerId));
  }

  startExecution(): void {
    if (this._status !== 'routing') {
      throw new Error('Cannot start execution for non-routing request');
    }
    this._status = 'executing';
    this._startedAt = new Date();
    this._attempts++;
    this.addDomainEvent(new AIRequestExecutionStartedEvent(this.id));
  }

  complete(response: AIResponse): void {
    if (this._status !== 'executing') {
      throw new Error('Cannot complete non-executing request');
    }
    this._response = response;
    this._status = 'completed';
    this._completedAt = new Date();
    this._tokenUsage = TokenUsage.create(response.tokenUsage.input, response.tokenUsage.output);
    this.addDomainEvent(new AIRequestCompletedEvent(this.id, response));
  }

  fail(reason: FailureReason, details?: string): void {
    this._status = 'failed';
    this._failureReason = reason;
    this._completedAt = new Date();
    this.addDomainEvent(new AIRequestFailedEvent(this.id, reason, details));
  }

  fallback(providerId: ProviderId): void {
    if (this._status !== 'failed') {
      throw new Error('Can only fallback from failed request');
    }
    this._selectedProvider = providerId;
    this._status = 'routing';
    this._failureReason = null;
    this.addDomainEvent(new AIRequestFallbackEvent(this.id, providerId));
  }

  isRetryable(): boolean {
    const retryableReasons: FailureReason[] = ['timeout', 'rate_limited', 'provider_unavailable'];
    return (
      this._failureReason !== null &&
      retryableReasons.includes(this._failureReason) &&
      this._attempts < 3
    );
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }
}

// ── Domain Events ──────────────────────────────────────────────────────────

export interface DomainEvent {
  readonly eventType: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
}

export class AIRequestCreatedEvent implements DomainEvent {
  readonly eventType = 'ai.request.created';
  readonly occurredAt = new Date();
  public readonly aggregateId: string;
  constructor(aiRequestId: AIRequestId) {
    this.aggregateId = aiRequestId.value;
  }
}

export class AIRequestRoutedEvent implements DomainEvent {
  readonly eventType = 'ai.request.routed';
  readonly occurredAt = new Date();
  public readonly aggregateId: string;
  public readonly providerId: string;
  constructor(aiRequestId: AIRequestId, providerId: ProviderId) {
    this.aggregateId = aiRequestId.value;
    this.providerId = providerId.value;
  }
}

export class AIRequestExecutionStartedEvent implements DomainEvent {
  readonly eventType = 'ai.request.execution_started';
  readonly occurredAt = new Date();
  public readonly aggregateId: string;
  constructor(aiRequestId: AIRequestId) {
    this.aggregateId = aiRequestId.value;
  }
}

export class AIRequestCompletedEvent implements DomainEvent {
  readonly eventType = 'ai.request.completed';
  readonly occurredAt = new Date();
  public readonly aggregateId: string;
  public readonly response: AIResponse;
  constructor(aiRequestId: AIRequestId, response: AIResponse) {
    this.aggregateId = aiRequestId.value;
    this.response = response;
  }
}

export class AIRequestFailedEvent implements DomainEvent {
  readonly eventType = 'ai.request.failed';
  readonly occurredAt = new Date();
  public readonly aggregateId: string;
  public readonly reason: FailureReason;
  public readonly details?: string;
  constructor(aiRequestId: AIRequestId, reason: FailureReason, details?: string) {
    this.aggregateId = aiRequestId.value;
    this.reason = reason;
    this.details = details;
  }
}

export class AIRequestFallbackEvent implements DomainEvent {
  readonly eventType = 'ai.request.fallback';
  readonly occurredAt = new Date();
  public readonly aggregateId: string;
  public readonly providerId: string;
  constructor(aiRequestId: AIRequestId, providerId: ProviderId) {
    this.aggregateId = aiRequestId.value;
    this.providerId = providerId.value;
  }
}
