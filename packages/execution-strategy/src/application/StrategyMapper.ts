// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Application Mapper
// Maps domain ExecutionStrategy objects to application DTOs.
// No execution — the mapper only transforms strategy data.
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionMode,
  ExecutionStrategy,
  StrategyPriority,
} from '../types/strategy-types.js';
import type {
  CapabilityPlanDTO,
  CapabilityPlanStepDTO,
  ContextReferenceDTO,
  ExecutionModePlanDTO,
  ExecutionStrategyDTO,
  ProviderCandidateDTO,
  StrategyExplanationDTO,
  StrategySummaryDTO,
} from './StrategyDTO.js';

// ── Mapper (plain object, mirrors ContextMapper convention) ────────────────

export const StrategyMapper = {
  /**
   * Map a full domain strategy to its DTO representation.
   */
  toDTO(strategy: ExecutionStrategy): ExecutionStrategyDTO {
    return {
      strategyId: strategy.strategyId,
      goalId: strategy.goalId,
      goal: strategy.goal,
      business: strategy.business,
      capabilityPlan: this.capabilityPlanToDTO(strategy.capabilityPlan),
      providerCandidates: strategy.providerCandidates.map((c) => this.providerCandidateToDTO(c)),
      contextReference: this.contextReferenceToDTO(strategy.contextReference),
      executionMode: strategy.executionMode,
      modePlan: this.modePlanToDTO(strategy.modePlan),
      priority: strategy.priority,
      risk: { ...strategy.risk },
      confidence: strategy.confidence,
      tokenBudget: { ...strategy.tokenBudget },
      costBudget: { ...strategy.costBudget },
      latencyBudget: { ...strategy.latencyBudget },
      qualityTarget: { ...strategy.qualityTarget },
      fallbackPlan: { ...strategy.fallbackPlan },
      retryPolicy: { ...strategy.retryPolicy },
      validation: {
        passed: strategy.validation.passed,
        checks: strategy.validation.checks.map((c) => ({ ...c })),
        summary: strategy.validation.summary,
        score: strategy.validation.score,
      },
      createdAt: strategy.createdAt,
      updatedAt: strategy.updatedAt,
      version: strategy.version,
    };
  },

  /**
   * Map a strategy to its human-readable explanation DTO.
   */
  explanationToDTO(strategy: ExecutionStrategy): StrategyExplanationDTO {
    const top = strategy.providerCandidates[0];
    return {
      strategyId: strategy.strategyId,
      goal: strategy.goal,
      capabilitySummary: strategy.capabilityPlan.summary,
      providerSummary: top
        ? `Top candidate: ${top.name} (rank ${String(Math.round(top.rankScore * 100))}%). ${String(strategy.providerCandidates.length)} eligible provider(s).`
        : 'No eligible providers.',
      budgetSummary: `Max ${String(strategy.tokenBudget.maximumTokens)} tokens / $${strategy.costBudget.maximumCostUsd.toFixed(2)} / ${String(strategy.latencyBudget.maximumTimeMs)}ms.`,
      riskSummary: `Overall risk ${String(Math.round(strategy.risk.overallRisk * 100))}% (${strategy.risk.level}).`,
      modeSummary: `${strategy.modePlan.description} (${strategy.executionMode}).`,
      validationSummary: strategy.validation.summary,
    };
  },

  /**
   * Build the summary DTO from repository aggregates.
   */
  summaryToDTO(
    total: number,
    averageConfidence: number,
    countByPriority: Record<StrategyPriority, number>,
    countByExecutionMode: Record<ExecutionMode, number>,
  ): StrategySummaryDTO {
    return { total, averageConfidence, countByPriority, countByExecutionMode };
  },

  // ── Nested mappings ───────────────────────────────────────────────────────

  capabilityPlanToDTO(plan: ExecutionStrategy['capabilityPlan']): CapabilityPlanDTO {
    return {
      goal: plan.goal,
      steps: plan.steps.map((s) => this.stepToDTO(s)),
      requiredCapabilities: plan.requiredCapabilities,
      feasible: plan.feasible,
      summary: plan.summary,
    };
  },

  stepToDTO(step: ExecutionStrategy['capabilityPlan']['steps'][number]): CapabilityPlanStepDTO {
    return {
      stepId: step.stepId,
      capability: step.capability,
      label: step.label,
      description: step.description,
      flowType: step.flowType,
      support: step.support,
      skippable: step.skippable,
      weight: step.weight,
      eligibleFamilies: step.eligibleFamilies,
      children: step.children.map((c) => this.stepToDTO(c)),
    };
  },

  providerCandidateToDTO(c: ExecutionStrategy['providerCandidates'][number]): ProviderCandidateDTO {
    return { ...c };
  },

  contextReferenceToDTO(ref: ExecutionStrategy['contextReference']): ContextReferenceDTO {
    return { ...ref };
  },

  modePlanToDTO(plan: ExecutionStrategy['modePlan']): ExecutionModePlanDTO {
    return {
      mode: plan.mode,
      sequential: { ...plan.sequential },
      parallel: { ...plan.parallel },
      description: plan.description,
    };
  },
};
