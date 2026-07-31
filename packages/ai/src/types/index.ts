// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Domain Types
// Core type definitions for the AI Orchestrator domain
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import type { Result } from '@vedmoulya/core';

// ── Capability Types ────────────────────────────────────────────────────────

export type CapabilityType =
  | 'reasoning'
  | 'coding'
  | 'vision'
  | 'embeddings'
  | 'summarization'
  | 'classification'
  | 'translation'
  | 'speech'
  | 'image_understanding'
  | 'general_conversation';

export const CAPABILITY_TYPES: readonly CapabilityType[] = [
  'reasoning',
  'coding',
  'vision',
  'embeddings',
  'summarization',
  'classification',
  'translation',
  'speech',
  'image_understanding',
  'general_conversation',
] as const;

// ── Provider Types ─────────────────────────────────────────────────────────

export type ProviderFamily =
  'openai' | 'anthropic' | 'google' | 'deepseek' | 'openrouter' | 'ollama' | 'mock';

export type ProviderStatus = 'healthy' | 'degraded' | 'unstable' | 'down';

export type ProviderLifecycleStage =
  'discovery' | 'evaluation' | 'registration' | 'active' | 'deprecated' | 'retired' | 'archived';

// ── Model Types ────────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  providerFamily: ProviderFamily;
  version: string;
  contextWindow: number;
  maxOutputTokens: number;
  modalities: ModalityType[];
  capabilities: CapabilityType[];
  pricing: PricingInfo;
  latencyProfile: LatencyProfile;
}

export type ModalityType =
  'text-in' | 'text-out' | 'image-in' | 'image-out' | 'audio-in' | 'audio-out';

export interface PricingInfo {
  inputPerToken: number;
  outputPerToken: number;
  currency: string;
}

export interface LatencyProfile {
  p50: number;
  p95: number;
}

// ── Request/Response Types ─────────────────────────────────────────────────

export interface AIRequestInput {
  capability: CapabilityType;
  userInput: string;
  userId?: string;
  conversationId?: string;
  qualityTier: QualityTier;
  constraints?: RequestConstraints;
  requestId: string;
  metadata?: Record<string, unknown>;
}

export type QualityTier = 'premium' | 'standard' | 'economy' | 'free';

export interface RequestConstraints {
  maxOutputTokens?: number;
  maxInputTokens?: number;
  outputFormat?: 'text' | 'json' | 'markdown' | 'code';
  maxLatencyMs?: number;
  maxCost?: number;
  requiredCapabilities?: CapabilityType[];
  safetyLevel?: SafetyLevel;
}

export type SafetyLevel = 'strict' | 'moderate' | 'relaxed';

export interface AIResponse {
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
  metadata?: ResponseMetadata;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface ResponseMetadata {
  providerFamily: ProviderFamily;
  modelVersion: string;
  processingTime: number;
  contextUsed: string[];
  routingDecision: RoutingDecision;
  validationDetails: ValidationCheck[];
}

export interface RoutingDecision {
  selectedProvider: string;
  reason: string;
  alternativesConsidered: Array<{
    provider: string;
    quality: number;
    cost: number;
    latency: number;
  }>;
  strategy: RoutingStrategy;
}

export type RoutingStrategy =
  'quality-first' | 'cost-first' | 'latency-first' | 'balanced' | 'fallback';

// ── Health Types ───────────────────────────────────────────────────────────

export interface ProviderHealth {
  providerId: string;
  status: ProviderStatus;
  latency: number;
  errorRate: number;
  lastChecked: Date;
  isRateLimited: boolean;
  rateLimitRemaining: number;
  rateLimitReset: Date | null;
}

export interface ProviderStatistics {
  providerId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  totalTokens: number;
  totalCost: number;
  averageQualityScore: number;
  lastUpdated: Date;
}

// ── Capability Profile ─────────────────────────────────────────────────────

export interface CapabilityProfile {
  capability: CapabilityType;
  providers: Array<{
    providerId: string;
    qualityScore: number;
    averageLatency: number;
    averageCost: number;
    contextWindow: number;
    supportedModalities: ModalityType[];
  }>;
  bestProvider: string;
  fallbackProviders: string[];
}

// ── Failure Types ──────────────────────────────────────────────────────────

export type FailureReason =
  | 'provider_unavailable'
  | 'timeout'
  | 'rate_limited'
  | 'invalid_response'
  | 'low_confidence'
  | 'policy_violation'
  | 'quality_below_threshold'
  | 'budget_exceeded'
  | 'context_window_exceeded'
  | 'internal_error';

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableFailures: FailureReason[];
  useExponentialBackoff: boolean;
}

// ── Validation Types ───────────────────────────────────────────────────────

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  overallScore: number;
  decision: 'pass' | 'flag' | 'reject' | 'regenerate';
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  score: number;
  details?: string;
}

// ── Prompt Pipeline Types ──────────────────────────────────────────────────

export interface PromptPipelineInput {
  systemPrompt: string;
  identityContext?: string;
  knowledgeContext?: string;
  memoryContext?: string;
  decisionContext?: string;
  executionContext?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  task: string;
  constraints: string[];
  safetyInstructions: string[];
  outputSchema?: Record<string, unknown>;
  traceabilityMetadata: Record<string, string>;
}

export interface PromptPipelineOutput {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  metadata: {
    totalTokens: number;
    sections: string[];
    provider: string;
  };
}

// ── Conversation Types ─────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  userId: string;
  messages: ConversationMessage[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ── Confidence Types ───────────────────────────────────────────────────────

export interface Confidence {
  score: number;
  level: 'high' | 'medium' | 'low' | 'very_low';
  factors: ConfidenceFactor[];
}

export interface ConfidenceFactor {
  name: string;
  score: number;
  weight: number;
}

// ── Latency Types ──────────────────────────────────────────────────────────

export interface Latency {
  total: number;
  breakdown: {
    contextAssembly: number;
    promptConstruction: number;
    providerInference: number;
    responseValidation: number;
    postProcessing: number;
  };
}

// ── Streaming Types ────────────────────────────────────────────────────────

export interface StreamChunk {
  type: 'content' | 'metadata' | 'error' | 'done';
  data: unknown;
  timestamp: Date;
}

// ── Safety Types ───────────────────────────────────────────────────────────

export interface SafetyCheckResult {
  passed: boolean;
  violations: SafetyViolation[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SafetyViolation {
  type: string;
  severity: 'minor' | 'moderate' | 'critical';
  description: string;
}

// ── Hallucination Check Types ──────────────────────────────────────────────

export interface HallucinationCheckResult {
  riskLevel: 'low' | 'medium' | 'high' | 'certain';
  flaggedClaims: Array<{ claim: string; reason: string }>;
  overallScore: number;
}

// ── Policy Types ───────────────────────────────────────────────────────────

export type PolicyName =
  | 'human_first'
  | 'provider_agnostic'
  | 'privacy_first'
  | 'cost_conscious'
  | 'explainable'
  | 'secure_by_design'
  | 'quality_first'
  | 'continuous_improvement';

export interface PolicyCheckResult {
  policy: PolicyName;
  passed: boolean;
  severity: 'minor' | 'moderate' | 'critical';
  details?: string;
}

// ── Orchestrator Result ────────────────────────────────────────────────────

export type OrchestratorResult = Result<AIResponse, OrchestratorError>;

export interface OrchestratorError {
  type: FailureReason;
  message: string;
  providerId?: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}
