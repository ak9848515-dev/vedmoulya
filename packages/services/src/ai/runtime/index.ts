// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Runtime Module
// AI-RUNTIME-002: intelligent provider routing, EI-003 context
// optimization, prompt caching and structured-output validation —
// all consuming frozen EI contracts through narrow ports.
// ──────────────────────────────────────────────────────────────────

export { ProviderRoutingAdvisor } from './ProviderRoutingAdvisor.js';
export type {
  ProviderIntelligencePort,
  ProviderCandidateIntelligence,
  ProviderModelIntelligence,
  ExecutionStrategyPort,
  ProviderSelectionExplanation,
} from './ProviderRoutingAdvisor.js';

export { ModelSelectionIntelligence } from './ModelSelectionIntelligence.js';
export type {
  ModelSelectionInput,
  ModelSelectionResult,
  PrecisionRequirement,
  BudgetPolicy,
  TaskComplexity,
  SelectionVerdict,
} from './ModelSelectionIntelligence.js';

export { ContextOptimizer } from './ContextOptimizer.js';
export type {
  ContextSection,
  ContextOptimizationInput,
  ContextSelectionExplanation,
} from './ContextOptimizer.js';
export type {
  TokenOptimizationResult,
  OptimizationStage,
  OptimizationStageTokens,
} from './TokenOptimizationResult.js';

export { PromptCacheManager } from './PromptCacheManager.js';
export type { PromptCacheEntry, PromptCacheOptions } from './PromptCacheManager.js';

export { StructuredOutputValidator } from './StructuredOutputValidator.js';
export type {
  StructuredOutputSchema,
  StructuredFieldDescriptor,
  StructuredFieldType,
  StructuredOutputResult,
} from './StructuredOutputValidator.js';

export { EvidenceEvaluator } from './EvidenceEvaluator.js';
export type {
  EvidenceState,
  EvidenceItem,
  EvidenceAssessment,
  EvidenceEvaluationOptions,
} from './EvidenceEvaluator.js';

export {
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
} from './ToolRuntime.js';
export type {
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
} from './ToolRuntime.js';

export {
  AIObservability,
  NoopAIObservabilityExporter,
  TestAIObservabilityExporter,
  OtelAIObservabilityExporter,
  LangfuseAIObservabilityExporter,
  redactSecrets,
  truncatePayload,
} from './AIObservability.js';
export type {
  AISpan,
  AIObservabilityExporter,
  AIObservabilityOptions,
  PayloadCapturePolicy,
  OtelBridge,
  LangfuseExporterOptions,
} from './AIObservability.js';

/** RAG retrieval port consumed by the orchestrator (adapter lives in the gateway). */
export interface RagRetrievalPort {
  retrieve(input: { userId: string; query: string; collection: string; topK?: number }): Promise<{
    results: Array<{
      title: string;
      content: string;
      score: number;
      /**
       * Per-document source identifier (e.g. the document sourceId). Used by
       * the evidence evaluator to detect CONFLICTING_EVIDENCE across
       * distinct sources; defaults to the collection when absent.
       */
      source?: string;
    }>;
  }>;
}
