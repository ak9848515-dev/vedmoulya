// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: Development Objective Selector
// BLD-021A PHASE 4 & PHASE 5 — Development Mission Objective Selection
//
// Identifies the highest-value unfinished engineering objective based
// on actual repository state, without inventing:
//   - tools
//   - capabilities
//   - providers
//   - permissions
//   - budget
//   - repository state
//
// Deterministic prioritization:
//   Priority 0: Failing tests (fix regressions / test failures)
//   Priority 1: Incomplete packages / broken builds
//   Priority 2: Missing integrations / architectural dependencies
//   Priority 3: Documented architectural gaps
//   Priority 4: Verified TODOs
// ──────────────────────────────────────────────────────────────────

import type {
  Mission,
  MissionObjective,
  ObjectiveSelectionResult,
  ProviderStatus,
} from '../types/mission-types.js';
import type {
  ObjectiveSelectionPort,
  RepositoryInspectionPort,
  RepositoryInspectionResult,
} from '../contracts/mission-ports.js';

export class DevelopmentObjectiveSelector implements ObjectiveSelectionPort {
  constructor(private readonly repositoryInspector?: RepositoryInspectionPort) {}

  async selectNextObjective(
    mission: Mission,
    completedObjectiveIds: string[],
    providerStatus: ProviderStatus,
  ): Promise<ObjectiveSelectionResult> {
    // 1. Check existing mission objectives first
    const existingCandidates = mission.objectives.filter((obj) => {
      if (obj.state !== 'PENDING' && obj.state !== 'READY') return false;
      if (completedObjectiveIds.includes(obj.objectiveId)) return false;
      // All dependencies must be verified
      const depsSatisfied = obj.dependencies.every((depId) => {
        const dep = mission.objectives.find((o) => o.objectiveId === depId);
        return dep?.state === 'VERIFIED';
      });
      return depsSatisfied;
    });

    if (existingCandidates.length > 0) {
      existingCandidates.sort((a, b) => a.priority - b.priority);
      const selected = existingCandidates[0];
      if (selected) {
        return {
          selected: true,
          objectiveId: selected.objectiveId,
          reason: `Selected existing objective with priority ${selected.priority}`,
          evidence: [
            `State: ${selected.state}`,
            `Priority: ${selected.priority}`,
            `Estimated complexity: ${selected.estimatedComplexity}`,
            `Dependencies satisfied: ${selected.dependencies.length === 0 ? 'none required' : selected.dependencies.join(', ')}`,
          ],
          alternativesConsidered: existingCandidates.slice(1).map((c) => c.objectiveId),
          priority: selected.priority,
          providerStatus: {
            available: providerStatus.available,
            providerId: providerStatus.capableProviders[0]?.providerId,
            modelId: providerStatus.capableProviders[0]?.modelId,
          },
        };
      }
    }

    // 2. If no existing objectives remain and repository inspector is configured, discover from repository
    if (this.repositoryInspector) {
      const inspection = await this.repositoryInspector.inspectRepository(mission.workspace);
      const discovered = this.prioritizeInspection(inspection, mission);

      if (discovered) {
        return {
          selected: true,
          reason: discovered.reason,
          evidence: discovered.evidence,
          alternativesConsidered: discovered.alternativesConsidered,
          priority: discovered.priority,
          providerStatus: {
            available: providerStatus.available,
            providerId: providerStatus.capableProviders[0]?.providerId,
            modelId: providerStatus.capableProviders[0]?.modelId,
          },
          discoveredObjective: discovered.objective,
        };
      }
    }

    return {
      selected: false,
      objectiveId: '',
      reason: 'No pending objectives and no unfinished engineering work found in repository',
      evidence: [
        'All existing objectives completed or terminal',
        'Repository inspection reports no pending development gaps',
      ],
      alternativesConsidered: [],
      priority: 0,
      providerStatus: {
        available: providerStatus.available,
        providerId: providerStatus.capableProviders[0]?.providerId,
        modelId: providerStatus.capableProviders[0]?.modelId,
      },
    };
  }

