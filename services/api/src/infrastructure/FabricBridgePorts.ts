// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway · FabricBridgePorts
// SPRINT-030 — the ONLY seams between the Intelligence Fabric and the frozen
// estate. Implemented over the real CostLedger (measures actual spend from the
// trace spine) and the real provider registry (ProviderDTO evidence) — nothing
// duplicated, nothing fabricated.
// ─────────────────────────────────────────────────────────────────────────────

import type { CostLedger } from '../observability/CostLedger.js';
import type { TraceStore } from '@vedmoulya/core';
import type { ProviderApplicationService } from '@vedmoulya/providers';
import type {
  ProviderHealthLedger,
  FabricCostPort,
  FabricProviderPort,
  StrategyCandidate,
} from '@vedmoulya/intelligence-fabric';

/**
 * FabricCostPort over the real CostLedger. Honest mapping:
 *   dailyUsd    — the owner's total cost within the ledger's retained trace
 *                 window (never a fabricated calendar-day figure)
 *   providerUsd — the provider's total cost within the retained window
 *   task/workspace — absent until a real task/workspace cost dimension exists
 */
export function createFabricCostPort(ledger: CostLedger, traceStore: TraceStore): FabricCostPort {
  return {
    snapshot(scope: { ownerId?: string; providerId?: string }): {
      taskUsd?: number;
      dailyUsd?: number;
      providerUsd?: number;
      workspaceUsd?: number;
    } {
      const snapshot = ledger.compute(traceStore, { userId: scope.ownerId, limit: 1000 });
      const provider =
        scope.providerId !== undefined
          ? snapshot.byProvider.find((p) => p.provider === scope.providerId)
          : undefined;
      return {
        dailyUsd: snapshot.totals.costUsd > 0 ? snapshot.totals.costUsd : undefined,
        providerUsd: provider && provider.costUsd > 0 ? provider.costUsd : undefined,
      };
    },
  };
}

/**
 * FabricProviderPort over the real provider registry. Maps ProviderDTO
 * evidence (capability match, best quality, p50 latency, best cost, cost
 * tier, availability) into StrategyCandidate. Observed health comes from the
 * fabric's OWN runtime health ledger (never the registry's declared health).
 * privacyClass stays undefined unless the registry provides it — the strategy
 * then treats only local candidates as privacy-safe (honest).
 */
export function createFabricProviderPort(
  providers: ProviderApplicationService,
  healthLedger: ProviderHealthLedger,
): FabricProviderPort {
  return {
    async candidates(capability: string): Promise<StrategyCandidate[]> {
      const result = await providers.listByCapability(capability as never);
      if (!result.success || !result.data) return [];
      return result.data.map((dto) => ({
        providerId: dto.id,
        name: dto.name,
        capabilityMatched: dto.capabilities.includes(capability as never),
        quality: dto.bestQuality > 0 ? dto.bestQuality : undefined,
        latencyMs: dto.p50Ms > 0 ? dto.p50Ms : undefined,
        estimatedCostUsd: dto.bestCostUsd > 0 ? dto.bestCostUsd : undefined,
        freeAvailability: dto.costTier === 'free' ? 'FREE' : 'PAID',
        // Ollama is the platform's local runtime (registry family).
        localAvailability: dto.family === 'ollama' ? 'yes' : 'no',
        healthState: healthLedger.health(dto.id).state,
        availability: dto.availability > 0 ? dto.availability : undefined,
        evidence: [
          `registry-declared quality ${dto.bestQuality}, p50 ${dto.p50Ms}ms, cost tier ${dto.costTier}`,
        ],
      }));
    },
  };
}
