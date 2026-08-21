// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Fabric · WorkflowBounds
// SPRINT-030 — G-7 · bounded orchestration.
//
// A workflow plan (produced by the EXISTING decomposer/planner — the fabric
// never executes) must fit configurable limits:
//   MAX_PARALLEL_PROVIDERS · MAX_WORKFLOW_DEPTH · MAX_WORKFLOW_TASKS ·
//   MAX_PROVIDER_CALLS · MAX_WORKFLOW_COST · MAX_WORKFLOW_TIME
// Fail-closed: any exceeded limit BLOCKS the plan before anything runs. This
// is the guard against unbounded provider fan-out and unbounded loops.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  WorkflowBoundsDecision,
  WorkflowLimits,
  WorkflowPlan,
} from '../types/fabric-types.js';

export class WorkflowBounds {
  validate(plan: WorkflowPlan, limits: WorkflowLimits): WorkflowBoundsDecision {
    if (plan.taskCount > limits.maxWorkflowTasks) {
      return {
        allowed: false,
        reason: `${plan.taskCount} tasks exceed maxWorkflowTasks ${limits.maxWorkflowTasks}.`,
        exceeded: 'tasks',
      };
    }
    if (plan.depth > limits.maxWorkflowDepth) {
      return {
        allowed: false,
        reason: `depth ${plan.depth} exceeds maxWorkflowDepth ${limits.maxWorkflowDepth}.`,
        exceeded: 'depth',
      };
    }
    if (plan.maxParallelFanout > limits.maxParallelProviders) {
      return {
        allowed: false,
        reason: `parallel fanout ${plan.maxParallelFanout} exceeds maxParallelProviders ${limits.maxParallelProviders} — unbounded provider fan-out blocked.`,
        exceeded: 'parallel',
      };
    }
    if (plan.estimatedProviderCalls > limits.maxProviderCalls) {
      return {
        allowed: false,
        reason: `${plan.estimatedProviderCalls} provider calls exceed maxProviderCalls ${limits.maxProviderCalls}.`,
        exceeded: 'calls',
      };
    }
    if (plan.estimatedCostUsd !== undefined && plan.estimatedCostUsd > limits.maxWorkflowCostUsd) {
      return {
        allowed: false,
        reason: `estimated cost $${plan.estimatedCostUsd.toFixed(4)} exceeds maxWorkflowCostUsd $${limits.maxWorkflowCostUsd.toFixed(4)}.`,
        exceeded: 'cost',
      };
    }
    if (plan.estimatedTimeMs !== undefined && plan.estimatedTimeMs > limits.maxWorkflowTimeMs) {
      return {
        allowed: false,
        reason: `estimated time ${plan.estimatedTimeMs}ms exceeds maxWorkflowTimeMs ${limits.maxWorkflowTimeMs}ms.`,
        exceeded: 'time',
      };
    }
    return { allowed: true, reason: 'Workflow plan is within all bounds.' };
  }
}
