// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: Mapper
// EPIC-006 — Phase 14. Maps domain records to the public DTO boundary.
// ──────────────────────────────────────────────────────────────────

import type { LoopRun } from '../types/loop-types.js';
import type {
  GoalSpecificationDTO,
  LoopPatternDTO,
  LoopRunDTO,
  LoopRunSummaryDTO,
  LoopStartResultDTO,
  LoopStatusDTO,
  LoopTaskGraphDTO,
} from './LoopDTO.js';
import { GOAL_PATTERNS, patternLabel } from '../catalog/loop-catalog.js';

export const LoopMapper = {
  toSpecificationDTO(run: Pick<LoopRun, 'specification'>): GoalSpecificationDTO {
    const spec = run.specification;
    return {
      goalId: spec.goalId,
      rawGoal: spec.rawGoal,
      objective: spec.objective,
      constraints: spec.constraints,
      requiredCapabilities: spec.requiredCapabilities,
      evidenceRequirements: spec.evidenceRequirements,
      successCriteria: spec.successCriteria,
      riskLevel: spec.riskLevel,
      budget: spec.budget,
      latencyPreference: spec.latencyPreference,
      allowedTools: spec.allowedTools,
      maxIterations: spec.maxIterations,
      pattern: spec.pattern,
      derivationReasons: spec.derivationReasons,
      qualityTier: spec.qualityTier,
      clarificationNeeded: spec.clarificationNeeded,
    };
  },

  toGraphDTO(run: Pick<LoopRun, 'graph'>): LoopTaskGraphDTO {
    const graph = run.graph;
    return {
      goalId: graph.goalId,
      tasks: graph.tasks,
      entryTaskIds: graph.entryTaskIds,
      terminalTaskIds: graph.terminalTaskIds,
      validated: graph.validated,
      validationReasons: graph.validationReasons,
      createdAt: graph.createdAt,
      version: graph.version,
    };
  },

  toStartResultDTO(
    run: Pick<LoopRun, 'runId' | 'goalId' | 'specification' | 'graph'>,
  ): LoopStartResultDTO {
    return {
      runId: run.runId,
      goalId: run.goalId,
      specification: LoopMapper.toSpecificationDTO(run),
      graph: LoopMapper.toGraphDTO(run),
    };
  },

  toRunDTO(run: LoopRun): LoopRunDTO {
    return {
      runId: run.runId,
      goalId: run.goalId,
      userId: run.userId,
      goal: run.goal,
      specification: LoopMapper.toSpecificationDTO(run),
      graph: LoopMapper.toGraphDTO(run),
      steps: run.steps,
      budgetConfig: run.budgetConfig,
      budgetUsage: run.budgetUsage,
      status: run.status,
      terminationReason: run.terminationReason,
      finalContent: run.finalContent,
      finalCritic: run.finalCritic,
      evidenceStates: run.evidenceStates,
      proposedMemories: run.proposedMemories,
      error: run.error,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      finishedAt: run.finishedAt,
    };
  },

  toStatusDTO(run: LoopRun): LoopStatusDTO {
    return {
      runId: run.runId,
      status: run.status,
      terminationReason: run.terminationReason,
      iterations: run.budgetUsage.iterations,
      providerCalls: run.budgetUsage.providerCalls,
      tokensTotal: run.budgetUsage.tokensTotal,
      costUsd: run.budgetUsage.costUsd,
      latencyMs: run.budgetUsage.latencyMs,
    };
  },

  toSummaryDTO(run: LoopRun): LoopRunSummaryDTO {
    return {
      runId: run.runId,
      goal: run.goal,
      pattern: run.specification.pattern,
      status: run.status,
      terminationReason: run.terminationReason,
      iterations: run.budgetUsage.iterations,
      tokensTotal: run.budgetUsage.tokensTotal,
      costUsd: run.budgetUsage.costUsd,
      latencyMs: run.budgetUsage.latencyMs,
      createdAt: run.createdAt,
    };
  },

  listPatterns(): LoopPatternDTO[] {
    return GOAL_PATTERNS.map((pattern) => ({
      id: pattern.id,
      label: patternLabel(pattern.id),
      description: pattern.description,
    }));
  },
};
