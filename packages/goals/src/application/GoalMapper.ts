// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: DTO Mapper
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Plain-object mapper (matches the StrategyMapper/OrchestratorMapper
// convention) — maps domain objects to API-safe DTOs.
// ──────────────────────────────────────────────────────────────────

import type {
  Goal,
  GoalAnalysis,
  GoalClassification,
  GoalEvent,
  Milestone,
  SuccessCriterion,
  Task,
  TaskGraph,
} from '../types/goal-types.js';
import type { GoalValidation } from '../types/goal-types.js';
import type { StrategyHandoff } from '../types/goal-types.js';
import type {
  GoalDTO,
  GoalEventDTO,
  GoalExplanationDTO,
  GoalSummaryDTO,
  GoalValidationDTO,
  MilestoneDTO,
  StrategyHandoffDTO,
  SuccessCriterionDTO,
  TaskDTO,
  TaskGraphDTO,
} from './GoalDTO.js';

export const GoalMapper = {
  criterionToDTO(c: SuccessCriterion): SuccessCriterionDTO {
    return {
      criterionId: c.criterionId,
      definition: c.definition,
      validation: c.validation,
      completionCriteria: c.completionCriteria,
      expectedOutcome: c.expectedOutcome,
      met: c.met,
    };
  },

  milestoneToDTO(m: Milestone): MilestoneDTO {
    return {
      milestoneId: m.milestoneId,
      title: m.title,
      description: m.description,
      taskIds: m.taskIds,
      dueAt: m.dueAt,
      order: m.order,
      achieved: m.achieved,
    };
  },

  eventToDTO(e: GoalEvent): GoalEventDTO {
    return {
      eventId: e.eventId,
      goalId: e.goalId,
      type: e.type,
      timestamp: e.timestamp,
      message: e.message,
    };
  },

  classificationToDTO(c: GoalClassification): GoalDTO['classification'] {
    return {
      businessDomain: c.businessDomain,
      requiredCapabilities: c.requiredCapabilities,
      requiredContext: c.requiredContext,
      riskScore: c.riskScore,
      riskLevel: c.riskLevel,
      complexity: c.complexity,
      estimatedTokenRange: c.estimatedTokenRange,
      estimatedCostRangeUsd: c.estimatedCostRangeUsd,
    };
  },

  analysisToDTO(a: GoalAnalysis): GoalDTO['analysis'] {
    return {
      goalId: a.goalId,
      category: a.category,
      categoryConfidence: a.categoryConfidence,
      domainHints: a.domainHints,
      capabilityHints: a.capabilityHints,
      contextHints: a.contextHints,
      suggestedPriority: a.suggestedPriority,
      summary: a.summary,
    };
  },

  goalToDTO(g: Goal): GoalDTO {
    return {
      goalId: g.goalId,
      title: g.title,
      description: g.description,
      category: g.category,
      business: g.business,
      priority: g.priority,
      urgency: g.urgency,
      importance: g.importance,
      complexity: g.complexity,
      estimatedEffort: g.estimatedEffort,
      status: g.status,
      confidence: g.confidence,
      goalScore: g.goalScore,
      successCriteria: g.successCriteria.map((c) => this.criterionToDTO(c)),
      milestones: g.milestones.map((m) => this.milestoneToDTO(m)),
      dependencies: g.dependencies,
      parentGoalId: g.parentGoalId,
      childGoalIds: g.childGoalIds,
      tags: g.tags,
      classification: g.classification ? this.classificationToDTO(g.classification) : undefined,
      analysis: g.analysis ? this.analysisToDTO(g.analysis) : undefined,
      events: g.events.map((e) => this.eventToDTO(e)),
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  },

  taskToDTO(t: Task): TaskDTO {
    return {
      taskId: t.taskId,
      goalId: t.goalId,
      title: t.title,
      capability: t.capability,
      priority: t.priority,
      businessValue: t.businessValue,
      urgency: t.urgency,
      importance: t.importance,
      risk: t.risk,
      confidence: t.confidence,
      estimatedTokens: t.estimatedTokens,
      estimatedCostUsd: t.estimatedCostUsd,
      estimatedTimeMs: t.estimatedTimeMs,
      dependencies: t.dependencies,
      parallelEligible: t.parallelEligible,
      flowType: t.flowType,
      retryPolicy: t.retryPolicy,
      validationRules: t.validationRules,
      status: t.status,
      parentTaskId: t.parentTaskId,
      subTaskIds: t.subTaskIds,
      order: t.order,
      critical: t.critical,
      slack: t.slack,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  },

  taskGraphToDTO(graph: TaskGraph): TaskGraphDTO {
    return {
      goalId: graph.goalId,
      tasks: graph.tasks.map((t) => this.taskToDTO(t)),
      criticalPath: graph.criticalPath,
      parallelGroups: graph.parallelGroups,
      milestones: graph.milestones.map((m) => this.milestoneToDTO(m)),
      totalEstimatedTimeMs: graph.totalEstimatedTimeMs,
      totalEstimatedCostUsd: graph.totalEstimatedCostUsd,
      totalEstimatedTokens: graph.totalEstimatedTokens,
      criticalPathLength: graph.criticalPathLength,
      validated: graph.validated,
    };
  },

  validationToDTO(v: GoalValidation): GoalValidationDTO {
    return {
      passed: v.passed,
      checks: v.checks,
      summary: v.summary,
      score: v.score,
    };
  },

  explanationToDTO(g: Goal, tasks: Task[]): GoalExplanationDTO {
    return {
      goalId: g.goalId,
      title: g.title,
      category: g.category,
      summary:
        g.analysis?.summary ??
        `"${g.title}" is a ${g.category} goal at ${g.status} status with a ${g.goalScore} goal score.`,
      classificationSummary: g.classification
        ? `Classified as ${g.classification.complexity} complexity, ${g.classification.riskLevel} risk, requiring ${g.classification.requiredCapabilities.join(', ')}.`
        : 'Not yet classified.',
      criteriaSummary: `${String(g.successCriteria.length)} success criteria — ${g.successCriteria.map((c) => c.definition).join('; ') || 'none'}.`,
      milestoneSummary: `${String(g.milestones.length)} milestone(s): ${g.milestones.map((m) => m.title).join(' → ') || 'none yet'}.`,
      dependencySummary:
        g.dependencies.length > 0
          ? `${String(g.dependencies.length)} goal dependency/dependencies declared.`
          : 'No goal-level dependencies.',
      lifecycleSummary: `Lifecycle: ${g.events.map((e) => e.type).join(' → ') || g.status}.`,
      taskSummary:
        tasks.length > 0
          ? `${String(tasks.length)} tasks planned — critical path: ${
              tasks
                .filter((t) => t.critical)
                .map((t) => t.title)
                .join(' → ') || 'computed after generation'
            }.`
          : 'No task plan generated yet.',
    };
  },

  handoffToDTO(h: StrategyHandoff): StrategyHandoffDTO {
    return {
      goalId: h.goalId,
      goal: h.goal,
      business: h.business,
      priority: h.priority,
      steps: h.steps.map((s) => ({
        stepId: s.stepId,
        capability: s.capability,
        label: s.label,
        flowType: s.flowType,
        weight: s.weight,
      })),
      mode: h.mode,
      estimatedTokens: h.estimatedTokens,
      estimatedCostUsd: h.estimatedCostUsd,
    };
  },

  summaryToDTO(input: {
    totalGoals: number;
    activeGoals: number;
    completedGoals: number;
    blockedGoals: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    avgConfidence: number;
    avgGoalScore: number;
    totalTasks: number;
  }): GoalSummaryDTO {
    return { ...input };
  },
};
