// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI DTOs
// Data transfer objects for the AI Orchestrator
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import type {
  CapabilityType,
  QualityTier,
  TokenUsage,
  ValidationResult,
  RoutingDecision,
  ProviderFamily,
} from '@vedmoulya/ai';

// ── Request DTOs ───────────────────────────────────────────────────────────

export interface OrchestrateRequestDTO {
  capability: CapabilityType;
  userInput: string;
  userId?: string;
  conversationId?: string;
  qualityTier: QualityTier;
  constraints?: {
    maxOutputTokens?: number;
    /** Hard input-token budget enforced deterministically before any provider call. */
    maxInputTokens?: number;
    outputFormat?: 'text' | 'json' | 'markdown' | 'code';
    maxLatencyMs?: number;
    maxCost?: number;
  };
  context?: {
    systemPrompt?: string;
    identityContext?: string;
    knowledgeContext?: string;
    memoryContext?: string;
    decisionContext?: string;
    executionContext?: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  /** Production RAG retrieval (AI-RUNTIME-002): retrieved chunks are appended
   *  to the knowledge context before optimization and execution. */
  ragQuery?: {
    collection: string;
    query: string;
    topK?: number;
  };
  /** Evidence-First AI (AI-RUNTIME-002 Phase 8): when true, the task MUST be
   *  grounded in retrieved evidence. The runtime evaluates groundedness and
   *  ABSTAINS (no provider call) when evidence is insufficient or
   *  irreconcilably conflicting — it never fabricates a grounded answer. */
  groundingRequired?: boolean;
  /** Schema-validated structured output (AI-RUNTIME-002). */
  structuredSchema?: Record<string, unknown>;
  /** Explicitly enable the EI-003 input-optimization pipeline. */
  enableOptimization?: boolean;
}

// ── Response DTOs ──────────────────────────────────────────────────────────

export interface OrchestrateResponseDTO {
  content: string;
  provider: string;
  model: string;
  confidence: number;
  qualityScore: number;
  latency: number;
  cost: number;
  tokenUsage: TokenUsage;
  validation: ValidationResult;
  traceId: string;
  routingDecision: RoutingDecision;
  /** Provider selection explanation (AI-RUNTIME-002, when the advisor is wired). */
  providerSelection?: ProviderSelectionDTO;
  /** Input-optimization economics (AI-RUNTIME-002, when optimization ran). */
  tokenOptimization?: TokenOptimizationDTO;
  /** Evidence-First assessment (AI-RUNTIME-002 Phase 8, when RAG ran). */
  evidence?: EvidenceAssessmentDTO;
  /** True when the runtime abstained instead of calling a provider. */
  abstained?: boolean;
  /** AI-SELECT per-item selection explanation (AI-RUNTIME-002 Phase 3, when optimization ran). */
  contextSelection?: ContextSelectionExplanationDTO[];
}

// ── AI-RUNTIME-002 runtime contracts ────────────────────────────────────────

export interface ProviderSelectionDTO {
  capability: string;
  selected: { providerId: string; modelId: string; reasons: string[]; score: number };
  fallback: Array<{ providerId: string; modelId: string; reasons: string[]; score: number }>;
  candidatesConsidered: Array<{ providerId: string; score: number; excluded: boolean }>;
  strategy: string;
  estimatedInputTokens: number;
  estimatedCost: number;
  evaluatedAt: string;
}

export interface TokenOptimizationDTO {
  originalTokens: number;
  rankedTokens: number;
  filteredTokens: number;
  compressedTokens: number;
  finalTokens: number;
  tokensRemoved: number;
  compressionRatio: number;
  itemsRemoved: number;
  strategyUsed: string;
  estimatedInputCost: number;
  estimatedOutputCost: number;
  estimatedTotalCost: number;
  budgetBreached: boolean;
}

export interface EvidenceAssessmentDTO {
  state: string;
  evidenceCount: number;
  availability: number;
  groundedness: number;
  relevance: number;
  sourceAuthority: number;
  sourceFreshness: number;
  conflictingEvidence: boolean;
  reasons: string[];
}

export interface ContextSelectionExplanationDTO {
  itemId: string;
  source: string;
  category: string;
  content: string;
  selected: boolean;
  score: number;
  tokens: number;
  reasons: string[];
}

/** One stage of a streamed run (server-side SDK streaming, collected DTO). */
export interface StreamEventDTO {
  type: 'status' | 'content' | 'done' | 'error';
  stage?: 'thinking' | 'preparing_context' | 'selecting_model' | 'streaming' | 'validating';
  content?: string;
  data?: Record<string, unknown>;
}

export interface StreamRunDTO {
  traceId: string;
  events: StreamEventDTO[];
  final: OrchestrateResponseDTO;
}

export interface ProviderHealthDTO {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unstable' | 'down';
  latency: number;
  errorRate: number;
  isRateLimited: boolean;
  lastChecked: string;
}

export interface CapabilityProfileDTO {
  capability: CapabilityType;
  providers: Array<{
    providerId: string;
    qualityScore: number;
    averageLatency: number;
    averageCost: number;
    contextWindow: number;
  }>;
  bestProvider: string;
  fallbackProviders: string[];
}

export interface CostEstimateDTO {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  currency: string;
  providerId: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface StreamingResponseDTO {
  type: 'content' | 'metadata' | 'error' | 'done';
  data: unknown;
  traceId: string;
}

// ── List DTOs ──────────────────────────────────────────────────────────────

export interface ProviderListDTO {
  providers: Array<{
    id: string;
    family: ProviderFamily;
    status: string;
    capabilities: CapabilityType[];
    models: string[];
  }>;
  total: number;
}

export interface CapabilityListDTO {
  capabilities: Array<{
    type: CapabilityType;
    providerCount: number;
    bestProvider: string;
  }>;
  total: number;
}
