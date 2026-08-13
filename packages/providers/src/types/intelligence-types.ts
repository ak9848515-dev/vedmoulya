// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Intelligence Types
// EPIC-012A — AI Provider Intelligence (Phases 7–11)
//
// The intelligence layer answers three questions the registry could
// not:
//   1. WHERE did each property come from? (provenance)
//   2. WHAT kind of resource is this? (free vs paid vs local — never
//      conflated: "open source" ≠ "free API", "free model" ≠
//      "unlimited free inference")
//   3. WILL this model run on THIS machine? (hardware fit)
//
// The cardinal rule: never fabricate. Every property carries a
// provenance state; absent information is UNKNOWN, never guessed.
// ──────────────────────────────────────────────────────────────────

// ── Provenance ────────────────────────────────────────────────────

export type ProvenanceState =
  'VERIFIED' | 'PROVIDER_DECLARED' | 'MEASURED' | 'INFERRED' | 'UNKNOWN';

export const PROVENANCE_ORDER: readonly ProvenanceState[] = [
  'VERIFIED',
  'PROVIDER_DECLARED',
  'MEASURED',
  'INFERRED',
  'UNKNOWN',
] as const;

/** A single fact with its source. Never fabricated — UNKNOWN when absent. */
export interface Provenanced<T> {
  value: T | null;
  provenance: ProvenanceState;
  /** Where it came from (e.g. 'catalog', 'provider-api', 'local-discovery'). */
  source?: string;
}

// ── Resource types ────────────────────────────────────────────────

export type ModelResourceType =
  | 'LOCAL'
  | 'FREE_HOSTED'
  | 'FREE_API_QUOTA'
  | 'USER_PAID_API'
  | 'AGGREGATOR'
  | 'OPEN_MODEL'
  | 'CUSTOM_ENDPOINT'
  | 'ENTERPRISE';

export const MODEL_RESOURCE_TYPES: readonly ModelResourceType[] = [
  'LOCAL',
  'FREE_HOSTED',
  'FREE_API_QUOTA',
  'USER_PAID_API',
  'AGGREGATOR',
  'OPEN_MODEL',
  'CUSTOM_ENDPOINT',
  'ENTERPRISE',
] as const;

export interface ResourceClassification {
  resourceType: ModelResourceType;
  /** True when inference costs nothing (local or free tier/quota). */
  freeToUse: boolean;
  /** True when the model weights are open (independent of hosting cost). */
  openWeights: boolean;
  /** Zero-cost is 'free' only when both hold: no per-token charge AND no
   *  hidden quota exhaustion risk classified as paid. */
  reasons: string[];
}

// ── Model lifecycle / deprecation (EPIC-012B) ──────────────────────

/**
 * Model lifecycle/deprecation status. UNKNOWN when the source metadata
 * does not state a lifecycle — never guessed from the model name.
 * - 'active'      — present in the current registry/catalogue and usable.
 * - 'preview'     — declared preview/experimental (only when the source says so).
 * - 'deprecated'  — the source declared deprecation, or the model was known
 *                   to a previous refresh and has been removed upstream.
 * - 'unavailable' — the model is temporarily unavailable (e.g. removed from
 *                   the current refresh but not declared deprecated).
 * - 'unknown'     — lifecycle not stated by any source.
 */
export type ModelLifecycleStatus = 'active' | 'preview' | 'deprecated' | 'unavailable' | 'unknown';

export const MODEL_LIFECYCLE_STATUSES: readonly ModelLifecycleStatus[] = [
  'active',
  'preview',
  'deprecated',
  'unavailable',
  'unknown',
] as const;

// ── Model intelligence profile ────────────────────────────────────