  private prioritizeInspection(
    inspection: RepositoryInspectionResult,
    mission: Mission,
  ):
    | {
        objective: Partial<MissionObjective>;
        reason: string;
        evidence: string[];
        alternativesConsidered: string[];
        priority: number;
      }
    | undefined {
    const existingTitles = new Set(mission.objectives.map((o) => o.title.toLowerCase()));

    // Priority 0: Failing tests
    const unhandledFailingTests = inspection.failingTests.filter(
      (t) =>
        !existingTitles.has(`fix failing test: ${t.toLowerCase()}`) &&
        !existingTitles.has(t.toLowerCase()),
    );
    const test = unhandledFailingTests[0];
    if (test) {
      return {
        objective: {
          title: `Fix failing test: ${test}`,
          objective: `Resolve failure in test suite: ${test}`,
          description: `Fix test failure identified during repository inspection: ${test}`,
          reason: 'Test regressions must be fixed immediately to maintain platform correctness',
          evidence: [`Failing test: ${test}`],
          priority: 0,
          dependencies: [],
          estimatedComplexity: 'LOW',
          estimatedCost: 0.01,
          state: 'READY',
        },
        reason: `Highest-priority development objective: fix failing test ${test}`,
        evidence: [`Failing test detected: ${test}`],
        alternativesConsidered: unhandledFailingTests.slice(1),
        priority: 0,
      };
    }

    // Priority 1: Incomplete packages
    const unhandledIncompletePackages = inspection.incompletePackages.filter(
      (p) =>
        !existingTitles.has(`complete package: ${p.toLowerCase()}`) &&
        !existingTitles.has(p.toLowerCase()),
    );
    const pkg = unhandledIncompletePackages[0];
    if (pkg) {
      return {
        objective: {
          title: `Complete package: ${pkg}`,
          objective: `Implement unfinished package contracts and exports for ${pkg}`,
          description: `Complete implementation of package ${pkg} based on architecture requirements`,
          reason: 'Package completeness required for monorepo integrity',
          evidence: [`Incomplete package: ${pkg}`],
          priority: 1,
          dependencies: [],
          estimatedComplexity: 'MEDIUM',
          estimatedCost: 0.02,
          state: 'READY',
        },
        reason: `Priority 1 development objective: complete package ${pkg}`,
        evidence: [`Package lacks required components or exports: ${pkg}`],
        alternativesConsidered: unhandledIncompletePackages.slice(1),
        priority: 1,
      };
    }

    // Priority 2: Missing integrations
    const unhandledMissingIntegrations = inspection.missingIntegrations.filter(
      (i) =>
        !existingTitles.has(`implement integration: ${i.toLowerCase()}`) &&
        !existingTitles.has(i.toLowerCase()),
    );
    const integration = unhandledMissingIntegrations[0];
    if (integration) {
      return {
        objective: {
          title: `Implement integration: ${integration}`,
          objective: `Connect missing production integration: ${integration}`,
          description: `Implement adapter and integration contract for ${integration}`,
          reason: 'Production readiness requires all system integrations to be wired',
          evidence: [`Missing integration: ${integration}`],
          priority: 2,
          dependencies: [],
          estimatedComplexity: 'HIGH',
          estimatedCost: 0.03,
          state: 'READY',
        },
        reason: `Priority 2 development objective: implement missing integration ${integration}`,
        evidence: [`Integration point missing: ${integration}`],
        alternativesConsidered: unhandledMissingIntegrations.slice(1),
        priority: 2,
      };
    }

    // Priority 3: Architectural gaps
    const unhandledGaps = inspection.architecturalGaps.filter(
      (g) =>
        !existingTitles.has(`resolve gap: ${g.toLowerCase()}`) &&
        !existingTitles.has(g.toLowerCase()),
    );
    const gap = unhandledGaps[0];
    if (gap) {
      return {
        objective: {
          title: `Resolve gap: ${gap}`,
          objective: `Address architectural gap: ${gap}`,
          description: `Bridge documented architecture gap: ${gap}`,
          reason: 'Architectural compliance and completeness',
          evidence: [`Documented gap: ${gap}`],
          priority: 3,
          dependencies: [],
          estimatedComplexity: 'MEDIUM',
          estimatedCost: 0.02,
          state: 'READY',
        },
        reason: `Priority 3 development objective: resolve architectural gap ${gap}`,
        evidence: [`Architectural gap identified: ${gap}`],
        alternativesConsidered: unhandledGaps.slice(1),
        priority: 3,
      };
    }

    // Priority 4: Verified TODOs
    const unhandledTodos = inspection.todos.filter(
      (t) =>
        !existingTitles.has(`resolve todo: ${t.toLowerCase()}`) &&
        !existingTitles.has(t.toLowerCase()),
    );
    const todo = unhandledTodos[0];
    if (todo) {
      return {
        objective: {
          title: `Resolve TODO: ${todo}`,
          objective: `Implement TODO: ${todo}`,
          description: `Resolve verified codebase TODO: ${todo}`,
          reason: 'Codebase cleanliness and completion of tracked work items',
          evidence: [`Verified TODO: ${todo}`],
          priority: 4,
          dependencies: [],
          estimatedComplexity: 'LOW',
          estimatedCost: 0.01,
          state: 'READY',
        },
        reason: `Priority 4 development objective: resolve TODO ${todo}`,
        evidence: [`Codebase TODO found: ${todo}`],
        alternativesConsidered: unhandledTodos.slice(1),
        priority: 4,
      };
    }

    return undefined;
  }
}
