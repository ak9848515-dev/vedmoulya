// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: AI Runtime Ports
// AI-RUNTIME-002 — adapts the frozen EI-002 (Provider Intelligence) and
// EI-004 (Execution Strategy) application services and the RAG application
// service into the narrow runtime ports consumed by AIOrchestrationService.
// No provider SDKs, no duplicate engines — the runtime genuinely routes on
// live enterprise intelligence.
// ─────────────────────────────────────────────────────────────────────────────

import { classifyResource } from '@vedmoulya/providers';
import type { ProviderApplicationService, ProviderIntelligenceStore } from '@vedmoulya/providers';
import type { ExecutionStrategyApplicationService } from '@vedmoulya/execution-strategy';
import type { RagApplicationService } from '@vedmoulya/rag';
import type {
  ExecutionStrategyPort,
  ProviderCandidateIntelligence,
  ProviderIntelligencePort,
  ProviderMeasuredEvidence,
  RagRetrievalPort,
  RuntimeExecutionHealth,
} from '@vedmoulya/services';

/**
 * Optional measured-evidence source (Phase G wiring). When provided, each
 * candidate carries REAL measured history (reliability/latency/tokens/cost)
 * from the RoutingEvidenceService; absent in cold start the candidates are
 * exactly as before (static registry metadata only).
 */
export interface RoutingEvidenceSource {
  bestEvidence(
    providerId: string,
    modelId?: string,
    capability?: string,
  ): ProviderMeasuredEvidence | undefined;
}

/**
 * Real-time execution health source (Capability Intelligence). The gateway's
 * ExecutionHealthService implements this shape: bounded, recency-decayed
 * verdicts from ACTUAL execution outcomes. Absent → candidates carry exactly
 * the registry health they carried before this epic.
 */
export interface RuntimeHealthSource {
  getProviderHealth(providerId: string): RuntimeExecutionHealth | undefined;
  getModelHealth(providerId: string, modelId: string): RuntimeExecutionHealth | undefined;
  listUnavailableModelIds(providerId: string): string[];
}

/**
 * EI-002 adapter: live provider candidates for a capability, including model
 * context windows, pricing, latency and health from the registry.
 *
 * EPIC-012B — candidates are enriched with provider/model intelligence:
 *   • resourceType / freeToUse come from the SAME deterministic registry
 *     classification the intelligence layer uses (never cost heuristics);
 *   • unavailableModelIds come from the cached intelligence profile (models
 *     marked unavailable/deprecated by a refresh are excluded from routing).
 *   The optional intelligence store is only read — never written here.
 */
