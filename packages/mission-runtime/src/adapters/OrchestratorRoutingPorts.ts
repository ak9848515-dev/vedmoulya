// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Routing Intelligence Ports (BLD-022)
//
// AIOrchestrationService only routes through ProviderRoutingAdvisor when
// it is wired with EI-002/EI-004 intelligence ports (the API gateway
// wires them from the enterprise provider registry). When the mission
// runtime constructs its OWN shared AIOrchestrationService (standalone
// runtime / hermetic integration tests), it must wire equivalent ports —
// otherwise plan validation/execution cannot route any capability and
// every plan is honestly BLOCKED.
//
// These two narrow ports are the adapter equivalents of the gateway's
// createProviderIntelligencePort / createExecutionStrategyPort:
//   - candidates are the REAL registered ProviderAdapters on the shared
//     orchestrator (the frozen router's own registry — never duplicated);
//   - model ids/capabilities come from the EXISTING seeded provider
//     catalog (@vedmoulya/providers createCatalogProviders) when the
//     adapter has a catalog entry (mock-1, gpt-4o, llama3.3:70b, …),
//     otherwise the adapter itself is the only model it can execute
//     (single-model fallback — same conservative unknown-model handling
//     the advisor applies to sparse metadata);
//   - health is the adapter's REAL health (getAllProviderHealth) — never
//     fabricated, never memory/experience-derived;
//   - scoring metadata is deliberately NEUTRAL: the standalone runtime has
//     no refreshed enterprise benchmark registry, so every candidate
//     starts equal and routing resolves deterministically (registration
//     order on ties). The controller cannot tell providers apart, and
//     production keeps using the host application's fully-wired
//     orchestrator (injected via MissionRuntimeOptions.orchestrator) —
//     nothing here is overridden when an orchestrator is injected.
//
// The router itself remains AIOrchestrationService + ProviderRoutingAdvisor
// (FROZEN). No second router, no second registry, no provider SDK calls.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import { AIOrchestrationService } from '@vedmoulya/services';
import type {
  ExecutionStrategyPort,
  ProviderCandidateIntelligence,
  ProviderIntelligencePort,
} from '@vedmoulya/services';
import { createCatalogProviders } from '@vedmoulya/providers';

/** Neutral quality/availability profile used when no enterprise benchmark
 *  registry is available (documented in the module header). */
const NEUTRAL_BENCHMARK_SCORE = 50;
const NEUTRAL_LATENCY_MS = 500;
const NEUTRAL_COST_PER_1K = 0;

/** Model metadata fallback for adapters without a catalog entry. */
const DEFAULT_CONTEXT_WINDOW = 131072;
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

interface CatalogModelMetadata {
  id: string;
  contextLength: number;
  maxOutputTokens: number;
  streaming: boolean;
  capabilities?: string[];
}

function buildCatalogIndex(): {
  byId: Map<string, import('@vedmoulya/providers').Provider>;
  byFamily: Map<string, import('@vedmoulya/providers').Provider>;
  byModelId: Map<string, CatalogModelMetadata>;
} {
  const byId = new Map<string, import('@vedmoulya/providers').Provider>();
  const byFamily = new Map<string, import('@vedmoulya/providers').Provider>();
  const byModelId = new Map<string, CatalogModelMetadata>();
  for (const provider of createCatalogProviders()) {
    const id = provider.id.toString();
    if (!byId.has(id)) byId.set(id, provider);
    const family = provider.family as string;
    if (!byFamily.has(family)) byFamily.set(family, provider);
    for (const model of provider.models) {
      if (!byModelId.has(model.id)) {
        byModelId.set(model.id, {
          id: model.id,
          contextLength: model.contextLength,
          maxOutputTokens: model.maxOutputTokens,
          streaming: model.streaming,
          capabilities: model.capabilities,
        });
      }
    }
  }
  return { byId, byFamily, byModelId };
}

/**
 * BLD-023 — single-model local adapters (e.g. OllamaProvider) publish the
 * ONE model they actually execute via a public `configuredModel` accessor.
 * Routing MUST advertise that real model: the catalog family entry (a
 * different, not-installed model) would be selected and the adapter would
 * then honestly refuse to execute it — no local model could ever serve.
 * This is NOT fabrication: the model comes from the adapter's own metadata,
 * and catalog metadata is reused when the configured model has an entry.
 */
export function adapterConfiguredModel(provider: unknown): string | undefined {
  if (typeof provider !== 'object' || provider === null) return undefined;
  const configured = (provider as { configuredModel?: unknown }).configuredModel;
  return typeof configured === 'string' && configured.trim() !== '' ? configured : undefined;
}

/**
 * EI-002 port over the shared orchestrator's registered adapters.
 * Candidates are queried LIVE at routing time, so providers registered
 * after construction (e.g. an operator enabling Ollama while a mission
 * waits for providers) are honored without reconfiguration.
 */
