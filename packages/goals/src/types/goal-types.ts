// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Domain Types
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Transforms any user objective into a structured execution plan:
// goal registry, understanding, classification, hierarchy, lifecycle,
// task decomposition, prioritization, dependency DAG with critical
// path, milestones, success criteria, and validation. The engine
// understands goals — it never executes them.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { ExecutionMode, StrategyPriority } from '@vedmoulya/execution-strategy';

// ── Goal Categories (Goal Understanding) ────────────────────────────────────

export type GoalCategory =
  'business' | 'personal' | 'learning' | 'career' | 'revenue' | 'project' | 'health' | 'custom';

export const GOAL_CATEGORIES: readonly GoalCategory[] = [
  'business',
  'personal',
  'learning',
  'career',
  'revenue',
  'project',
  'health',
  'custom',
] as const;

// ── Goal Priority / Complexity / Risk ───────────────────────────────────────

export type GoalPriority = StrategyPriority; // critical | high | medium | low | background

export const GOAL_PRIORITIES: readonly GoalPriority[] = [
  'critical',
  'high',
  'medium',
  'low',
  'background',
] as const;

export type ComplexityLevel = 'simple' | 'moderate' | 'complex' | 'very_complex';

export const COMPLEXITY_LEVELS: readonly ComplexityLevel[] = [
  'simple',
  'moderate',
  'complex',
  'very_complex',
] as const;

export type RiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'critical';

export const RISK_LEVELS: readonly RiskLevel[] = [
  'very_low',
  'low',
  'medium',
  'high',
  'critical',
] as const;

// ── Goal Lifecycle (State Machine) ──────────────────────────────────────────

export type GoalStatus =
  | 'proposed'
  | 'scored'
  | 'accepted'
  | 'active'
  | 'blocked'
  | 'completed'
  | 'cancelled'
  | 'archived';

export const GOAL_STATUSES: readonly GoalStatus[] = [
  'proposed',
  'scored',
  'accepted',
  'active',
  'blocked',
  'completed',
  'cancelled',
  'archived',
] as const;

/** Typed lifecycle commands for the goal state machine. */
export type GoalLifecycleCommand =
  | { type: 'score' }
  | { type: 'accept' }
  | { type: 'activate' }
  | { type: 'block'; reason: string }
  | { type: 'unblock' }
  | { type: 'complete' }
  | { type: 'cancel'; reason: string }
  | { type: 'archive' };

// ── Success Criteria ────────────────────────────────────────────────────────

/** Metric comparison operators for verifiable success predicates. */
export type MetricOperator = 'gte' | 'lte' | 'eq';

export interface SuccessCriterionMetric {
  name: string;
  target: number;
  operator: MetricOperator;
}

export interface SuccessCriterion {
  criterionId: string;
  /** What success looks like for this criterion. */
  definition: string;
  /** How the criterion will be validated. */
  validation: string;
  /** Checkable completion criteria (the "done when" list). */
  completionCriteria: string[];
  /** Expected outcome if the criterion is met. */
  expectedOutcome: string;
  /** Optional typed metric predicate. */
  metric?: SuccessCriterionMetric;
  /** Whether the criterion has been met (tracking, not execution). */
  met: boolean;
}

// ── Milestones ──────────────────────────────────────────────────────────────

export interface Milestone {
  milestoneId: string;
  title: string;
  description: string;
  /** TaskIds that mark this milestone complete. */
  taskIds: string[];
  /** Optional ISO deadline. */
  dueAt?: string;
  /** Milestone ordering within the goal plan. */
  order: number;
  /** Whether the milestone has been achieved (tracking). */
  achieved: boolean;
}

// ── Goal Classification ─────────────────────────────────────────────────────

export interface GoalClassification {
  /** Business domains the goal belongs to (e.g. content, operations, sales). */
  businessDomain: string[];
  /** Capabilities required to execute the goal (from the shared taxonomy). */
  requiredCapabilities: CapabilityType[];
  /** Context the goal needs assembled before execution (EI-003 taxonomy). */
  requiredContext: string[];
  /** Overall risk score 0–1. */
  riskScore: number;
  riskLevel: RiskLevel;
  complexity: ComplexityLevel;
  estimatedTokenRange: { min: number; max: number };
  estimatedCostRangeUsd: { min: number; max: number };
}

// ── Goal Understanding (analysis pass) ──────────────────────────────────────

export interface GoalAnalysis {
  goalId: string;
  category: GoalCategory;
  categoryConfidence: number; // 0–1
  /** Detected business-domain keywords from the goal text. */
  domainHints: string[];
  /** Detected capability keywords from the goal text. */
  capabilityHints: CapabilityType[];
  /** Detected context keywords from the goal text. */
  contextHints: string[];
  /** Suggested priority from urgency/importance signals. */
  suggestedPriority: GoalPriority;
  summary: string;
}

// ── Goal ────────────────────────────────────────────────────────────────────

export interface Goal {
  goalId: string;
  title: string;
  description: string;
  category: GoalCategory;
  /** Business units / client context the goal serves. */
  business: string[];
  priority: GoalPriority;
  /** 0–1 urgency signal. */
  urgency: number;
  /** 0–1 importance signal. */
  importance: number;
  complexity: ComplexityLevel;
  /** Estimated effort in hours. */
  estimatedEffort: number;
  status: GoalStatus;
  /** 0–1 probability of success (scored, learnable later). */
  confidence: number;
  /** Computed goal score 0–1 (weighted value/priority/confidence). */
  goalScore: number;
  successCriteria: SuccessCriterion[];
  milestones: Milestone[];
  /** GoalIds that must complete first (dependency edges, DAG enforced). */
  dependencies: string[];
  /** Parent goal (hierarchy). */
  parentGoalId?: string;
  /** Child goalIds (hierarchy). */
  childGoalIds: string[];
  tags: string[];
  metadata: Record<string, string | number | boolean>;
  classification?: GoalClassification;
  analysis?: GoalAnalysis;
  events: GoalEvent[];
  createdAt: string;
  updatedAt: string;
}

