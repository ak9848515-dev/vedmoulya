// ──────────────────────────────────────────────────────────────────
// VedMoulya — Providers: Domain Types
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// Providers are enterprise assets: discoverable, health-monitored,
// capability-mapped, costed. Business modules never see provider
// implementation details — the registry holds the intelligence.
// ──────────────────────────────────────────────────────────────────

import type {
  CapabilityType,
  ModalityType,
  ProviderFamily,
  ProviderStatus as ProviderHealthStatus,
  QualityTier,
} from '@vedmoulya/ai';

// ── Lifecycle ──────────────────────────────────────────────────────────────

export type ProviderLifecycleStatus =
  'draft' | 'testing' | 'active' | 'maintenance' | 'deprecated' | 'archived';

export const PROVIDER_LIFECYCLE_STATUSES: readonly ProviderLifecycleStatus[] = [
  'draft',
  'testing',
  'active',
  'maintenance',
  'deprecated',
  'archived',
] as const;

// ── Model ──────────────────────────────────────────────────────────────────

export interface ProviderModel {
  id: string;
  name: string;
  contextLength: number;
  maxOutputTokens: number;
  streaming: boolean;
  vision: boolean;
  functionCalling: boolean;
  embeddings: boolean;
  reasoning: boolean;
  coding: boolean;
  creativeWriting: boolean;
  translation: boolean;
  image: boolean;
  audio: boolean;
  video: boolean;
  modalities: ModalityType[];
  capabilities: CapabilityType[];
}

// ── Profiles ───────────────────────────────────────────────────────────────

export interface ProviderCostProfile {
  /** USD per 1M input tokens. */
  inputPerMillionTokens: number;
  /** USD per 1M output tokens. */
  outputPerMillionTokens: number;
  currency: string;
  tier: 'free' | 'low' | 'medium' | 'high';
}

export interface ProviderLatencyProfile {
  p50Ms: number;
  p95Ms: number;
}

export interface ProviderRateLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay: number;
  maxConcurrentRequests: number;
}

// ── Health ─────────────────────────────────────────────────────────────────

export interface ProviderHealthSnapshot {
  /** Operational status from the AI platform taxonomy. */
  status: ProviderHealthStatus;
  /** Composite health score 0–1 (weighted availability/latency/failures/quota). */
  healthScore: number;
  /** Rolling average latency in ms. */
  latencyMs: number;
  successCount: number;
  failureCount: number;
  quotaUsedPercent: number;
  rateLimitRemaining: number;
  rateLimitResetAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastCheckedAt: string;
}

// ── Capability Matrix ──────────────────────────────────────────────────────

export interface ProviderCapabilityMatrixEntry {
  capability: CapabilityType;
  /** Expected quality score 0–1. */
  quality: number;
  /** Expected cost per invocation USD. */
  expectedCostUsd: number;
  /** Expected p50 latency ms. */
  expectedLatencyMs: number;
  expectedInputTokens: number;
  expectedOutputTokens: number;
  /** Registry confidence 0–1. */
  confidence: number;
  /** Historical success rate 0–1. */
  historicalSuccess: number;
  qualityTier: QualityTier;
}

// ── Provider definition (input contract) ───────────────────────────────────

export interface ProviderDefinition {
  id: string;
  family: ProviderFamily;
  name: string;
  description: string;
  owner: string;
  models: ProviderModel[];
  capabilities: CapabilityType[];
  supportedModalities: ModalityType[];
  cost: ProviderCostProfile;
  latency: ProviderLatencyProfile;
  rateLimits: ProviderRateLimits;
  /** Uptime availability 0–1. */
  availability: number;
  health: ProviderHealthSnapshot;
  lifecycleStatus: ProviderLifecycleStatus;
  tags: string[];
  documentationUrl?: string;
  /** Capability → quality/cost/latency/tokens/confidence/history matrix. */
  matrix: ProviderCapabilityMatrixEntry[];
}

// ── Search ─────────────────────────────────────────────────────────────────

export interface ProviderSearchCriteria {
  query?: string;
  families?: ProviderFamily[];
  lifecycleStatuses?: ProviderLifecycleStatus[];
  capabilities?: CapabilityType[];
  modalities?: ModalityType[];
  tags?: string[];
  /** Only providers with healthScore >= this value. */
  minHealthScore?: number;
  /** Only providers with at least one model at this context length. */
  minContextLength?: number;
  /** Only providers with a feature (streaming/vision/functionCalling/embeddings). */
  feature?: 'streaming' | 'vision' | 'function_calling' | 'embeddings';
}

// ── Benchmark Dataset Definitions ───────────────────────────────────────────
// EI-002 stores the benchmark DATASET DEFINITIONS only — no benchmark is run
// here. The Provider Benchmark Engine (EI-003) executes these datasets and
// writes measured scores back into the registry's capability matrix.

export type BenchmarkDifficulty = 'basic' | 'intermediate' | 'advanced' | 'expert';

export const BENCHMARK_DIFFICULTIES: readonly BenchmarkDifficulty[] = [
  'basic',
  'intermediate',
  'advanced',
  'expert',
] as const;

export type ProviderBenchmarkCategory =
  | 'general_knowledge'
  | 'reasoning'
  | 'coding'
  | 'mathematics'
  | 'long_context'
  | 'instruction_following'
  | 'multimodal'
  | 'translation'
  | 'summarization'
  | 'creative_writing'
  | 'tool_use';

export const PROVIDER_BENCHMARK_CATEGORIES: readonly ProviderBenchmarkCategory[] = [
  'general_knowledge',
  'reasoning',
  'coding',
  'mathematics',
  'long_context',
  'instruction_following',
  'multimodal',
  'translation',
  'summarization',
  'creative_writing',
  'tool_use',
] as const;

/**
 * A benchmark dataset definition: a scenario a provider/model can be
 * evaluated against. Definitions carry expected quality/cost/latency/token
 * envelopes (registry estimates) so EI-003 can compare measured results
 * against them. No per-provider scores live here — that is the Benchmark
 * Engine's output, not this sprint's.
 */
export interface ProviderBenchmarkDefinition {
  benchmarkId: string;
  category: ProviderBenchmarkCategory;
  /** Primary capability exercised by the dataset (shared @vedmoulya/ai taxonomy). */
  capability: CapabilityType;
  scenario: string;
  difficulty: BenchmarkDifficulty;
  description: string;
  /** Expected quality score 0–1 for a strong model on this dataset. */
  expectedQuality: number;
  /** Expected total tokens consumed per run. */
  expectedTokens: number;
  /** Expected cost per run in USD (registry estimate). */
  expectedCostUsd: number;
  /** Expected p50 latency per run in ms. */
  expectedLatencyMs: number;
  /** ISO timestamp of the last revision of this definition. */
  updatedAt: string;
}