export interface ModelIntelligence {
  modelId: string;
  name: string;
  /** Capabilities (reasoning/coding/vision/audio/tool/structured/embeddings). */
  capabilities: Provenanced<string[]>;
  contextWindow: Provenanced<number>;
  maxOutputTokens: Provenanced<number>;
  reasoning: Provenanced<boolean>;
  coding: Provenanced<boolean>;
  vision: Provenanced<boolean>;
  audio: Provenanced<boolean>;
  toolCalling: Provenanced<boolean>;
  structuredOutput: Provenanced<boolean>;
  embeddings: Provenanced<boolean>;
  streaming: Provenanced<boolean>;
  /** Expected latency characteristics (registry estimate or measured). */
  latencyMs: Provenanced<number>;
  /** Pricing per 1M tokens (USD). */
  priceInputPer1M: Provenanced<number>;
  priceOutputPer1M: Provenanced<number>;
  /** Free availability / quota information when known. */
  freeAvailability: Provenanced<'free' | 'limited' | 'paid' | 'unknown'>;
  /** Lifecycle/deprecation status (EPIC-012B) — UNKNOWN when not stated. */
  lifecycleStatus: Provenanced<ModelLifecycleStatus>;
  resourceType: ModelResourceType;
  resourceReasons: string[];
}

// ── Staleness (EPIC-012B) ─────────────────────────────────────────

export interface ProfileStaleness {
  /** True when the cached profile is older than the refresh policy allows. */
  isStale: boolean;
  /** Age of the cached profile in ms (0 when nothing cached). */
  ageMs: number;
  /** The refresh-policy max age in ms the verdict was computed against. */
  maxAgeMs: number;
  /** ISO timestamp of the last verification; null when never verified. */
  lastVerifiedAt: string | null;
}

// ── Hosted provider model discovery (EPIC-012B) ────────────────────
// Official provider metadata/API is the PREFERRED model-discovery source.
// When it is unavailable, adapters must fail safe: discovered=false and an
// honest statusMessage — models are never invented from names.

export interface ProviderCatalogDiscoveryResult {
  discovered: boolean;
  /** Where the metadata came from (e.g. 'provider-api', 'registry-declared'). */
  source: string;
  retrievedAt: string;
  /** VERIFIED only when the metadata came from the provider's own source. */
  verificationState: 'VERIFIED' | 'UNKNOWN';
  /** Discovered models (empty when discovery failed — never fabricated). */
  models: Array<{
    id: string;
    name: string;
    contextLength?: number;
    maxOutputTokens?: number;
    capabilities?: string[];
  }>;
  /** Human-readable status; never claims discovery it did not perform. */
  statusMessage: string;
  error?: string;
}

/** Adapter contract for hosted provider metadata/model-list endpoints. */
export interface ProviderCatalogDiscoveryPort {
  discover(providerId: string): Promise<ProviderCatalogDiscoveryResult>;
}

// ── Refresh result (EPIC-012B) ────────────────────────────────────

export type IntelligenceVerificationState = 'FULLY_VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED';

export interface ProviderIntelligenceRefreshResult {
  providerId: string;
  providerName: string;
  /** The freshly derived profile (always produced from registry facts). */
  profile: ProviderIntelligenceProfile;
  /**
   * PERSISTENT model-lifecycle ledger (EPIC-012B): every model id ever seen
   * with its current lifecycle verdict. Models present in the current
   * registry are 'active'; previously-seen models that disappeared are
   * marked 'unavailable' (or kept 'deprecated') — never silently deleted,
   * surviving across refreshes so routing can keep excluding them.
   */
  knownModels: Record<string, ModelLifecycleStatus>;
  /** ISO timestamp of this refresh. */
  verifiedAt: string;
  /**
   * FULLY_VERIFIED  — live provider metadata confirmed the model set.
   * PARTIALLY_VERIFIED — derived from registry-declared facts (live provider
   *                    discovery unavailable/disabled); unknown fields stay UNKNOWN.
   * UNVERIFIED      — no known facts at all (never happens with a valid registry).
   */
  verificationState: IntelligenceVerificationState;
  /** What the provider metadata discovery step produced (never throws). */
  discovery: {
    attempted: boolean;
    discovered: boolean;
    source: string;
    message: string;
  };
  /** What changed since the previous profile (safe, non-destructive). */
  delta: {
    /** Models present now but not in the previous profile. */
    addedModels: string[];
    /** Models present before but absent now — marked unavailable/deprecated,
     *  never silently deleted. */
    removedModels: string[];
    /** Models present in both profiles. */
    preservedModels: string[];
    /** User configuration (preferences) is structurally untouched by refresh. */
    userPreferencesPreserved: boolean;
  };
  /** The refresh policy this run was governed by. */
  refreshPolicy: { maxAgeMs: number };
}

