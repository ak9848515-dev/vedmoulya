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

/**
 * Provenance of `quotaUsedPercent`.
 *
 *   'SEED'              → a registry/catalog constant. NOT a measurement:
 *                         nothing at runtime refreshes it, so it must never be
 *                         presented as the provider's account usage, remaining
 *                         balance or remaining percentage.
 *   'PROVIDER_REPORTED' → the provider itself reported usage and it was
 *                         ingested (Provider.recordHealthSample).
 * Absent ⇒ 'SEED'.
 */
export type ProviderQuotaSource = 'SEED' | 'PROVIDER_REPORTED';

/**
 * Which account-level metric a genuine provider response carried. These are
 * DISTINCT by construction and must never be conflated with each other or with
 * VedMoulya's own runtime-token measurements:
 *
 *   'ACCOUNT_TOKENS'     → tokens the provider reports were consumed by the
 *                          account over a window (usage API).
 *   'ACCOUNT_COST'       → USD the provider reports the account spent over a
 *                          window (cost/billing API).
 *   'ACCOUNT_CREDITS'    → a prepaid credit balance the provider reports for
 *                          the key/account (no window — a point-in-time balance).
 *   'BOUNDED_QUOTA_USED' → a provider-reported bounded quota consumed 0–100%
 *                          (e.g. OpenAI hard USD limit, OpenRouter credit limit).
 */
export type ProviderAccountMetric =
  'ACCOUNT_TOKENS' | 'ACCOUNT_COST' | 'ACCOUNT_CREDITS' | 'BOUNDED_QUOTA_USED';

/**
 * ONE genuine, provider-reported account metric. Persisted verbatim from a
 * provider response — provider, metric, source, retrieval timestamp, the
 * applicable window, and the value/unit. Nothing here is ever fabricated:
 * an absent metric is simply absent, never zero.
 */
export interface ProviderAccountUsageMetric {
  provider: string;
  metric: ProviderAccountMetric;
  /** The authoritative source (endpoint/path) the value came from. */
  source: string;
  /** ISO timestamp of when the response was retrieved. */
  retrievedAt: string;
  /**
   * The window the metric applies to, in epoch seconds (inclusive start,
   * exclusive end). Absent for a point-in-time balance (credits).
   */
  window?: { startEpochSec: number; endEpochSec: number };
  /** The reported numeric value. */
  value: number;
  /** Unit of `value` — 'tokens' | 'usd' | 'percent'. */
  unit: 'tokens' | 'usd' | 'percent';
  /**
   * Optional breakdown rows the provider itself reported (e.g. per model / per
   * line item). Never synthesized. */
  breakdown?: Array<{ key: string; value: number; unit: 'tokens' | 'usd' | 'percent' }>;
  /**
   * True when the provider explicitly reports the value is an unlimited / no
   * ceiling figure (e.g. OpenRouter limit === -1). An unlimited metric carries
   * no numeric value and MUST NOT become a percentage.
   */
  unlimited?: boolean;
}

/**
 * Provenance of a provider health RECORD (status / score / latency / the
 * sample counts it aggregates).
 *
 *   'SEED'     → catalog data. It is a documentation-derived estimate captured
 *                when the registry catalog was built (the catalog even stamps
 *                `lastCheckedAt` with the build time), so it is NOT a check of
 *                this deployment: no runtime request measured it and no health
 *                probe ever ran. A seeded 'healthy' must never be presented as
 *                "connected", "verified" or "checked just now".
 *   'MEASURED' → at least one health sample was written at RUNTIME through
 *                `Provider.recordHealthSample` (the executor health feedback
 *                and the provider-usage ingestor are its writers).
 * Absent ⇒ 'SEED'. Defaulting to SEED is deliberate: a record is only promoted
 * by a real runtime write, never by time passing, so every legacy or persisted
 * record stays unproven until something actually checks it.
 */
export type ProviderHealthSource = 'SEED' | 'MEASURED';

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
  /** See ProviderQuotaSource — absent means 'SEED' (never provider-reported). */
  quotaSource?: ProviderQuotaSource;
  /** See ProviderHealthSource — absent means 'SEED' (never a live check). */
  healthSource?: ProviderHealthSource;
  /**
   * The most recent GENUINE provider-reported account metrics, keyed by metric.
   * Each entry is a verbatim provider response (provider/metric/source/retrievedAt
   * /window/value). Absent key ⇒ that metric was never retrieved — the UI shows
   * "Unavailable from provider", never zero. This is the persistence home for
   * account usage/cost/credits, kept separate from VedMoulya's runtime tokens.
   */
  accountUsage?: Partial<Record<ProviderAccountMetric, ProviderAccountUsageMetric>>;
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

// ── Custom Provider Configuration (SPRINT-049) ─────────────────────────────

/** Protocol type determines how the adapter communicates with the endpoint. */
export type CustomProviderProtocol =
  | 'openai-compatible' // OpenAI Chat Completions API compatible
  | 'anthropic-compatible' // Anthropic Messages API compatible
  | 'google-gemini' // Google generativelanguage API
  | 'ollama' // Ollama local API
  | 'custom'; // Custom protocol (future extension)

/** Authentication method for custom providers. */
export type CustomProviderAuthMethod =
  | 'api-key' // Bearer token / API key
  | 'oauth2' // OAuth 2.0 bearer token
  | 'basic' // HTTP Basic auth
  | 'none'; // No authentication (e.g., local endpoints)

/** Deployment type for custom providers. */
export type CustomProviderDeployment = 'cloud' | 'local' | 'enterprise';

/**
 * Configuration for a custom (user-defined) AI provider.
 * Stored alongside the Provider entity when family === 'custom'.
 * SECURITY: apiKey is server-side only — never exposed to the browser.
 */
export interface CustomProviderConfig {
  /** Human-readable category label. */
  category: 'Cloud AI' | 'Local AI' | 'Enterprise AI' | 'OpenAI-compatible' | 'Custom';
  /** Protocol for adapter creation. */
  protocol: CustomProviderProtocol;
  /** Authentication method. */
  authMethod: CustomProviderAuthMethod;
  /** Base URL of the API endpoint (e.g., https://api.example.com/v1). */
  endpointUrl: string;
  /** API key or credential. SERVER-SIDE ONLY — never logged, never exposed to browser. */
  apiKey?: string;
  /** Default model id to use when none is specified. */
  defaultModelId?: string;
  /** Deployment type. */
  deployment: CustomProviderDeployment;
  /** Whether the provider is currently enabled. */
  enabled: boolean;
  /** Whether this provider is eligible to be the primary provider. */
  primaryEligible: boolean;
  /** Current connection status (honest — never fabricated). */
  connectionStatus: 'untested' | 'connected' | 'failed' | 'testing';
  /** Last connection test result message. */
  connectionMessage?: string;
  /** Timestamp of last connection test. */
  lastTestedAt?: string;
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
