// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Business Rules
// Domain validation rules for execution operations
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { ExecutionPlan } from '../entities/ExecutionPlan.js';
import type { ExecutionTask } from '../entities/ExecutionTask.js';

export interface RuleResult {
  valid: boolean;
  message?: string;
}

export type Rule = (data: unknown) => RuleResult;

// ── Plan Validation Rules ───────────────────────────────────────────────

export const planContentRule: Rule = (data: unknown) => {
  const plan = data as ExecutionPlan;
  if (!plan.title || plan.title.trim().length === 0) {
    return { valid: false, message: 'Plan title must not be empty' };
  }
  if (plan.title.length > 200) {
    return { valid: false, message: 'Plan title must be at most 200 characters' };
  }
  if (!plan.description || plan.description.trim().length === 0) {
    return { valid: false, message: 'Plan description must not be empty' };
  }
  return { valid: true };
};

export const planHasTasksOrMissionsRule: Rule = (data: unknown) => {
  const plan = data as ExecutionPlan;
  if (plan.status.isInProgress && plan.totalTasks === 0 && plan.totalMissions === 0) {
    return { valid: false, message: 'Active plans must have at least one task or mission' };
  }
  return { valid: true };
};

export const missionHasTasksRule: Rule = (data: unknown) => {
  const plan = data as ExecutionPlan;
  for (const mission of plan.missions) {
    if (mission.status.isInProgress && mission.totalTasks === 0) {
      return {
        valid: false,
        message: `Mission "${mission.label}" has no tasks but is in progress`,
      };
    }
  }
  return { valid: true };
};

// ── Task Validation Rules ───────────────────────────────────────────────

export const taskContentRule: Rule = (data: unknown) => {
  const task = data as ExecutionTask;
  if (!task.label || task.label.trim().length === 0) {
    return { valid: false, message: 'Task label must not be empty' };
  }
  return { valid: true };
};

export const taskDependenciesMetRule: Rule = (data: unknown) => {
  const task = data as ExecutionTask;
  if (task.status.isInProgress && task.hasHardDependencies) {
    return { valid: false, message: 'Task cannot start while dependencies are unresolved' };
  }
  return { valid: true };
};

// ── Composite Validator ─────────────────────────────────────────────────

export function validate(rules: Rule[], data: unknown): RuleResult {
  for (const rule of rules) {
    const result = rule(data);
    if (!result.valid) return result;
  }
  return { valid: true };
}
