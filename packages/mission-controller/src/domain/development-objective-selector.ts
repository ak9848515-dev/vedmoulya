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
//
// SCOPE-01 — repository DISCOVERY is no longer the same thing as the
// user's REQUESTED SCOPE. Every inspection signal is first classified by
// `classifyDiscoveredWork` (REQUIRED / OPTIONAL / OUT_OF_SCOPE) and ONLY
// REQUIRED work is promoted to a Mission objective:
//
//   REQUIRED     a declared objective names it → it becomes a real objective
//                and the declaring objective depends on it (existing field).
//   OPTIONAL     related to the goal but unnamed by any objective → reported.
//   OUT_OF_SCOPE unrelated → reported, never executed.
//
// The inspector is never suppressed, nothing is force-completed, and the full
// classification rides along on every selection result as `scopeReport`, so
// OPTIONAL / OUT_OF_SCOPE work stays visible instead of silently hijacking the
// Mission and burning its objective budget.
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
} from '../contracts/mission-ports.js';
import { classifyDiscoveredWork, discoveredObjectiveTitle } from './mission-scope-classifier.js';
import type { DiscoveredWorkItem, DiscoveredWorkKind } from '../types/mission-types.js';

/** The pre-existing per-kind objective priority (unchanged by SCOPE-01). */
const KIND_PRIORITY: Record<DiscoveredWorkKind, number> = {
  FAILING_TEST: 0,
  INCOMPLETE_PACKAGE: 1,
  MISSING_INTEGRATION: 2,
  ARCHITECTURAL_GAP: 3,
  TODO: 4,
};

/** Complexity / cost / evidence wording per kind (pre-existing values). */
const KIND_SHAPE: Record<
  DiscoveredWorkKind,
  {
    complexity: MissionObjective['estimatedComplexity'];
    cost: number;
    objective: (label: string) => string;
    description: (label: string) => string;
    reason: string;
    evidence: (label: string) => string;
    selectionEvidence: (label: string) => string;
    selectionReason: (label: string) => string;
  }