// ── Goal Events ─────────────────────────────────────────────────────────────

export type GoalEventType =
  | 'created'
  | 'analyzed'
  | 'classified'
  | 'scored'
  | 'accepted'
  | 'activated'
  | 'blocked'
  | 'resumed'
  | 'decomposed'
  | 'validated'
  | 'completed'
  | 'cancelled'
  | 'archived';

export const GOAL_EVENT_TYPES: readonly GoalEventType[] = [
  'created',
  'analyzed',
  'classified',
  'scored',
  'accepted',
  'activated',
  'blocked',
  'resumed',
  'decomposed',
  'validated',
  'completed',
  'cancelled',
  'archived',
] as const;

export interface GoalEvent {
  eventId: string;
  goalId: string;
  type: GoalEventType;
  /** ISO timestamp. */
  timestamp: string;
  message: string;
  metadata: Record<string, string | number | boolean>;
}

// ── Task ────────────────────────────────────────────────────────────────────

export type TaskFlowType = 'sequential' | 'parallel' | 'conditional' | 'optional';

export const TASK_FLOW_TYPES: readonly TaskFlowType[] = [
  'sequential',
  'parallel',
  'conditional',
  'optional',
] as const;

export type TaskStatus =
  'proposed' | 'ready' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';

export const TASK_STATUSES: readonly TaskStatus[] = [
  'proposed',
  'ready',
  'running',
  'blocked',
  'completed',
  'failed',
  'cancelled',
] as const;

export interface TaskRetryPolicy {
  maxRetries: number;
  retryDelayMs: number;
  /** Failure classes that are retryable (aligns with packages/ai). */
  retryableFailures: string[];
}

export interface TaskValidationRule {
  ruleId: string;
  description: string;
}

export interface Task {
  taskId: string;
  goalId: string;
  title: string;
  capability: CapabilityType;
  /** Computed priority 0–100 (higher = more urgent/valuable). */
  priority: number;
  /** Business value signal 0–1. */
  businessValue: number;
  /** Urgency signal 0–1. */
  urgency: number;
  /** Importance signal 0–1. */
  importance: number;
  /** Risk signal 0–1 (1 − confidence of completion). */
  risk: number;
  /** 0–1 probability this task completes within budget. */
  confidence: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  /** Estimated duration in ms (weights the critical path). */
  estimatedTimeMs: number;
  /** TaskIds that must complete before this one (DAG edges). */
  dependencies: string[];
  /** Whether this task may run concurrently with its siblings. */
  parallelEligible: boolean;
  flowType: TaskFlowType;
  retryPolicy: TaskRetryPolicy;
  validationRules: TaskValidationRule[];
  status: TaskStatus;
  /** Nested decomposition support. */
  parentTaskId?: string;
  subTaskIds: string[];
  /** Declaration order within the goal plan. */
  order: number;
  /** Whether this task lies on the critical path (computed). */
  critical: boolean;
  /** Critical-path slack in ms (0 = critical). */
  slack: number;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

// ── Task Graph (DAG + Critical Path + Parallel Groups) ──────────────────────

export interface TaskGraph {
  goalId: string;
  tasks: Task[];
  /** TaskIds on the longest weighted path (longest total duration). */
  criticalPath: string[];
  /** TaskIds allowed to run concurrently (deduped groups). */
  parallelGroups: string[][];
  milestones: Milestone[];
  /** Total estimated duration of the critical path in ms. */
  totalEstimatedTimeMs: number;
  totalEstimatedCostUsd: number;
  totalEstimatedTokens: number;
  /** Longest path duration sum (unweighted chain). */
  criticalPathLength: number;
  /** Whether the DAG passed validation (acyclic, resolvable). */
  validated: boolean;
}

// ── Goal Validation ─────────────────────────────────────────────────────────

export interface GoalValidationCheck {
  check: string;
  passed: boolean;
  detail: string;
}

export interface GoalValidation {
  passed: boolean;
  checks: GoalValidationCheck[];
  summary: string;
  score: number; // 0–1
}

// ── Goal Input (create) ─────────────────────────────────────────────────────

export interface GoalInput {
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
  /** Optional pre-authored success criteria. */
  successCriteria?: Array<{
    definition: string;
    validation?: string;
    completionCriteria?: string[];
    expectedOutcome?: string;
  }>;
}

// ── Goal Search ─────────────────────────────────────────────────────────────

export interface GoalSearchCriteria {
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

// ── Strategy Handoff (EI-006 → EI-004) ─────────────────────────────────────

/** Execution mode + priority reuse from EI-004 so downstream strategy
 *  creation consumes the same vocabulary. */
export type GoalExecutionMode = ExecutionMode;

export interface StrategyHandoff {
  goalId: string;
  goal: string;
  business: string[];
  priority: GoalPriority;
  /** Capability plan steps derived from the task decomposition. */
  steps: Array<{
    stepId: string;
    capability: CapabilityType;
    label: string;
    flowType: TaskFlowType;
    weight: number;
  }>;
  /** Suggested execution mode (derived from the DAG structure). */
  mode: GoalExecutionMode;
  estimatedTokens: number;
  estimatedCostUsd: number;
}