export interface ProviderIntelligenceProfile {
  providerId: string;
  providerName: string;
  /** When the profile was derived. */
  generatedAt: string;
  /** The data lineage the profile was derived from. */
  derivedFrom: string;
  models: ModelIntelligence[];
  /** Highest-precision provenance any property carries. */
  coverage: {
    modelCount: number;
    /** Properties with PROVENANCE_ORDER index <= INFERRED (known). */
    knownPropertyCount: number;
    /** Properties with provenance UNKNOWN (honestly absent). */
    unknownPropertyCount: number;
  };
}

// ── Local model discovery ─────────────────────────────────────────

export interface LocalModelInfo {
  /** Stable local id (e.g. Ollama model tag). */
  id: string;
  name: string;
  /** Approximate size in GB when the runtime reports it. */
  sizeGb?: number;
  quantization?: string;
  status: 'available' | 'not_loaded' | 'unknown';
  /** Capabilities are INFERRED from the model name heuristics — never
   *  claimed as verified from a local runtime unless the runtime says so. */
  capabilities: string[];
  capabilitiesProvenance: ProvenanceState;
  contextWindow?: number;
  /** The runtime that reported this model (e.g. 'ollama', 'lm-studio'). */
  runtime: 'ollama' | 'lm-studio' | 'openai-compatible';
}

export interface LocalModelDiscoveryResult {
  runtime: 'ollama' | 'lm-studio' | 'openai-compatible';
  endpoint: string;
  discovered: boolean;
  models: LocalModelInfo[];
  /** Human-readable status (never claims discovery it did not perform). */
  statusMessage: string;
  retrievedAt: string;
  error?: string;
}

/** Adapter contract for local inference runtimes (Ollama / LM Studio /
 *  OpenAI-compatible endpoints). Live discovery is an operator step —
 *  adapters must fail safe (discovered=false, honest status) when the
 *  endpoint is unreachable. */
export interface LocalModelDiscoveryPort {
  readonly runtime: LocalModelDiscoveryResult['runtime'];
  discover(): Promise<LocalModelDiscoveryResult>;
}

// ── Hardware fit ──────────────────────────────────────────────────

export type HardwareFitVerdict =
  'SAFE' | 'POSSIBLE_SLOW' | 'NOT_RECOMMENDED' | 'UNSUPPORTED' | 'UNKNOWN';

export interface HardwareSpec {
  /** Total system RAM in GB (optional — UNKNOWN when absent). */
  ramGb?: number;
  /** VRAM available for inference in GB (GPU). */
  vramGb?: number;
  /** GPU present? */
  hasGpu?: boolean;
  /** Approximate CPU threads. */
  cpuThreads?: number;
  /** Free storage in GB (for large local models). */
  storageGb?: number;
}

export interface HardwareFitAssessment {
  modelId: string;
  name: string;
  /** Model weight size estimate in GB (registry/declared when known). */
  estimatedSizeGb: number;
  verdict: HardwareFitVerdict;
  reasons: string[];
}

export interface HardwareCompatibilityProfile {
  hardware: HardwareSpec;
  hardwareKnown: boolean;
  assessments: HardwareFitAssessment[];
  summary: {
    safe: number;
    possibleSlow: number;
    notRecommended: number;
    unsupported: number;
    unknown: number;
  };
}
