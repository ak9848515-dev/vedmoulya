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