export function createOrchestratorProviderIntelligence(
  orchestrator: AIOrchestrationService,
): ProviderIntelligencePort {
  const catalog = buildCatalogIndex();
  return {
    getCandidates: async (capability: string): Promise<ProviderCandidateIntelligence[]> => {
      const registered = orchestrator.listProviders().providers;
      const health = await orchestrator.getAllProviderHealth();
      const healthByProvider = new Map(health.map((entry) => [entry.providerId, entry]));

      const candidates: ProviderCandidateIntelligence[] = [];
      for (const provider of registered) {
        // The list DTO is a projection (id/family/capabilities only). Resolve
        // the REAL registered adapter through the orchestrator's public
        // getProvider() so adapter-published metadata (e.g. the single model
        // a local adapter actually executes) reaches routing — the frozen
        // service is untouched and no registry is duplicated.
        const adapter = orchestrator.getProvider(provider.id) ?? provider;
        const adapterFamily = typeof adapter.family === 'string' ? adapter.family : provider.family;
        const adapterCapabilities = Array.isArray(adapter.capabilities)
          ? adapter.capabilities
          : provider.capabilities;
        // The routing capability is the query dimension — the advisor gates
        // the required capability set (provider + model level) itself.
        if (!adapterCapabilities.includes(capability as CapabilityType)) continue;
        const healthEntry = healthByProvider.get(provider.id);
        const healthy = healthEntry?.status === 'healthy';
        const latencyMs = healthEntry?.latency ?? NEUTRAL_LATENCY_MS;

        const catalogEntry = catalog.byId.get(provider.id) ?? catalog.byFamily.get(adapterFamily);
        const catalogModels = catalogEntry?.models ?? [];
        const configuredModel = adapterConfiguredModel(adapter);
        const configuredCatalogModel = configuredModel
          ? catalog.byModelId.get(configuredModel)
          : undefined;
        const models =
          // BLD-023 — an adapter that publishes the exact model it executes
          // (OllamaProvider.configuredModel) advertises THAT model, reusing
          // catalog metadata when the model has an entry. Without this the
          // catalog family entry (a different local model) would be selected
          // and the adapter would honestly refuse to execute it.
          configuredModel
            ? [
                {
                  id: configuredModel,
                  contextWindow: configuredCatalogModel?.contextLength ?? DEFAULT_CONTEXT_WINDOW,
                  maxOutputTokens:
                    configuredCatalogModel?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
                  streaming: configuredCatalogModel?.streaming ?? false,
                  // Model-level capability list is UNKNOWN unless the catalog
                  // declares it — absent lists are never a reason to exclude
                  // (conservative routing semantics, never fabricated).
                  capabilities: configuredCatalogModel?.capabilities,
                },
              ]
            : catalogModels.length > 0
              ? catalogModels.map((model) => ({
                  id: model.id,
                  contextWindow: model.contextLength,
                  maxOutputTokens: model.maxOutputTokens,
                  streaming: model.streaming,
                  capabilities: model.capabilities,
                }))
              : [
                  {
                    // No catalog entry → the adapter is its own single model
                    // (conservative unknown-model semantics: capabilities are
                    // declared so routing still hard-gates on real ones).
                    id: provider.id,
                    contextWindow: DEFAULT_CONTEXT_WINDOW,
                    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
                    streaming: false,
                    capabilities: provider.capabilities,
                  },
                ];

        candidates.push({
          providerId: provider.id,
          family: adapterFamily,
          capabilities: adapterCapabilities,
          healthy,
          models,
          benchmarkScore: NEUTRAL_BENCHMARK_SCORE,
          averageLatencyMs: latencyMs,
          costPer1KInput: NEUTRAL_COST_PER_1K,
          costPer1KOutput: NEUTRAL_COST_PER_1K,
        });
      }
      return candidates;
    },
  };
}

/**
 * EI-004 port: deterministic balanced execution context (the same default
 * the gateway returns when no execution-strategy plan exists). Mission
 * work carries no budget/preference assumptions beyond the mission's own
 * enforced budget.
 */
export function createMissionExecutionStrategy(): ExecutionStrategyPort {
  return {
    getRoutingContext: () => Promise.resolve({ strategy: 'balanced' as const }),
  };
}

/** Convenience: both ports for one orchestrator. */
export function createOrchestratorRoutingPorts(orchestrator: AIOrchestrationService): {
  providerIntelligence: ProviderIntelligencePort;
  executionStrategy: ExecutionStrategyPort;
} {
  return {
    providerIntelligence: createOrchestratorProviderIntelligence(orchestrator),
    executionStrategy: createMissionExecutionStrategy(),
  };
}