export function createProviderIntelligencePort(
  providers: ProviderApplicationService,
  intelligenceStore?: ProviderIntelligenceStore,
  evidence?: RoutingEvidenceSource,
  runtimeHealth?: RuntimeHealthSource,
): ProviderIntelligencePort {
  return {
    getCandidates: async (capability: string): Promise<ProviderCandidateIntelligence[]> => {
      const result = await providers.listByCapability(
        capability as Parameters<typeof providers.listByCapability>[0],
      );
      const providerDTOs = 'data' in result ? (result.data ?? []) : [];
      const candidates: ProviderCandidateIntelligence[] = await Promise.all(
        providerDTOs.map(async (provider) => {
          const classification = classifyResource({
            family: provider.family,
            inputPerMillionTokens: provider.inputPerMillionTokens,
            outputPerMillionTokens: provider.outputPerMillionTokens,
            costTier: provider.costTier,
            tags: provider.tags,
          });
          // Models the intelligence layer knows are unavailable/deprecated
          // are excluded from selection (never routed to). The known-models
          // ledger persists verdicts across refreshes — a model that
          // disappeared upstream stays excluded even though it is no longer
          // in the current profile.
          const cached = intelligenceStore ? await intelligenceStore.get(provider.id) : null;
          const unavailableModelIds = cached
            ? Object.entries(cached.knownModels)
                .filter(([, status]) => status === 'unavailable' || status === 'deprecated')
                .map(([modelId]) => modelId)
            : [];
          // Phase G — real measured history when it exists (per provider;
          // model/capability dimensions refine inside the evidence service).
          // Absent in cold start → the advisor sees exactly the static
          // metadata it saw before this epic.
          const measured = evidence ? evidence.bestEvidence(provider.id) : undefined;
          // Capability Intelligence — real-time execution health (bounded,
          // recoverable). An UNAVAILABLE runtime verdict folds into the
          // registry `healthy` gate ONLY for routing eligibility (excluded
          // while a healthy alternative exists — never an auto-disable); the
          // full verdict detail is attached for the advisor + observability.
          const runtimeProviderHealth = runtimeHealth?.getProviderHealth(provider.id);
          const registryHealthy =
            provider.health.status === 'healthy' && provider.lifecycleStatus === 'active';
          const healthy = registryHealthy && runtimeProviderHealth?.verdict !== 'UNAVAILABLE';
          const runtimeUnavailableModelIds = runtimeHealth?.listUnavailableModelIds(provider.id);
          return {
            providerId: provider.id,
            family: provider.family,
            capabilities: provider.capabilities,
            healthy,
            models: provider.models.map((model) => ({
              id: model.id,
              contextWindow: model.contextLength,
              maxOutputTokens: model.maxOutputTokens,
              streaming: model.streaming,
              // Model-level capabilities from the single provider registry:
              // provider capability ≠ model capability, so routing can gate
              // on the ACTUAL model (a vision provider may host non-vision
              // models). Absent → the advisor treats the model as UNKNOWN.
              capabilities: model.capabilities,
            })),
            // All pricing/latency/quality fields are required on the registry DTO.
            benchmarkScore: provider.bestQuality,
            averageLatencyMs: provider.health.latencyMs,
            costPer1KInput: provider.inputPerMillionTokens / 1000,
            costPer1KOutput: provider.outputPerMillionTokens / 1000,
            // EPIC-012B — intelligence-layer facts (registry classification
            // + cached profile lifecycle).
            resourceType: classification.resourceType,
            freeToUse: classification.freeToUse,
            unavailableModelIds: unavailableModelIds.length > 0 ? unavailableModelIds : undefined,
            // Measured execution evidence — NEVER static/estimated.
            ...(measured ? { measured } : {}),
            // Real-time execution health — attached only when the tracker has
            // an actual verdict (UNKNOWN/cold start carries nothing).
            ...(runtimeProviderHealth && runtimeProviderHealth.verdict !== 'UNKNOWN'
              ? { runtimeHealth: runtimeProviderHealth }
              : {}),
            // Models the runtime tracker currently excludes (model-scope
            // failures / declared unsupported) — provider stays eligible.
            ...(runtimeUnavailableModelIds && runtimeUnavailableModelIds.length > 0
              ? { runtimeUnavailableModelIds }
              : {}),
          };
        }),
      );
      return candidates;
    },
  };
}

/**
 * EI-004 adapter: the routing context (strategy posture, budget, preferred
 * providers) derived from the strategy engine's plans for a capability.
 */
export function createExecutionStrategyPort(
  strategies: ExecutionStrategyApplicationService,
): ExecutionStrategyPort {
  return {
    getRoutingContext: async (): Promise<{
      maxCost?: number;
      preferredProviders?: string[];
      strategy: 'quality-first' | 'cost-first' | 'latency-first' | 'balanced';
    }> => {
      const result = await strategies.listByCapability('reasoning');
      const plans = 'data' in result ? (result.data ?? []) : [];
      const first = plans[0];
      if (!first) {
        return { strategy: 'balanced' as const };
      }
      const maxCost = first.costBudget.maximumCostUsd;
      const preferredProviders = first.providerCandidates.slice(0, 2).map((c) => c.providerId);
      return {
        maxCost,
        preferredProviders: preferredProviders.length > 0 ? preferredProviders : undefined,
        strategy:
          first.qualityTarget.targetScore >= 9
            ? ('quality-first' as const)
            : first.priority === 'critical'
              ? ('quality-first' as const)
              : maxCost < 0.01
                ? ('cost-first' as const)
                : ('balanced' as const),
      };
    },
  };
}

/**
 * RAG adapter: retrieval for the runtime — the rag.* collection is queried
 * through the RAG application service (vector search with keyword fallback).
 */
export function createRagRetrievalPort(rag: RagApplicationService): RagRetrievalPort {
  return {
    retrieve: async (input: {
      userId: string;
      query: string;
      collection: string;
      topK?: number;
    }): Promise<{ results: Array<{ title: string; content: string; score: number }> }> => {
      const search = await rag.search({
        userId: input.userId,
        collection: input.collection,
        query: input.query,
        topK: input.topK ?? 5,
      });
      return {
        results: search.results.map((r) => ({
          title: r.title,
          content: r.content,
          score: r.score,
          // Per-document source (sourceId) so the evidence evaluator can
          // detect CONFLICTING_EVIDENCE across distinct documents.
          source: r.sourceId,
        })),
      };
    },
  };
}
