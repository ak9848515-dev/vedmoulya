// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Source Ports
// EPIC-013 — the capability marketplace CONSUMES existing intelligence
// through narrow seams — it never duplicates provider intelligence,
// AI World discovery, or local-model discovery. The gateway adapts
// the frozen ProviderApplicationService, DiscoveryApplicationService
// and LocalModelDiscoveryPort into these shapes.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId, CapabilityEvidence } from '../types/capability-types.js';

/** A normalized fact about a configured provider/model. */
export interface ProviderCandidateFact {
  /** Provider registry id. */
  providerId: string;
  /** Provider family (openai, openrouter, ollama, ...). */
  family: string;
  name: string;
  modelId?: string;
  modelName?: string;
  /** Which normalized capabilities this provider/model can serve. */
  capabilities: CapabilityId[];
  /** Quality signal (0..1) when the registry matrix has evidence. */
  quality?: number;
  /** Cost tier as declared in the registry. */
  costTier: 'free' | 'low' | 'medium' | 'high';
  availability: number;
  /** Whether the provider is configured and enabled for this user. */
  configured: boolean;
  /** Approximate cost per use where registry/pricing evidence exists. */
  estimatedCostUsd?: number;
  evidence: CapabilityEvidence[];
}

/** A normalized fact about an AI World discovery (provider/model/github/application). */
export interface DiscoveryCandidateFact {
  /** AI World item id. */
  itemId: string;
  category: 'provider' | 'model' | 'github' | 'application' | 'news';
  title: string;
  capabilities: CapabilityId[];
  /** Free/local classification from the AI World layer (honest). */
  freeClass: string;
  localAvailability: 'yes' | 'no' | 'UNKNOWN';
  /** Whether VedMoulya can configure this today (CONFIGURE recommendation). */
  configurable: boolean;
  suggestedFamily?: string;
  /** GitHub facts where present. */
  github?: { name: string; license?: string; flags: string[] };
  /** Evidence-backed confidence from the discovery layer. */
  evidence: CapabilityEvidence[];
  /** Security flags — untrusted content is never auto-integrated. */
  securityFlags: string[];
}

/** A normalized fact about a locally-discovered model. */
export interface LocalModelCandidateFact {
  id: string;
  name: string;
  sizeGb?: number;
  runtime: string;
  /** Capabilities are INFERRED from the runtime/model name — never claimed verified. */
  capabilities: CapabilityId[];
  capabilitiesProvenance: 'VERIFIED' | 'MEASURED' | 'INFERRED' | 'PROVIDER_DECLARED' | 'UNKNOWN';
  available: boolean;
  evidence: CapabilityEvidence[];
}

/**
 * The single source seam the planner uses to find candidates for a
 * capability. The gateway implements it over the frozen services:
 *   providerCandidates → ProviderApplicationService.listByCapability
 *   discoveryCandidates → DiscoveryApplicationService.listItems
 *   localModelCandidates → LocalModelDiscoveryPort adapters
 */
export interface CapabilitySourcePort {
  /** Configured providers/models that can serve a capability. */
  providerCandidates(capability: CapabilityId): Promise<ProviderCandidateFact[]>;
  /** AI World discoveries relevant to a capability (untrusted input). */
  discoveryCandidates(capability: CapabilityId): Promise<DiscoveryCandidateFact[]>;
  /** Locally-discovered models (Ollama / LM Studio / OpenAI-compatible). */
  localModelCandidates(capability: CapabilityId): Promise<LocalModelCandidateFact[]>;
}

/**
 * Optional AI enrichment seam (EPIC-013 § deterministic + optional AI):
 * a non-fatal refinement of the step/capability decomposition. When the
 * AI provider is unavailable or the call fails, the planner continues
 * with the deterministic decomposition — enrichment is never required,
 * never fabricated.
 */
export interface CapabilityEnrichmentPort {
  enrich(input: { outcome: string }): Promise<{
    confident: boolean;
    suggestedCapabilities: CapabilityId[];
    suggestedSteps: string[];
    /** 1–2 sentence plain-language summary (when produced). */
    summary?: string;
    provider: string;
    model: string;
  }>;
}
