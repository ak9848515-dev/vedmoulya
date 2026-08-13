// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Application DTOs
// EI-006 — Enterprise Goal & Task Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type {
  ComplexityLevel,
  GoalCategory,
  GoalPriority,
  GoalStatus,
  RiskLevel,
  TaskFlowType,
  TaskStatus,
} from '../types/goal-types.js';

export interface SuccessCriterionDTO {
  criterionId: string;
  definition: string;
  validation: string;
  completionCriteria: string[];
  expectedOutcome: string;
  met: boolean;
}

export interface MilestoneDTO {
  milestoneId: string;
  title: string;
  description: string;
  taskIds: string[];
  dueAt?: string;
  order: number;
  achieved: boolean;
}

export interface GoalClassificationDTO {
  businessDomain: string[];
  requiredCapabilities: string[];
  requiredContext: string[];
  riskScore: number;
  riskLevel: RiskLevel;
  complexity: ComplexityLevel;
  estimatedTokenRange: { min: number; max: number };
  estimatedCostRangeUsd: { min: number; max: number };
}

export interface GoalAnalysisDTO {
  goalId: string;
  category: GoalCategory;
  categoryConfidence: number;
  domainHints: string[];
  capabilityHints: string[];
  contextHints: string[];
  suggestedPriority: GoalPriority;
  summary: string;
}

export interface GoalEventDTO {
  eventId: string;
  goalId: string;
  type: string;
  timestamp: string;
  message: string;
}

export interface GoalDTO {
  goalId: string;
  title: string;
  description: string;
  category: GoalCategory;
  business: string[];
  priority: GoalPriority;
  urgency: number;
  importance: number;
  complexity: ComplexityLevel;
  estimatedEffort: number;
  status: GoalStatus;
  confidence: number;
  goalScore: number;
  successCriteria: SuccessCriterionDTO[];
  milestones: MilestoneDTO[];
  dependencies: string[];
  parentGoalId?: string;
  childGoalIds: string[];
  tags: string[];
  classification?: GoalClassificationDTO;
  analysis?: GoalAnalysisDTO;
  events: GoalEventDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskDTO {
  taskId: string;
  goalId: string;
  title: string;
  capability: string;
  priority: number;
  businessValue: number;
  urgency: number;
  importance: number;
  risk: number;
  confidence: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  estimatedTimeMs: number;
  dependencies: string[];
  parallelEligible: boolean;
  flowType: TaskFlowType;
  retryPolicy: { maxRetries: number; retryDelayMs: number; retryableFailures: string[] };
  validationRules: Array<{ ruleId: string; description: string }>;
  status: TaskStatus;
  parentTaskId?: string;
  subTaskIds: string[];
  order: number;
  critical: boolean;
  slack: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskGraphDTO {
  goalId: string;
  tasks: TaskDTO[];
  criticalPath: string[];
  parallelGroups: string[][];
  milestones: MilestoneDTO[];
  totalEstimatedTimeMs: number;
  totalEstimatedCostUsd: number;
  totalEstimatedTokens: number;
  criticalPathLength: number;
  validated: boolean;
}

export interface GoalValidationDTO {
  passed: boolean;
  checks: Array<{ check: string; passed: boolean; detail: string }>;
  summary: string;
  score: number;
}

export interface GoalExplanationDTO {
  goalId: string;
  title: string;
  category: string;
  summary: string;
  classificationSummary: string;
  criteriaSummary: string;
  milestoneSummary: string;
  dependencySummary: string;
  lifecycleSummary: string;
  taskSummary: string;
}

export interface GoalSummaryDTO {
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
}

export interface StrategyHandoffDTO {
  goalId: string;
  goal: string;
  business: string[];
  priority: GoalPriority;
  steps: Array<{
    stepId: string;
    capability: string;
    label: string;
    flowType: TaskFlowType;
    weight: number;
  }>;
  mode: string;
  estimatedTokens: number;
  estimatedCostUsd: number;
}

export interface CreateGoalDTO {
  userId: string;
  title: string;
  description: string;
  category?: GoalCategory;
  business?: string[];
  priority?: GoalPriority;
  urgency?: number;
  importance?: number;
  estimatedEffort?: number;
  tags?: string[];
  parentGoalId?: string;
  dependencies?: string[];
  successCriteria?: Array<{
    definition: string;
    validation?: string;
    completionCriteria?: string[];
    expectedOutcome?: string;
  }>;
}

export interface GoalSearchDTO {
  userId: string;
  query?: string;
  categories?: GoalCategory[];
  statuses?: GoalStatus[];
  priorities?: GoalPriority[];
  business?: string[];
  tags?: string[];
  minConfidence?: number;
  page?: number;
  limit?: number;
}
