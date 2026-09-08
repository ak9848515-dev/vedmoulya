// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Provider Availability Adapter (BLD-022)
//
// Implements the Mission Controller's ProviderAvailabilityPort over the
// EXISTING AIOrchestrationService — the frozen provider registry/router.
// NO second router, NO second health system: availability is derived
// from the real registered adapters (declared capabilities) and their
// real health. When no healthy adapter can satisfy the required
// capabilities the mission honestly waits (WAITING_FOR_PROVIDER) —
// availability can never be fabricated by memory, experience or the
// model (security invariants 3/4/11).
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { AIOrchestrationService } from '@vedmoulya/services';
import type { ProviderAvailabilityPort, ProviderStatus } from '@vedmoulya/mission-controller';

export class OrchestratorProviderAvailability implements ProviderAvailabilityPort {
  constructor(private readonly orchestrator: AIOrchestrationService) {}

  async getProviderStatus(requiredCapabilities: string[]): Promise<ProviderStatus> {
    const required = requiredCapabilities.filter((capability) => capability.trim().length > 0);
    const registered = this.orchestrator.listProviders().providers;
    const health = await this.orchestrator.getAllProviderHealth();
    const healthyIds = new Set(
      health.filter((entry) => entry.status === 'healthy').map((entry) => entry.providerId),
    );

    const capableProviders = registered
      .filter((provider) => healthyIds.has(provider.id))
      .filter((provider) =>
        // Every required capability must be declared by the REAL adapter.
        required.every((capability) =>
          provider.capabilities.includes(capability as CapabilityType),
        ),
      )
      .map((provider) => ({
        providerId: provider.id,
        modelId: provider.models[0] ?? provider.id,
        capabilities: provider.capabilities,
        healthy: true,
      }));

    const unhealthyProviders = registered
      .filter((provider) => !healthyIds.has(provider.id))
      .map((provider) => provider.id);

    return {
      available: capableProviders.length > 0,
      capableProviders,
      unhealthyProviders,
    };
  }
}
