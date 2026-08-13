// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Identifier Value Objects
// EI-006 — Enterprise Goal & Task Intelligence Engine
// ──────────────────────────────────────────────────────────────────

const SYMBOL_GOAL_ID = Symbol('GoalId');
const SYMBOL_TASK_ID = Symbol('TaskId');
const SYMBOL_MILESTONE_ID = Symbol('MilestoneId');
const SYMBOL_CRITERION_ID = Symbol('SuccessCriterionId');

export type GoalId = string & { readonly [SYMBOL_GOAL_ID]: true };
export type TaskId = string & { readonly [SYMBOL_TASK_ID]: true };
export type MilestoneId = string & { readonly [SYMBOL_MILESTONE_ID]: true };
export type SuccessCriterionId = string & { readonly [SYMBOL_CRITERION_ID]: true };

export function createGoalId(id: string): GoalId {
  return id as GoalId;
}

export function generateGoalId(): GoalId {
  return `goal_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}` as GoalId;
}

export function createTaskId(id: string): TaskId {
  return id as TaskId;
}

export function generateTaskId(): TaskId {
  return `task_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}` as TaskId;
}

export function createMilestoneId(id: string): MilestoneId {
  return id as MilestoneId;
}

export function generateMilestoneId(): MilestoneId {
  return `milestone_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}` as MilestoneId;
}

export function createSuccessCriterionId(id: string): SuccessCriterionId {
  return id as SuccessCriterionId;
}

export function generateSuccessCriterionId(): SuccessCriterionId {
  return `criterion_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}` as SuccessCriterionId;
}
