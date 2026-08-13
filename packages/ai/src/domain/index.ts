// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Domain Layer
// Barrel exports for all domain components
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

// Entities
export { AIRequest } from './entities/AIRequest.js';
export type { AIRequestStatus } from './entities/AIRequest.js';

// Value Objects
export { AIRequestId } from './value-objects/AIRequestId.js';
export { ProviderId } from './value-objects/ProviderId.js';
export { TokenUsage } from './value-objects/TokenUsage.js';
export { Capability } from './value-objects/Capability.js';
export { Prompt } from './value-objects/Prompt.js';
export { CostEstimate } from './value-objects/CostEstimate.js';

// Events
export { AI_DOMAIN_EVENTS } from './events/AIDomainEvents.js';
export type { AIDomainEventType } from './events/AIDomainEvents.js';
export {
  AIRequestCreatedEvent,
  AIRequestRoutedEvent,
  AIRequestExecutionStartedEvent,
  AIRequestCompletedEvent,
  AIRequestFailedEvent,
  AIRequestFallbackEvent,
} from './entities/AIRequest.js';
export type { DomainEvent } from './entities/AIRequest.js';

// Repository
export type { AIRequestRepository } from './repository/AIRequestRepository.js';

// Services
export { AIDomainService } from './services/AIDomainService.js';
export { TokenEstimationService } from './services/TokenEstimationService.js';

// Factory
export { AIRequestFactory } from './factory/AIRequestFactory.js';
export type { CreateAIRequestParams } from './factory/AIRequestFactory.js';

// Rules
export {
  supportedCapabilityRule,
  qualityTierRule,
  retryLimitRule,
  fallbackRule,
  costRule,
  privacyRule,
} from './rules/AIRules.js';
export type { RuleResult } from './rules/AIRules.js';
