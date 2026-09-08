// Deterministic objective selection
import type { Mission, ObjectiveSelectionResult, ProviderStatus } from '../types/mission-types.js';
import type { ObjectiveSelectionPort } from '../contracts/mission-ports.js';

export class DeterministicObjectiveSelector implements ObjectiveSelectionPort {
  // eslint-disable-next-line @typescript-eslint/require-await
  async selectNextObjective(
    mission: Mission,
    completedObjectiveIds: string[],
    providerStatus: ProviderStatus,
  ): Promise<ObjectiveSelectionResult> {
    // Filter to pending/ready objectives whose dependencies are satisfied
    const candidates = mission.objectives.filter((obj) => {
      if (obj.state !== 'PENDING' && obj.state !== 'READY') return false;
      if (completedObjectiveIds.includes(obj.objectiveId)) return false;
      // Check dependencies — all must be verified
      const depsSatisfied = obj.dependencies.every((depId) => {
        const dep = mission.objectives.find((o) => o.objectiveId === depId);
        return dep?.state === 'VERIFIED';
      });
      return depsSatisfied;
    });

    if (candidates.length === 0) {
      return {
        selected: false,
        objectiveId: '',
        reason: 'No pending objectives with satisfied dependencies',
        evidence: [],
        alternativesConsidered: [],
        priority: 0,
        providerStatus: {
          available: providerStatus.available,
          providerId: providerStatus.capableProviders[0]?.providerId,
          modelId: providerStatus.capableProviders[0]?.modelId,
        },
      };
    }

    // Sort by priority (lower number = higher priority)
    candidates.sort((a, b) => a.priority - b.priority);
    const selected = candidates[0];
    if (!selected) {
      return {
        selected: false,
        objectiveId: '',
        reason: 'No ready objectives available',
        evidence: ['All objectives are either running, completed, blocked, or failed'],
        alternativesConsidered: [],
        priority: 0,
        providerStatus: {
          available: providerStatus.available,
          providerId: providerStatus.capableProviders[0]?.providerId,
          modelId: providerStatus.capableProviders[0]?.modelId,
        },
      };
    }

    return {
      selected: true,
      objectiveId: selected.objectiveId,
      reason: `Selected objective with priority ${selected.priority}`,
      evidence: [
        `State: ${selected.state}`,
        `Priority: ${selected.priority}`,
        `Estimated complexity: ${selected.estimatedComplexity}`,
        `Dependencies satisfied: ${selected.dependencies.length === 0 ? 'none required' : selected.dependencies.join(', ')}`,
      ],
      alternativesConsidered: candidates.slice(1).map((c) => c.objectiveId),
      priority: selected.priority,
      providerStatus: {
        available: providerStatus.available,
        providerId: providerStatus.capableProviders[0]?.providerId,
        modelId: providerStatus.capableProviders[0]?.modelId,
      },
    };
  }
}
