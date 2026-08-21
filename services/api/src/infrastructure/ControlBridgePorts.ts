// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway · ControlBridgePorts
// SPRINT-031 — the ONLY seams between the Active Intelligence Control Plane
// and the frozen estate. Implemented over the real BrainApplicationService,
// the real ProactiveIntelligenceService, the real IntelligenceFabricService
// and the real persistence stores — nothing duplicated, nothing fabricated.
// ─────────────────────────────────────────────────────────────────────────────

import type { BrainApplicationService } from '@vedmoulya/brain';
import type {
  ControlBrainPort,
  ControlFabricPort,
  ControlProactivePort,
  ControlStores,
} from '@vedmoulya/control-plane';
import type { ProactiveIntelligenceService } from '@vedmoulya/proactive';
import type { IntelligenceFabricService } from '@vedmoulya/intelligence-fabric';

/** ControlBrainPort over the real Brain. Pending approvals come from tasks
 *  that carry `approvalRequired` actions; outcome count from the outcome
 *  memory ledger (both owner-scoped by the Brain). */
export function createControlBrainPort(brain: BrainApplicationService): ControlBrainPort {
  return {
    listTasksWithApprovals: (
      userId: string,
    ): Array<{
      taskId: string;
      title: string;
      approvalRequired: string[];
    }> => {
      const result = brain.listTasks(userId);
      if (!result.success) return [];
      return (result.data ?? [])
        .filter((t) => t.approvalRequired.length > 0)
        .slice(0, 20)
        .map((t) => ({
          taskId: t.id,
          title: t.objective,
          approvalRequired: t.approvalRequired,
        }));
    },
    outcomeCount: (_userId: string): number => {
      // The Brain application service does not expose outcome memory directly
      // (same honest-empty convention as the proactive layer's
      // listOutcomeMemory) — no fabricated learning counts.
      return 0;
    },
  };
}

/** ControlProactivePort over the real proactive service (never executes). */
export function createControlProactivePort(
  proactive: ProactiveIntelligenceService,
): ControlProactivePort {
  return {
    refresh: async (
      userId: string,
      opts?: { runDiscovery?: boolean },
    ): Promise<{ success: boolean }> => {
      const result = await proactive.refresh(userId, { runDiscovery: opts?.runDiscovery ?? false });
      return { success: result.success };
    },
    listRecommendations: (
      userId: string,
    ): Array<{
      id: string;
      title: string;
      category: string;
      authorizationRequired: boolean;
      riskLevel: string;
    }> => {
      const result = proactive.list(userId);
      if (!result.success) return [];
      return result.data
        .filter((r) => r.status === 'NEW' || r.status === 'REVIEWED' || r.status === 'ACCEPTED')
        .map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          authorizationRequired: r.authorizationRequired,
          riskLevel: r.riskLevel,
        }));
    },
  };
}

/** ControlFabricPort over the real Intelligence Fabric (observed health +
 *  measured cost — never fabricated). */
export function createControlFabricPort(fabric: IntelligenceFabricService): ControlFabricPort {
  return {
    allProviderHealth: (): Array<{ providerId: string; state: string; observedCalls: number }> =>
      fabric.allProviderHealth().map((h) => ({
        providerId: h.providerId,
        state: h.state,
        observedCalls: h.observedCalls,
      })),
    costSnapshot: (ownerId: string): { dailyUsd?: number; providerUsd?: number } => {
      const snapshot = fabric.costPort?.snapshot({ ownerId }) ?? {};
      return { dailyUsd: snapshot.dailyUsd, providerUsd: snapshot.providerUsd };
    },
  };
}

/** The owner-scoped stores bundle for the control plane (in-memory or
 *  Postgres write-through — resolved by the persistence bundle). */
export function createControlStores(stores: {
  settings: ControlStores['settings'];
  emergencyStop: ControlStores['emergencyStop'];
  opportunities: ControlStores['opportunities'];
}): ControlStores {
  return stores;
}