> = {
  FAILING_TEST: {
    complexity: 'LOW',
    cost: 0.01,
    objective: (l) => `Resolve failure in test suite: ${l}`,
    description: (l) => `Fix test failure identified during repository inspection: ${l}`,
    reason: 'Test regressions must be fixed immediately to maintain platform correctness',
    evidence: (l) => `Failing test: ${l}`,
    selectionEvidence: (l) => `Failing test detected: ${l}`,
    selectionReason: (l) => `Highest-priority development objective: fix failing test ${l}`,
  },
  INCOMPLETE_PACKAGE: {
    complexity: 'MEDIUM',
    cost: 0.02,
    objective: (l) => `Implement unfinished package contracts and exports for ${l}`,
    description: (l) =>
      `Complete implementation of package ${l} based on architecture requirements`,
    reason: 'Package completeness required for monorepo integrity',
    evidence: (l) => `Incomplete package: ${l}`,
    selectionEvidence: (l) => `Package lacks required components or exports: ${l}`,
    selectionReason: (l) => `Priority 1 development objective: complete package ${l}`,
  },
  MISSING_INTEGRATION: {
    complexity: 'HIGH',
    cost: 0.03,
    objective: (l) => `Connect missing production integration: ${l}`,
    description: (l) => `Implement adapter and integration contract for ${l}`,
    reason: 'Production readiness requires all system integrations to be wired',
    evidence: (l) => `Missing integration: ${l}`,
    selectionEvidence: (l) => `Integration point missing: ${l}`,
    selectionReason: (l) => `Priority 2 development objective: implement missing integration ${l}`,
  },
  ARCHITECTURAL_GAP: {
    complexity: 'MEDIUM',
    cost: 0.02,
    objective: (l) => `Address architectural gap: ${l}`,
    description: (l) => `Bridge documented architecture gap: ${l}`,
    reason: 'Architectural compliance and completeness',
    evidence: (l) => `Architectural gap: ${l}`,
    selectionEvidence: (l) => `Architectural gap identified: ${l}`,
    selectionReason: (l) => `Priority 3 development objective: resolve architectural gap ${l}`,
  },
  TODO: {
    complexity: 'LOW',
    cost: 0.01,
    objective: (l) => `Implement TODO: ${l}`,
    description: (l) => `Resolve verified codebase TODO: ${l}`,
    reason: 'Codebase cleanliness and completion of tracked work items',
    evidence: (l) => `Verified TODO: ${l}`,
    selectionEvidence: (l) => `Codebase TODO found: ${l}`,
    selectionReason: (l) => `Priority 4 development objective: resolve TODO ${l}`,
  },
};

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

    // 2. No existing objective is selectable: inspect the repository and
    //    CLASSIFY every discovered item before promoting any of it.
    if (this.repositoryInspector) {
      const inspection = await this.repositoryInspector.inspectRepository(mission.workspace);
      const scopeReport = classifyDiscoveredWork(mission, inspection);
      const eligible = this.eligibleDiscovery(mission, scopeReport.required);
      const first = eligible[0];
      const discovered = first ? this.toDiscoveredObjective(first) : undefined;

      const alternativesConsidered = discovered
        ? eligible.slice(1).map((item) => discoveredObjectiveTitle(item.kind, item.label))
        : [];

      if (discovered) {
        return {
          selected: true,
          reason: discovered.reason,
          evidence: discovered.evidence,
          alternativesConsidered,
          priority: discovered.priority,
          providerStatus: {
            available: providerStatus.available,
            providerId: providerStatus.capableProviders[0]?.providerId,
            modelId: providerStatus.capableProviders[0]?.modelId,
          },
          discoveredObjective: discovered.objective,
          scopeReport,
        };
      }

      // Nothing REQUIRED remains. The discovered OPTIONAL / OUT_OF_SCOPE items
      // are still reported (never hidden) but must NOT become Mission work, so
      // incidental repository debt can no longer hijack the objective budget.
      return {
        selected: false,
        objectiveId: '',
        reason:
          'No pending objectives and no unfinished engineering work found in repository' +
          (this.reportOnlyNote(scopeReport) ? ` — ${this.reportOnlyNote(scopeReport)}` : ''),
        evidence: [
          'All existing objectives completed or terminal',
          'Repository inspection reports no pending development gaps',
          ...this.scopeEvidence(scopeReport),
        ],
        alternativesConsidered: [],
        priority: 0,
        providerStatus: {
          available: providerStatus.available,
          providerId: providerStatus.capableProviders[0]?.providerId,
          modelId: providerStatus.capableProviders[0]?.modelId,
        },
        scopeReport,
      };
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

  /**
   * SCOPE-01 — only REQUIRED items are eligible to become objectives.
   *
   * The one preserved legacy case: a mission that declares NO objectives at
   * all has no requested scope to protect, so repository state IS its
   * requested work (the pre-existing open-ended autonomous-development
   * semantics, exercised by the BLD-025 discovery-driven recovery suite).
   * The classifier has already labeled those items REQUIRED for exactly this
   * reason; see `classifyDiscoveredWork`.
   */
  private eligibleDiscovery(
    mission: Mission,
    required: DiscoveredWorkItem[],
  ): DiscoveredWorkItem[] {
    const existingTitles = new Set(mission.objectives.map((o) => o.title.toLowerCase()));
    return required.filter((item) => {
      const title = discoveredObjectiveTitle(item.kind, item.label);
      return (
        !existingTitles.has(title.toLowerCase()) && !existingTitles.has(item.label.toLowerCase())
      );
    });
  }

  /** Build the pre-existing discovered-objective shape from a classified item. */
  private toDiscoveredObjective(item: DiscoveredWorkItem): {
    objective: Partial<MissionObjective>;
    reason: string;
    evidence: string[];
    priority: number;
  } {
    const shape = KIND_SHAPE[item.kind];
    return {
      objective: {
        title: item.title,
        objective: shape.objective(item.label),
        description: shape.description(item.label),
        reason: item.rationale,
        evidence: [shape.evidence(item.label)],
        priority: KIND_PRIORITY[item.kind],
        dependencies: [],
        estimatedComplexity: shape.complexity,
        estimatedCost: shape.cost,
        state: 'READY',
        discovery: {
          classification: item.classification,
          kind: item.kind,
          label: item.label,
          rationale: item.rationale,
        },
      },
      reason: shape.selectionReason(item.label),
      evidence: [shape.selectionEvidence(item.label)],
      priority: KIND_PRIORITY[item.kind],
    };
  }

  /** Human-readable note of what was discovered but deliberately not executed. */
  private reportOnlyNote(scopeReport: ReturnType<typeof classifyDiscoveredWork>): string {
    const { optional, outOfScope } = scopeReport;
    if (optional.length === 0 && outOfScope.length === 0) return '';
    return (
      `${optional.length} related and ${outOfScope.length} out-of-scope repository items were ` +
      'discovered, classified and reported, and are not part of this Mission'
    );
  }

  /** Auditable evidence lines proving nothing was hidden. */
  private scopeEvidence(scopeReport: ReturnType<typeof classifyDiscoveredWork>): string[] {
    return [
      `Scope: ${scopeReport.summary}`,
      ...scopeReport.optional.map((i) => `OPTIONAL (not executed): ${i.kind} ${i.label}`),
      ...scopeReport.outOfScope.map((i) => `OUT_OF_SCOPE (not executed): ${i.kind} ${i.label}`),
    ];
  }
}
