// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Services
// Barrel exports for AI Orchestrator application layer
// BLD-005 — AI Orchestrator
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

export { AIOrchestrationService } from './AIOrchestrationService.js';
export type { ProviderAdapter, AIOrchestrationOptions } from './AIOrchestrationService.js';
export { AIMapper } from './AIMapper.js';
export { AIMetrics } from './AIMetrics.js';
export type {
  OrchestrateRequestDTO,
  OrchestrateResponseDTO,
  ProviderHealthDTO,
  CapabilityProfileDTO,
  CostEstimateDTO,
  StreamingResponseDTO,
  ProviderListDTO,
  CapabilityListDTO,
  ProviderSelectionDTO,
  TokenOptimizationDTO,
  EvidenceAssessmentDTO,
  StreamEventDTO,
  StreamRunDTO,
} from './AIDTO.js';

// AI-RUNTIME-002 runtime module (intelligent routing, EI-003 context
// optimization, prompt caching, structured output, evidence-first, RAG port).
export {
  ProviderRoutingAdvisor,
  ModelSelectionIntelligence,
  ContextOptimizer,
  PromptCacheManager,
  StructuredOutputValidator,
  EvidenceEvaluator,
  AIObservability,
  NoopAIObservabilityExporter,
  TestAIObservabilityExporter,
  OtelAIObservabilityExporter,
  LangfuseAIObservabilityExporter,
  redactSecrets,
  truncatePayload,
  ToolRegistry,
  ToolRateLimiter,
  ToolAuthorizationError,
  ToolRateLimitError,
  ToolTimeoutError,
  ECHO_TOOL,
  CURRENT_TIME_TOOL,
  CALCULATOR_TOOL,
  evaluateArithmetic,
  registerSafeTools,
} from './runtime/index.js';
export type {
  ModelSelectionInput,
  ModelSelectionResult,
  ProviderIntelligencePort,
  ProviderCandidateIntelligence,
  ProviderModelIntelligence,
  ExecutionStrategyPort,
  ProviderSelectionExplanation,
  ContextSection,
  ContextOptimizationInput,
  TokenOptimizationResult,
  OptimizationStage,
  OptimizationStageTokens,
  PromptCacheEntry,
  PromptCacheOptions,
  StructuredOutputSchema,
  StructuredFieldDescriptor,
  StructuredFieldType,
  StructuredOutputResult,
  EvidenceState,
  EvidenceItem,
  EvidenceAssessment,
  EvidenceEvaluationOptions,
  ContextSelectionExplanation,
  RagRetrievalPort,
  ToolDefinition,
  ToolSchema,
  ToolPropertySchema,
  ToolCapability,
  ToolRequest,
  ToolResult,
  ToolAuditEvent,
  ToolRegistryOptions,
  ToolAuthorizationContext,
  ToolExecutionContext,
  AISpan,
  AIObservabilityExporter,
  AIObservabilityOptions,
  PayloadCapturePolicy,
  OtelBridge,
  LangfuseExporterOptions,
} from './runtime/index.js';
