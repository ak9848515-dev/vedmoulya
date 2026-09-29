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
//
// PROVIDER-01 → Mission: when a per-user orchestrator resolver is wired,
// availability for a mission is evaluated against THAT USER's orchestrator
// (platform providers + the user's OWN credential-backed adapters) instead
// of the shared deployment registry. This makes a provider the user really
// connected eligible for their missions — and ONLY their missions — without
// turning a user credential into a deployment-wide provider. With no
// resolver (or no userId) the behavior is byte-for-byte the previous one.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { AIOrchestrationService } from '@vedmoulya/services';
import type { ProviderAvailabilityPort, ProviderStatus } from '@vedmoulya/mission-controller';

/**
 * Resolves the user-scoped orchestrator to evaluate availability against.
 * The resolver is owned by the composition (which knows the credential
 * service); this adapter never touches a credential itself.
 */
export type UserOrchestratorResolver = (userId: string) => Promise<AIOrchestrationService>;

export class OrchestratorProviderAvailability implements ProviderAvailabilityPort {
  constructor(
    private readonly orchestrator: AIOrchestrationService,
    private readonly resolveUserOrchestrator?: UserOrchestratorResolver,
  ) {}

  async getProviderStatus(
    requiredCapabilities: string[],
    userId?: string,
  ): Promise<ProviderStatus> {
    // PROVIDER-01 → Mission: the user's own orchestrator when one can be
    // resolved, otherwise the shared deployment orchestrator (unchanged).
    const orchestrator =
      userId !== undefined && this.resolveUserOrchestrator !== undefined
        ? await this.resolveUserOrchestrator(userId)
        : this.orchestrator;

    const required = requiredCapabilities.filter((capability) => capability.trim().length > 0);
    const registered = orchestrator.listProviders().providers;
    const health = await orchestrator.getAllProviderHealth();
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
