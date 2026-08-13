// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ai
// AI Orchestrator — Domain, Types, and Application Services
// BLD-005 — AI Orchestrator
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

// Types
export type {
  CapabilityType,
  ProviderFamily,
  ProviderStatus,
  ProviderLifecycleStage,
  ModelInfo,
  ModalityType,
  PricingInfo,
  LatencyProfile,
  AIRequestInput,
  AIResponse,
  QualityTier,
  RequestConstraints,
  SafetyLevel,
  TokenUsage,
  ResponseMetadata,
  RoutingDecision,
  RoutingStrategy,
  ProviderHealth,
  ProviderStatistics,
  CapabilityProfile,
  FailureReason,
  RetryPolicy,
  ValidationResult,
  ValidationCheck,
  PromptPipelineInput,
  PromptPipelineOutput,
  Conversation,
  ConversationMessage,
  Confidence,
  ConfidenceFactor,
  Latency,
  StreamChunk,
  SafetyCheckResult,
  SafetyViolation,
  HallucinationCheckResult,
  PolicyCheckResult,
  PolicyName,
  OrchestratorResult,
  OrchestratorError,
} from './types/index.js';

export { CAPABILITY_TYPES } from './types/index.js';

// Domain
export {
  AIRequest,
  AIRequestId,
  ProviderId,
  Capability,
  Prompt,
  CostEstimate,
  AIDomainService,
  TokenEstimationService,
  AIRequestFactory,
  AI_DOMAIN_EVENTS,
  AIRequestCreatedEvent,
  AIRequestRoutedEvent,
  AIRequestExecutionStartedEvent,
  AIRequestCompletedEvent,
  AIRequestFailedEvent,
  AIRequestFallbackEvent,
  supportedCapabilityRule,
  qualityTierRule,
  retryLimitRule,
  fallbackRule,
  costRule,
  privacyRule,
} from './domain/index.js';

export type {
  AIRequestStatus,
  AIDomainEventType,
  DomainEvent,
  AIRequestRepository,
  CreateAIRequestParams,
  RuleResult,
} from './domain/index.js';
